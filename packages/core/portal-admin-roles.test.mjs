import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignableStaffRoles, mayManageStaffAccount, mayAssignStaffRole } from './portal-admin-roles.ts';

const base = { id: 'actor', organisationId: 'hunter', roles: ['ORG_ADMIN'] };
const chris = { id: 'chris', organisationId: 'hunter', roles: ['CARER'] };

test('only a platform admin may grant platform administrative access', () => {
  const platform = { ...base, roles: ['PLATFORM_ADMIN'] };
  const authority = { ...base, roles: ['AUTHORITY_ADMIN'] };
  assert.equal(mayAssignStaffRole(platform, 'PLATFORM_ADMIN'), true);
  assert.equal(mayAssignStaffRole(authority, 'PLATFORM_ADMIN'), false);
  assert.equal(mayAssignStaffRole(base, 'PLATFORM_ADMIN'), false);
  assert.equal(mayAssignStaffRole(base, 'ORG_ADMIN'), true);
  assert.equal(assignableStaffRoles({ ...base, roles: ['CARER'] }).length, 0);
});

test('organisation administrators cannot modify platform administrators', () => {
  assert.equal(mayManageStaffAccount(base, chris), true);
  assert.equal(mayManageStaffAccount(base, { ...chris, organisationId: 'other' }), false);
  assert.equal(mayManageStaffAccount(base, { ...chris, roles: ['PLATFORM_ADMIN'] }), false);
  assert.equal(mayManageStaffAccount({ ...base, roles: ['AUTHORITY_ADMIN'] }, { ...chris, roles: ['PLATFORM_ADMIN'] }), false);
  assert.equal(mayManageStaffAccount({ ...base, roles: ['AUTHORITY_ADMIN'] }, { ...chris, roles: ['AUTHORITY_ADMIN'] }), false);
  assert.equal(mayManageStaffAccount({ ...base, roles: ['PLATFORM_ADMIN'] }, { ...chris, roles: ['PLATFORM_ADMIN'] }), true);
});
