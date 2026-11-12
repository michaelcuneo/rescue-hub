import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  directChannelId, isDirectChatChannelId, canDirectChat, displayMemberLabels
} from './chat-direct.ts';

const member = (id, organisationId = 'hwr') => ({
  id, organisationId, enabled: true, status: 'ACTIVE',
  roles: ['CARER'], teamIds: ['raptors'], membershipTypeId: 'active-rescuer'
});

test('private chat identity is deterministic for either participant order', () => {
  const a = directChannelId('hwr', 'rescuer-1', 'carer-2');
  assert.equal(a, directChannelId('hwr', 'carer-2', 'rescuer-1'));
  assert.notEqual(a, directChannelId('another', 'carer-2', 'rescuer-1'));
  assert.ok(isDirectChatChannelId(a));
  assert.ok(!isDirectChatChannelId('qa'));
  assert.ok(!isDirectChatChannelId('dm-invalid'));
  assert.throws(() => directChannelId('hwr', 'same', 'same'));
});

test('only two distinct active members of the same organisation can message', () => {
  const sender = member('a'), recipient = member('b');
  assert.equal(canDirectChat(sender, recipient), true);
  assert.equal(canDirectChat(sender, member('b', 'other-org')), false);
  assert.equal(canDirectChat(sender, member('a')), false);
  assert.equal(canDirectChat(sender, { ...recipient, enabled:false }), false);
  assert.equal(canDirectChat(sender, { ...recipient, status:'INVITED' }), false);
  assert.equal(canDirectChat(sender, { ...recipient, roles:['PUBLIC_REPORTER'] }), false);
});

test('member display combines distinct organisation title, roles and teams', () => {
  const labels = displayMemberLabels(
    { ...member('b'), positionTitle:'Raptor Leader' },
    new Map([['active-rescuer','Active rescuer']]),
    new Map([['raptors','Raptors']])
  );
  assert.deepEqual(labels, ['Raptor Leader', 'Active rescuer', 'Carer', 'Raptors']);
});
