import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { getOrganisationMembershipConfig } from './membership';
import { publishRescueChange } from './realtime';
import { listUsers, type RescueHubUser } from './auth';
import { listAdminOrganisations } from './admin-data';
import {
  buildChatChannels, canAccessChat, canSelectChatOrganisation, isPlatformOversightUser,
  isValidChatChannelId, validateChatText,
  type ChatChannel
} from '../../../../core/chat-channels';

const table = Resource.RescueHubData.name;
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
});
const PAGE_SIZE = 40;
const CHAT_PREFIX = 'MSG#';
const MAX_READ_LOOKBACK = 100;

export type ChatMessage = {
  id: string;
  channelId: string;
  senderUserId: string;
  senderName: string;
  text: string;
  createdAt: string;
  animalId?: string;
  kind?: 'MESSAGE' | 'SYSTEM';
};
export type ChatSummary = ChatChannel & {
  latest?: { text: string; createdAt: string; senderName: string };
  unread: boolean;
};

const channelPk = (organisationId: string, channelId: string) =>
  `ORG#${organisationId}#CHAT#${channelId}`;

export class ChatAccessError extends Error {}

// Audit privilege use once per user/organisation per UTC day, not on every
// 15-second chat refresh. The Dynamo conditional write deduplicates cold starts.
const auditedOversight = new Set<string>();
async function recordOversightAccess(user: RescueHubUser, organisationId: string) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `${day}#${user.id}#${organisationId}`;
  if (auditedOversight.has(key)) return;
  const now = new Date().toISOString();
  try {
    await db.send(new PutCommand({
      TableName: table,
      Item: {
        pk: `AUDIT#CHAT_OVERSIGHT#${key}`, sk: 'META',
        entity: 'audit_event', id: crypto.randomUUID(),
        organisationId, action: 'PLATFORM_CHAT_OVERSIGHT',
        summary: 'Platform administrator viewed organisation chat channels',
        actorUserId: user.id, createdAt: now,
        gsi2pk: 'AUDIT', gsi2sk: `${now}#${user.id}`
      },
      ConditionExpression: 'attribute_not_exists(pk)'
    }));
  } catch (error) {
    if (!(error instanceof Error && error.name === 'ConditionalCheckFailedException')) {
      console.error('Privileged chat oversight audit failed:', error);
      return;
    }
  }
  auditedOversight.add(key);
}

/**
 * Privileged access requires an explicit selected organisation. Ordinary users
 * are always locked to their membership; platform/admin identities have no
 * implicit organisation and cannot leak messages across organisations.
 */
export async function resolveChatOrganisation(user: RescueHubUser, selected?: string): Promise<string> {
  const organisationId = selected || user.organisationId;
  if (!organisationId || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(organisationId) ||
      !canSelectChatOrganisation(user, organisationId)) {
    throw new ChatAccessError('Select an authorised organisation to access its chats.');
  }
  if (isPlatformOversightUser(user)) {
    const organisations = await listChatOrganisations(user);
    if (!organisations.some(item => item.id === organisationId))
      throw new ChatAccessError('The selected organisation is not available.');
    await recordOversightAccess(user, organisationId);
  }
  return organisationId;
}

export async function listChatOrganisations(user: RescueHubUser):
  Promise<Array<{ id: string; name: string }>> {
  if (!user.enabled || user.status !== 'ACTIVE' || user.roles.includes('PUBLIC_REPORTER'))
    throw new ChatAccessError('Chat access requires an active account.');
  if (!isPlatformOversightUser(user)) {
    if (!user.organisationId) throw new ChatAccessError('Organisation membership required.');
    return [{ id: user.organisationId, name: user.organisationId }];
  }
  const [directory, users] = await Promise.all([listAdminOrganisations(), listUsers()]);
  const organisations = new Map<string, string>();
  for (const item of directory) organisations.set(item.id, item.displayName || item.officialName || item.id);
  for (const member of users) if (member.organisationId && !organisations.has(member.organisationId))
    organisations.set(member.organisationId, member.organisationId);
  if (user.organisationId && !organisations.has(user.organisationId))
    organisations.set(user.organisationId, user.organisationId);
  return [...organisations].map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}


export async function requireChannel(
  user: RescueHubUser, channelId: string, selectedOrganisationId?: string
): Promise<{ channel: ChatChannel; organisationId: string }> {
  if (!isValidChatChannelId(channelId)) throw new ChatAccessError('Invalid chat channel.');
  const organisationId = await resolveChatOrganisation(user, selectedOrganisationId);
  const config = await getOrganisationMembershipConfig(organisationId);
  const channel = buildChatChannels(config.teams).find(item => item.id === channelId);
  if (!channel || !canAccessChat({ ...user, organisationId }, channel))
    throw new ChatAccessError('You are not authorised for this chat channel.');
  return { channel, organisationId };
}

/** Strictly scoped to an explicitly authorised organisation. No full-table scan. */
export async function listMyChannels(user: RescueHubUser, selectedOrganisationId?: string): Promise<ChatSummary[]> {
  const organisationId = await resolveChatOrganisation(user, selectedOrganisationId);
  const config = await getOrganisationMembershipConfig(organisationId);
  const allowed = buildChatChannels(config.teams)
    .filter(c => canAccessChat({ ...user, organisationId }, c));
  return Promise.all(allowed.map(async channel => {
    const pk = channelPk(organisationId, channel.id);
    const [latest, marker] = await Promise.all([
      db.send(new QueryCommand({
        TableName: table, KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: { ':pk': pk, ':prefix': CHAT_PREFIX },
        ScanIndexForward: false, Limit: 1
      })),
      db.send(new GetCommand({
        TableName: table, Key: { pk: `USER#${user.id}`, sk: `CHAT_READ#${organisationId}#${channel.id}` }
      }))
    ]);
    const message = latest.Items?.[0] as (ChatMessage & { sk?: string }) | undefined;
    const lastSeen = marker.Item?.lastSeenKey;
    return {
      ...channel,
      ...(message ? { latest: {
        text: message.text, createdAt: message.createdAt, senderName: message.senderName
      }} : {}),
      unread: Boolean(message && message.sk && message.sk > (typeof lastSeen === 'string' ? lastSeen : '') &&
        message.senderUserId !== user.id)
    };
  }));
}

