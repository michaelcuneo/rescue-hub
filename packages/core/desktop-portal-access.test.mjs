import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mayUseDesktopPortal, desktopOperationsHref } from './desktop-portal-access.ts';

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


test('Operations opens an explicit Hunter organisation context for unaffiliated admins', () => {
  for (const role of ['PLATFORM_ADMIN', 'AUTHORITY_ADMIN']) {
    assert.equal(desktopOperationsHref({ roles: [role] }, false), '/demo/hunter');
    // Already in Hunter context, including on local development bootstrap:
    assert.equal(desktopOperationsHref({ roles: [role] }, true), '/');
  }
});

test('Operations stays on / for organisation members and does not elevate other roles', () => {
  const staff = { organisationId: 'org-1', roles: ['ORG_ADMIN'] };
  assert.equal(desktopOperationsHref(staff, false), '/');
  assert.equal(desktopOperationsHref({ ...staff, roles: ['PLATFORM_ADMIN'] }, false), '/');
  assert.equal(desktopOperationsHref({ roles: ['AUTHORITY_AUDITOR'] }, false), '/');
  assert.equal(desktopOperationsHref({ roles: ['PUBLIC_REPORTER', 'PLATFORM_ADMIN'] }, false), '/');
  assert.equal(desktopOperationsHref(null, false), '/');
});
