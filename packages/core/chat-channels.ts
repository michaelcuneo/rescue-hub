/**
 * Organisation chat directory and membership policy shared by desktop and
 * Expo APIs. Chat access is derived from ACTIVE organisation membership;
 * these groups are not visible to unaffiliated public reporters.
 */
export type ChatTeam = {
  id: string; name: string; active: boolean;
  capabilityCode?: string; receivesAllRescues?: boolean;
};
export type ChatViewer = {
  enabled: boolean; status: string; roles: string[]; teamIds: string[];
  organisationId?: string;
};
export type ChatChannel = {
  id: string; name: string; description: string;
  audience: 'ADMIN' | 'ORG' | 'TEAM';
  teamIds: string[];
};
const ADMIN_ROLES = new Set(['ORG_ADMIN', 'DISPATCHER', 'PLATFORM_ADMIN', 'AUTHORITY_ADMIN']);
const PLATFORM_OVERSIGHT_ROLES = new Set(['PLATFORM_ADMIN', 'AUTHORITY_ADMIN']);

/** Only actual active elevated accounts can inspect an organisation without
 * being a member. Normal organisation users cannot switch tenants.
 */
export function isPlatformOversightUser(user: ChatViewer): boolean {
  return user.enabled && user.status === 'ACTIVE' &&
    !user.roles.includes('PUBLIC_REPORTER') &&
    user.roles.some(role => PLATFORM_OVERSIGHT_ROLES.has(role));
}
export function canSelectChatOrganisation(user: ChatViewer, organisationId: string): boolean {
  if (!organisationId || !user.enabled || user.status !== 'ACTIVE' ||
      user.roles.includes('PUBLIC_REPORTER')) return false;
  return isPlatformOversightUser(user) || user.organisationId === organisationId;
}
const groups = [
  { id: 'reptiles', name: 'Reptiles', capabilities: ['REPTILE_NON_VENOMOUS', 'REPTILE_VENOMOUS'] },
  { id: 'birds', name: 'Birds', capabilities: ['BIRD'] },
  { id: 'raptors', name: 'Raptors', capabilities: ['RAPTOR'] },
  { id: 'macropods', name: 'Macropods', capabilities: ['MACROPOD'] },
  { id: 'possums-gliders', name: 'Possums & Gliders', capabilities: ['POSSUM_GLIDER'] },
  { id: 'wombats', name: 'Wombats', capabilities: ['WOMBAT'] },
  { id: 'bats-flying-foxes', name: 'Bats & Flying Foxes', capabilities: ['BAT_FLYING_FOX'] },
  { id: 'marine', name: 'Marine Wildlife', capabilities: ['MARINE'] },
  { id: 'other-wildlife', name: 'Other Wildlife', capabilities: ['OTHER'] }
] as const;
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 48);

export function buildChatChannels(teams: ChatTeam[]): ChatChannel[] {
  const channels: ChatChannel[] = [
    { id: 'administration', name: 'Administration', description: 'Organisation coordination and administration', audience: 'ADMIN', teamIds: [] },
    { id: 'qa', name: 'Q&A', description: 'Questions, experience and day-to-day advice', audience: 'ORG', teamIds: [] },
    { id: 'trading-post', name: 'Trading Post', description: 'Equipment, supplies and volunteer offers', audience: 'ORG', teamIds: [] }
  ];
  const active = teams.filter(team => team.active);
  const assigned = new Set<string>();
  for (const group of groups) {
    const ids = active.filter(team => group.capabilities.some(cap => cap === team.capabilityCode)).map(team => team.id);
    if (ids.length) {
      channels.push({
        id: group.id, name: group.name,
        description: `${group.name} wildlife care and transport coordination`,
        audience: 'TEAM', teamIds: ids
      });
      for (const id of ids) assigned.add(id);
    }
  }
  for (const team of active) {
    if (assigned.has(team.id)) continue;
    const id = `team-${slug(team.id)}`;
    if (id === 'team-' || channels.some(channel => channel.id === id)) continue;
    channels.push({
      id, name: team.name, description: team.name + ' volunteers and carers',
      audience: 'TEAM', teamIds: [team.id]
    });
  }
  return channels;
}

export function canAccessChat(user: ChatViewer, channel: ChatChannel): boolean {
  if (!user.enabled || user.status !== 'ACTIVE' ||
      user.roles.includes('PUBLIC_REPORTER')) return false;
  if (isPlatformOversightUser(user)) return true;
  if (!user.organisationId) return false;
  const admin = user.roles.some(role => ADMIN_ROLES.has(role));
  if (channel.audience === 'ADMIN') return admin;
  if (channel.audience === 'ORG') return true;
  return admin || channel.teamIds.some(team => user.teamIds.includes(team));
}
export function visibleChatChannels(user: ChatViewer, teams: ChatTeam[]): ChatChannel[] {
  return buildChatChannels(teams).filter(channel => canAccessChat(user, channel));
}
export function isValidChatChannelId(channelId: string) {
  return /^[a-z0-9][a-z0-9-]{0,63}$/.test(channelId);
}
export function validateChatText(text: unknown): string {
  if (typeof text !== 'string') throw new Error('Enter a message.');
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(trimmed))
    throw new Error('Message must contain 1–2000 readable characters.');
  return trimmed;
}
export function relatedAnimalChannel(species: string, teams: ChatTeam[]) {
  const lower = species.toLowerCase();
  const capability = /snake|lizard|skink|gecko|python|dragon|reptile|turtle|taipan/.test(lower) ? 'REPTILE' :
    /owl|eagle|hawk|falcon|raptor/.test(lower) ? 'RAPTOR' :
    /bird|magpie|parrot|lorikeet|cockatoo|kookaburra|duck|galah/.test(lower) ? 'BIRD' :
    /wallaby|kangaroo|pademelon|macropod/.test(lower) ? 'MACROPOD' :
    /possum|glider/.test(lower) ? 'POSSUM_GLIDER' :
    /wombat/.test(lower) ? 'WOMBAT' :
    /bat|flying fox/.test(lower) ? 'BAT' : '';
  const candidates: Record<string, string> = { REPTILE: 'reptiles', RAPTOR: 'raptors', BIRD: 'birds',
    MACROPOD: 'macropods', POSSUM_GLIDER: 'possums-gliders',
    WOMBAT: 'wombats', BAT: 'bats-flying-foxes' };
  const wanted = candidates[capability] ?? 'qa';
  return buildChatChannels(teams).some(channel => channel.id === wanted) ? wanted : 'qa';
}
