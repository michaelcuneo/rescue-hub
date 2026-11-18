import { getAnimal, listRescueAnimals } from './animals';
import { getRescue } from './graphql';
import { searchRescueArchive } from './rescue-archive';
import { listChatDirectory, requireChannel, ChatAccessError } from './organisation-chat';
import { mentionHandle, usableChatMentions, type ChatMention } from '../../../../core/chat-mentions';
import type { RescueHubUser } from './auth';

/** Only authorised channel participants can search or reference colleagues. */
export async function listChatMentions(
  user: RescueHubUser, channelId: string, organisationId: string | undefined, query: string
): Promise<ChatMention[]> {
  const { organisationId: org } = await requireChannel(user, channelId, organisationId);
  const term = query.trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,60}$/.test(term)) return [];
  const people = await listChatDirectory(user, org, channelId);
  const matches: ChatMention[] = people
    .filter(person => mentionHandle(person.name).includes(term))
    .slice(0, 8)
    .map(person => ({
      kind: 'person', id: person.id, label: person.name,
      handle: mentionHandle(person.name)
    }));
  if (term.length < 2) return matches;

  // Bounded, organisation-scoped archive lookup. Never return location,
  // coordinates, care history, or private carer/custodian details in suggestions.
  const archive = await searchRescueArchive({
    query: term.replace(/-/g, ' '), status: 'all', period: 'all',
    day: '', from: '', to: '', order: 'newest', organisationId: org
  }, undefined, new Map(), 10);
  const fromCases = await Promise.all(archive.items.map(async rescue => {
    const rescueName = rescue.breed || rescue.type;
    const entries: ChatMention[] = [];
    if (mentionHandle(rescueName).includes(term) ||
        rescueName.toLowerCase().includes(term.replace(/-/g, ' '))) {
      entries.push({kind:'rescue', id:rescue.id, rescueId:rescue.id,
        label:rescueName, handle:mentionHandle(rescueName)});
    }
    // Real animal records receive their stable animal ID; unregistered
    // incidents remain linkable as rescue references.
    const animals = await listRescueAnimals(rescue.id, org);
    for (const animal of animals.slice(0, 3)) {
      if (animal.registrationVoidedAt) continue;
      if (!mentionHandle(animal.species).includes(term) &&
          !animal.species.toLowerCase().includes(term.replace(/-/g, ' '))) continue;
      entries.unshift({kind:'animal', id:animal.id, rescueId:animal.rescueId,
        label:animal.species, handle:mentionHandle(animal.species)});
    }
    return entries;
  }));
  const seen = new Set(matches.map(item => item.kind + ':' + item.id));
  for (const item of fromCases.flat()) {
    const key = item.kind + ':' + item.id;
    if (!item.handle || seen.has(key)) continue;
    matches.push(item);
    seen.add(key);
    if (matches.length >= 15) break;
  }
  return matches;
}

/** The client does not get to assert people, organisation membership or animal IDs. */
export async function validateChatMentions(
  user: RescueHubUser, channelId: string, organisationId: string, text: string,
  proposed: unknown
): Promise<ChatMention[]> {
  if (proposed === undefined) return [];
  if (!Array.isArray(proposed) || proposed.length > 10)
    throw new ChatAccessError('Invalid chat mentions.');
  const normalized = usableChatMentions(text, proposed as ChatMention[]);
  if (normalized.length !== proposed.length)
    throw new ChatAccessError('Chat mentions must match the message text.');
  const directory = normalized.some(item => item.kind === 'person')
    ? await listChatDirectory(user, organisationId, channelId) : [];
  const people = new Map(directory.map(person => [person.id, person]));
  return Promise.all(normalized.map(async mention => {
    if (mention.kind === 'person') {
      const person = people.get(mention.id);
      if (!person || mentionHandle(person.name) !== mention.handle)
        throw new ChatAccessError('This person is not a member of this conversation.');
      return {kind:'person' as const,id:person.id,label:person.name,handle:mentionHandle(person.name)};
    }
    if (mention.kind === 'animal') {
      const animal = await getAnimal(mention.id);
      if (!animal || animal.organisationId !== organisationId || animal.registrationVoidedAt ||
          mentionHandle(animal.species) !== mention.handle)
        throw new ChatAccessError('This animal is unavailable in your organisation.');
      return {kind:'animal' as const,id:animal.id,rescueId:animal.rescueId,
        label:animal.species,handle:mentionHandle(animal.species)};
    }
    const rescue = await getRescue(mention.id);
    if (!rescue || rescue.organisationId !== organisationId)
      throw new ChatAccessError('This rescue is unavailable in your organisation.');
    const label = rescue.breed || rescue.type;
    if (mentionHandle(label) !== mention.handle)
      throw new ChatAccessError('This rescue mention no longer matches its record.');
    return {kind:'rescue' as const,id:rescue.id,rescueId:rescue.id,
      label,handle:mentionHandle(label)};
  }));
}
