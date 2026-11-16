import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminActionFeedback } from './admin-feedback.ts';

test('every admin action has clear, accurately described confirmation', () => {
  assert.match(adminActionFeedback({ action:'addOrganisationPosition', success:true }).message, /available to assign/);
  assert.match(adminActionFeedback({ action:'createVetClinic', success:true }).title, /Veterinary clinic registered/);
  assert.match(adminActionFeedback({ action:'inviteUser', success:true }).message, /accepted for sending/);
  assert.doesNotMatch(adminActionFeedback({ action:'inviteUser', success:true }).message, /delivered to recipient/);
  assert.equal(adminActionFeedback({ action:'removeUser', success:true }).kind,'success');
});
test('errors are never reported as successes and reset code is preserved', () => {
  const failure=adminActionFeedback({action:'inviteUser',error:'Email delivery unavailable.',success:false});
  assert.equal(failure.kind,'error');
  assert.equal(failure.message,'Email delivery unavailable.');
  assert.equal(adminActionFeedback({action:'resetPassword',success:true,devCode:'123456'}).detail,'Development reset code: 123456');
});
