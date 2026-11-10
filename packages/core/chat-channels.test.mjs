import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChatChannels, canAccessChat, visibleChatChannels, validateChatText,
  relatedAnimalChannel, isValidChatChannelId
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
