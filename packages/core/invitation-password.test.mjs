import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateInvitationPasswordConfirmation } from './invitation-password.ts';

test('identical passwords allow invitation activation', () => {
  assert.equal(validateInvitationPasswordConfirmation('correct horse battery', 'correct horse battery'), null);
});
test('typos, casing and spaces are not silently ignored', () => {
  assert.match(validateInvitationPasswordConfirmation('Password1234', 'Password1235'), /do not match/);
  assert.match(validateInvitationPasswordConfirmation('Password1234', 'password1234'), /do not match/);
  assert.match(validateInvitationPasswordConfirmation(' Password1234', 'Password1234'), /do not match/);
});
test('missing or blank confirmation is rejected', () => {
  assert.match(validateInvitationPasswordConfirmation('Password1234', ''), /do not match/);
  assert.match(validateInvitationPasswordConfirmation('', ''), /do not match/);
});
