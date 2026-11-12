/**
 * Direct-chat identity and display policy. A direct channel belongs to exactly
 * two members of one organisation. Titles shown here are descriptive only;
 * they never confer organisation permissions.
 */
import { createHash } from 'node:crypto';

export type DirectMember = {
  id: string;
  organisationId?: string;
  enabled: boolean;
  status: string;
  roles: string[];
  teamIds?: string[];
  positionTitle?: string;
  membershipTypeId?: string;
};

export function directChannelId(organisationId: string, userA: string, userB: string): string {
  if (!organisationId || !userA || !userB || userA === userB)
    throw new Error('A direct chat requires two distinct organisation members.');
  const members = [userA, userB].sort();
  const hash = createHash('sha256')
    .update(JSON.stringify([organisationId, ...members]))
    .digest('hex').slice(0, 48);
  return `dm-${hash}`;
}

export function isDirectChatChannelId(value: string): boolean {
  return /^dm-[a-f0-9]{48}$/.test(value);
}

export function canDirectChat(sender: DirectMember, recipient: DirectMember): boolean {
  return Boolean(sender.enabled && sender.status === 'ACTIVE' &&
    recipient.enabled && recipient.status === 'ACTIVE' &&
    sender.id !== recipient.id &&
    sender.organisationId && sender.organisationId === recipient.organisationId &&
    !sender.roles.includes('PUBLIC_REPORTER') && !recipient.roles.includes('PUBLIC_REPORTER'));
}

export function displayMemberLabels(
  member: Pick<DirectMember, 'roles' | 'teamIds' | 'positionTitle' | 'membershipTypeId'>,
  membershipNames: Map<string, string>,
  teamNames: Map<string, string>
): string[] {
  const labels = [
    member.positionTitle?.trim(),
    member.membershipTypeId ? membershipNames.get(member.membershipTypeId) : undefined,
    ...member.roles.map(role => ({
      ORG_ADMIN: 'Organisation administrator',
      DISPATCHER: 'Dispatcher', RESCUER: 'Rescuer', CARER: 'Carer',
      AUTHORITY_ADMIN: 'Authority administrator', PLATFORM_ADMIN: 'Platform administrator'
    } as Record<string, string>)[role]).filter(Boolean),
    ...(member.teamIds ?? []).map(id => teamNames.get(id)).filter((value): value is string => Boolean(value))
  ];
  return [...new Set(labels.filter((value): value is string => Boolean(value)))];
}
