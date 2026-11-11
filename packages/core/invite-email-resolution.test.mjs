import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveInviteLookup, inviteLookupExplanation } from './invite-email-resolution.ts';
const active = { status:'ACTIVE', enabled:true, organisationId:'org-1', roles:['RESCUER'] };
test('removed person can be invited with the same email without reviving their old account', () => {
  assert.equal(resolveInviteLookup(true,{ ...active,status:'REMOVED',enabled:false },'org-1'),'RECLAIM_REMOVED');
  assert.equal(resolveInviteLookup(true,null,'org-1'),'RECLAIM_ORPHAN');
  assert.equal(resolveInviteLookup(false,null,'org-1'),'CREATE');
});
test('same-organisation pending invitation is reusable, never a second identity', () => {
  const invited={ ...active,status:'INVITED' };
  assert.equal(resolveInviteLookup(true,invited,'org-1'),'REUSE_INVITATION');
  assert.equal(resolveInviteLookup(true,{...invited,enabled:false},'org-1'),'PENDING_DISABLED');
  assert.equal(resolveInviteLookup(true,invited,'org-2'),'PENDING_OTHER_ORG');
});
test('active accounts, reporter accounts and other organisation members are protected', () => {
  assert.equal(resolveInviteLookup(true,active,'org-1'),'ALREADY_MEMBER');
  assert.equal(resolveInviteLookup(true,active,'org-2'),'ACTIVE_OTHER_ORG');
  assert.equal(resolveInviteLookup(true,{...active,enabled:false},'org-1'),'ACTIVE_DISABLED');
  assert.equal(resolveInviteLookup(true,{...active,roles:['PUBLIC_REPORTER']},'org-1'),'EXISTING_REPORTER');
  assert.match(inviteLookupExplanation('ACTIVE_OTHER_ORG'),/transfer/);
  assert.match(inviteLookupExplanation('EXISTING_REPORTER'),/cannot be silently upgraded/);
});
