import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { getOrganisationMembershipConfig } from './membership';
import { publishRescueChange } from './realtime';
import type { RescueHubUser } from './auth';
import {
  buildChatChannels, canAccessChat, isValidChatChannelId, validateChatText,
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

export async function requireChannel(
  user: RescueHubUser, channelId: string
): Promise<ChatChannel> {
  if (!user.organisationId || !isValidChatChannelId(channelId) ||
      user.enabled !== true || user.status !== 'ACTIVE' ||
      user.roles.includes('PUBLIC_REPORTER')) {
    throw new ChatAccessError('Chat is not available for this account.');
  }
  const config = await getOrganisationMembershipConfig(user.organisationId);
  const channel = buildChatChannels(config.teams).find(item => item.id === channelId);
  if (!channel || !canAccessChat(user, channel)) {
    throw new ChatAccessError('You are not a member of this chat channel.');
  }
  return channel;
}

/** Strictly scoped to authenticated users' own organisation. No full-table scan. */
export async function listMyChannels(user: RescueHubUser): Promise<ChatSummary[]> {
  if (!user.organisationId || !user.enabled || user.status !== 'ACTIVE' ||
      user.roles.includes('PUBLIC_REPORTER')) throw new ChatAccessError('Organisation membership required.');
  const config = await getOrganisationMembershipConfig(user.organisationId);
  const allowed = buildChatChannels(config.teams).filter(c => canAccessChat(user,c));
  return Promise.all(allowed.map(async channel => {
    const pk = channelPk(user.organisationId!, channel.id);
    const [latest, marker] = await Promise.all([
      db.send(new QueryCommand({
        TableName: table, KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: { ':pk': pk, ':prefix': CHAT_PREFIX },
        ScanIndexForward: false, Limit: 1
      })),
      db.send(new GetCommand({
        TableName: table, Key: { pk: `USER#${user.id}`, sk: `CHAT_READ#${channel.id}` }
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
  user: RescueHubUser, channelId: string, before?: string
): Promise<{ items: ChatMessage[]; nextCursor: string | null }> {
  await requireChannel(user, channelId);
  const pk = channelPk(user.organisationId!, channelId);
  if (before && (!/^MSG#\d{4}-\d\d-\d\dT[\d:.]+Z#[0-9a-f-]{36}$/.test(before) || before.length > 110))
    throw new ChatAccessError('Invalid chat cursor.');
  const page = await db.send(new QueryCommand({
    TableName: table,
    KeyConditionExpression: before
      ? 'pk = :pk AND sk < :before'
      : 'pk = :pk AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: {
      ':pk': pk, ':prefix': CHAT_PREFIX, ...(before ? { ':before': before } : {})
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
  user: RescueHubUser, channelId: string, input: { text: unknown; animalId?: unknown }
): Promise<ChatMessage> {
  await requireChannel(user, channelId);
  const text = validateChatText(input.text);
  const animalId = input.animalId;
  if (animalId !== undefined &&
      (typeof animalId !== 'string' || !/^[a-f0-9-]{36}$/i.test(animalId))) {
    throw new ChatAccessError('Invalid linked animal ID.');
  }
  if (typeof animalId === 'string') {
    const { getAnimal } = await import('./animals');
    const animal = await getAnimal(animalId);
    if (!animal || animal.organisationId !== user.organisationId) {
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
      pk: channelPk(user.organisationId!, channelId),
      sk: `MSG#${createdAt}#${id}`,
      entity: 'chat_message', organisationId: user.organisationId, ...message
    },
    ConditionExpression: 'attribute_not_exists(pk)'
  }));
  await publishRescueChange();
  return message;
}

export async function markChatRead(user: RescueHubUser, channelId: string, lastMessageId: unknown) {
  await requireChannel(user, channelId);
  if (typeof lastMessageId !== 'string' || !/^[a-f0-9-]{36}$/i.test(lastMessageId))
    throw new ChatAccessError('Invalid message.');
  const pk = channelPk(user.organisationId!, channelId);
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
    Key: { pk: `USER#${user.id}`, sk: `CHAT_READ#${channelId}` },
    UpdateExpression: 'SET lastSeenKey = :seen, organisationId = :org, updatedAt = :at',
    ConditionExpression: 'attribute_not_exists(lastSeenKey) OR lastSeenKey <= :seen',
    ExpressionAttributeValues: { ':seen': lastSeenKey, ':org': user.organisationId, ':at': new Date().toISOString() }
  })).catch(error => {
    if (!(error instanceof Error && error.name === 'ConditionalCheckFailedException')) throw error;
  });
}
