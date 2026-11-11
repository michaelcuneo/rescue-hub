import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canSeeDesktopRescue } from './desktop-dispatch-access.ts';

const member = {
  id: 'chris', organisationId: 'hunter', enabled: true, status: 'ACTIVE',
  roles: ['CARER'], membershipTypeId: 'active-rescuer',
  teamIds: ['reptile-venomous', 'reptile-non-venomous']
};
const base = { organisationId: 'hunter', status: 'PENDING', assignedUserId: null };

test('field carer sees only pending jobs matching their assigned rescue teams', () => {
  assert.equal(canSeeDesktopRescue(member, base, true), true);
  assert.equal(canSeeDesktopRescue(member, base, false), false);
  assert.equal(canSeeDesktopRescue(member, { ...base, transportAnimalId: 'animal1' }, false), true);
  assert.equal(canSeeDesktopRescue(member, { ...base, transportAnimalId: 'animal1', awaitingCarer: true }, true), false);
  assert.equal(canSeeDesktopRescue(member, { ...base, assignedUserId: 'another' }, true), false);
  assert.equal(canSeeDesktopRescue(member, { ...base, organisationId: 'other' }, true), false);
});

test('volunteer sees only own assigned and completed history, never colleagues cases', () => {
  for (const status of ['ASSIGNED', 'COMPLETED']) {
    assert.equal(canSeeDesktopRescue(member, { ...base, status, assignedUserId: 'chris' }, false), true);
    assert.equal(canSeeDesktopRescue(member, { ...base, status, assignedUserId: 'somebody-else' }, true), false);
  }
  assert.equal(canSeeDesktopRescue(member, { ...base, status: 'CANCELLED', assignedUserId: 'chris' }, false), false);
});

test('coordinators see their organisation and still cannot see other organisations', () => {
  const dispatcher = { ...member, roles: ['DISPATCHER'], membershipTypeId: 'support-member' };
  assert.equal(canSeeDesktopRescue(dispatcher, { ...base, status: 'COMPLETED', assignedUserId: 'another' }, false), true);
  assert.equal(canSeeDesktopRescue(dispatcher, { ...base, organisationId: 'other' }, true), false);
});

test('inactive or unsupported membership cannot see rescue offers', () => {
  assert.equal(canSeeDesktopRescue({ ...member, enabled: false }, base, true), false);
  assert.equal(canSeeDesktopRescue({ ...member, status: 'INVITED' }, base, true), false);
  assert.equal(canSeeDesktopRescue({ ...member, membershipTypeId: 'carer' }, base, true), false);
  assert.equal(canSeeDesktopRescue({ ...member, membershipTypeId: 'support-member' }, base, true), false);
  assert.equal(canSeeDesktopRescue({ ...member, membershipTypeId: 'probationary-rescuer' }, base, true), false);
  assert.equal(canSeeDesktopRescue({ ...member, membershipTypeId: 'transport-volunteer' }, base, true), false);
  assert.equal(canSeeDesktopRescue({ ...member, membershipTypeId: 'transport-volunteer' }, { ...base, transportAnimalId: 'animal1' }, false), true);
});
