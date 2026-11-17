import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mayUseDesktopPortal } from './desktop-portal-access.ts';

test('organisation staff, including veterinary staff, can use desktop', () => {
  for (const role of ['RESCUER', 'DISPATCHER', 'ORG_ADMIN', 'VET_STAFF']) {
    assert.equal(mayUseDesktopPortal({ organisationId: 'org-1', roles: [role] }), true);
  }
});

test('authority and platform staff can use desktop without organisation membership', () => {
  for (const role of ['PLATFORM_ADMIN', 'AUTHORITY_ADMIN', 'AUTHORITY_AUDITOR']) {
    assert.equal(mayUseDesktopPortal({ roles: [role] }), true);
  }
});

test('public reporters cannot use desktop, even if mistakenly assigned another role', () => {
  assert.equal(mayUseDesktopPortal({ roles: ['PUBLIC_REPORTER'] }), false);
  assert.equal(mayUseDesktopPortal({ organisationId: 'org-1', roles: ['PUBLIC_REPORTER', 'RESCUER'] }), false);
});

test('unaffiliated and missing users cannot use desktop', () => {
  assert.equal(mayUseDesktopPortal(null), false);
  assert.equal(mayUseDesktopPortal({ roles: ['RESCUER'] }), false);
  assert.equal(mayUseDesktopPortal({ roles: [] }), false);
});
