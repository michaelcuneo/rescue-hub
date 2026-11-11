import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChatChannels, canAccessChat, visibleChatChannels, validateChatText,
  relatedAnimalChannel, isValidChatChannelId, isPlatformOversightUser, canSelectChatOrganisation
} from './chat-channels.ts';
const teams = [
  { id: 'reptile-non-venomous', name: 'Reptile carers', capabilityCode: 'REPTILE_NON_VENOMOUS', active: true },
  { id: 'reptile-venomous', name: 'Venomous reptiles', capabilityCode: 'REPTILE_VENOMOUS', active: true },
  { id: 'bird', name: 'Bird carers', capabilityCode: 'BIRD', active: true },
  { id: 'local-koalas', name: 'Koalas', active: true },
  { id: 'old-team', name: 'Retired', active: false }
];
const user = { enabled: true, status: 'ACTIVE', organisationId: 'natf',
  roles: ['CARER'], teamIds: ['reptile-non-venomous'] };
test('standard and care-group channels are built from active organisation teams', () => {
  const channels = buildChatChannels(teams);
  assert.deepEqual(channels.slice(0,3).map(c => c.id), ['administration','qa','trading-post']);
  assert.deepEqual(channels.find(c => c.id === 'reptiles')?.teamIds,
    ['reptile-non-venomous','reptile-venomous']);
  assert.ok(channels.some(c=>c.id==='team-local-koalas'));
  assert.ok(!channels.some(c=>c.id==='team-old-team'));
});
test('Michael in reptile team sees reptile, Q&A and trading chats, not unrelated groups or admin', () => {
  const visible = visibleChatChannels(user, teams).map(c => c.id);
  assert.deepEqual(visible,['qa','trading-post','reptiles']);
});
test('organisation coordinators can access Administration and specialist channels', () => {
  const admin = { ...user, roles:['ORG_ADMIN'], teamIds:[] };
  const channels = visibleChatChannels(admin, teams).map(c=>c.id);
  assert.ok(channels.includes('administration') && channels.includes('reptiles'));
});
test('disabled users, public reporters, and removed volunteers cannot access chat', () => {
  const channel=buildChatChannels(teams).find(c=>c.id==='qa');
  for (const subject of [{...user,enabled:false},{...user,status:'REMOVED'},
    {...user, roles:['PUBLIC_REPORTER']},{...user,organisationId:undefined}])
    assert.equal(canAccessChat(subject,channel),false);
});
test('message validation prevents empty, oversized, control character payloads', () => {
  assert.equal(validateChatText('  Hello Reptiles!  '),'Hello Reptiles!');
  for(const input of ['', ' ', 10, 'x'.repeat(2001), 'contains\u0000null'])
    assert.throws(()=>validateChatText(input));
});
test('reptile pickup links to Reptiles, unknown animal falls back to Q&A', () => {
  assert.equal(relatedAnimalChannel('Eastern Water Dragon',teams),'reptiles');
  assert.equal(relatedAnimalChannel('Unknown wildlife',teams),'qa');
  assert.ok(isValidChatChannelId('reptiles'));
  assert.ok(!isValidChatChannelId('../other-org'));
});

test('real platform administrator with no organisation sees all channels in selected organisation', () => {
  const platform = { enabled: true, status: 'ACTIVE', roles:['PLATFORM_ADMIN'], teamIds:[] };
  assert.equal(isPlatformOversightUser(platform), true);
  assert.equal(canSelectChatOrganisation(platform, 'native-animal-trust-fund'), true);
  const scoped = { ...platform, organisationId:'native-animal-trust-fund' };
  const permitted = visibleChatChannels(scoped, teams).map(channel=>channel.id);
  assert.ok(permitted.includes('administration'));
  assert.ok(permitted.includes('reptiles'));
  assert.ok(permitted.includes('qa'));
  assert.ok(permitted.includes('trading-post'));
});
test('platform oversight requires active authenticated privileged role', () => {
  for (const candidate of [
    { ...user, roles:['CARER'], organisationId:undefined },
    { ...user, roles:['PUBLIC_REPORTER'] },
    { ...user, roles:['PLATFORM_ADMIN'], enabled:false },
    { ...user, roles:['PLATFORM_ADMIN'], status:'REMOVED' }
  ]) {
    assert.equal(isPlatformOversightUser(candidate), false);
    assert.equal(canSelectChatOrganisation(candidate, 'another-organisation'), false);
  }
});
test('ordinary member cannot select another organisation, even with admin role in own organisation', () => {
  assert.equal(canSelectChatOrganisation(user, 'natf'), true);
  assert.equal(canSelectChatOrganisation(user, 'wires'), false);
  assert.equal(canSelectChatOrganisation({...user,roles:['ORG_ADMIN']}, 'wires'), false);
});