export async function readChatPage(
  user: RescueHubUser, channelId: string, before?: string, selectedOrganisationId?: string
): Promise<{ items: ChatMessage[]; nextCursor: string | null }> {
  const { organisationId } = await requireChannel(user, channelId, selectedOrganisationId);
  const pk = channelPk(organisationId, channelId);
  if (before && (!/^MSG#\d{4}-\d\d-\d\dT[\d:.]+Z#[0-9a-f-]{36}$/.test(before) || before.length > 110))
    throw new ChatAccessError('Invalid chat cursor.');
  const page = await db.send(new QueryCommand({
    TableName: table,
    KeyConditionExpression: before
      ? 'pk = :pk AND sk < :before'
      : 'pk = :pk AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: {
      ':pk': pk, ...(before ? { ':before': before } : { ':prefix': CHAT_PREFIX })
    },
    ScanIndexForward: false,
    Limit: PAGE_SIZE
  }));
  const items = (page.Items ?? []).map(item => ({
    id: String(item.id),
    channelId,
    senderUserId: String(item.senderUserId),
    senderName: String(item.senderName),
    text: String(item.text),
    createdAt: String(item.createdAt),
    ...(typeof item.animalId === 'string' ? { animalId: item.animalId } : {}),
    kind: item.kind === 'SYSTEM' ? 'SYSTEM' as const : 'MESSAGE' as const
  })).reverse();
  return {
    items,
    nextCursor: page.LastEvaluatedKey
      ? String(page.Items?.[page.Items.length - 1]?.sk ?? '')
      : null
  };
}

export async function postChatMessage(
  user: RescueHubUser, channelId: string, input: { text: unknown; animalId?: unknown },
  selectedOrganisationId?: string
): Promise<ChatMessage> {
  const { organisationId } = await requireChannel(user, channelId, selectedOrganisationId);
  const text = validateChatText(input.text);
  const animalId = input.animalId;
  if (animalId !== undefined &&
      (typeof animalId !== 'string' || !/^[a-f0-9-]{36}$/i.test(animalId))) {
    throw new ChatAccessError('Invalid linked animal ID.');
  }
  if (typeof animalId === 'string') {
    const { getAnimal } = await import('./animals');
    const animal = await getAnimal(animalId);
    if (!animal || animal.organisationId !== organisationId) {
      throw new ChatAccessError('Linked animal is not available in your organisation.');
    }
  }
  const createdAt = new Date().toISOString(), id = crypto.randomUUID();
  const message: ChatMessage = {
    id, channelId, text, senderUserId: user.id,
    senderName: user.name, createdAt, kind: 'MESSAGE',
    ...(typeof animalId === 'string' ? { animalId } : {})
  };
  await db.send(new PutCommand({
    TableName: table,
    Item: {
      pk: channelPk(organisationId, channelId),
      sk: `MSG#${createdAt}#${id}`,
      entity: 'chat_message', organisationId, ...message
    },
    ConditionExpression: 'attribute_not_exists(pk)'
  }));
  await publishRescueChange();
  return message;
}

export async function markChatRead(
  user: RescueHubUser, channelId: string, lastMessageId: unknown, selectedOrganisationId?: string
) {
  const { organisationId } = await requireChannel(user, channelId, selectedOrganisationId);
  if (typeof lastMessageId !== 'string' || !/^[a-f0-9-]{36}$/i.test(lastMessageId))
    throw new ChatAccessError('Invalid message.');
  const pk = channelPk(organisationId, channelId);
  // Never accept an arbitrary timestamp/cursor from the client.
  let found: Record<string, unknown> | undefined;
  let cursor: Record<string, unknown> | undefined;
  // A bounded scan of the most recent page(s) prevents unbounded client work.
  for (let scanned = 0; scanned < MAX_READ_LOOKBACK && !found;) {
    const page = await db.send(new QueryCommand({
      TableName: table, KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: { ':pk': pk, ':prefix': CHAT_PREFIX },
      ScanIndexForward: false, Limit: Math.min(40, MAX_READ_LOOKBACK - scanned),
      ExclusiveStartKey: cursor
    }));
    scanned += (page.Items ?? []).length;
    found = (page.Items ?? []).find(item => item.id === lastMessageId);
    cursor = page.LastEvaluatedKey;
    if (!cursor) break;
  }
  if (!found || typeof found.sk !== 'string') throw new ChatAccessError('Message not found in recent channel history.');
  const lastSeenKey = String(found.sk);
  await db.send(new UpdateCommand({
    TableName: table,
    Key: { pk: `USER#${user.id}`, sk: `CHAT_READ#${organisationId}#${channelId}` },
    UpdateExpression: 'SET lastSeenKey = :seen, organisationId = :org, updatedAt = :at',
    ConditionExpression: 'attribute_not_exists(lastSeenKey) OR lastSeenKey <= :seen',
    ExpressionAttributeValues: { ':seen': lastSeenKey, ':org': organisationId, ':at': new Date().toISOString() }
  })).catch(error => {
    if (!(error instanceof Error && error.name === 'ConditionalCheckFailedException')) throw error;
  });
}
