/** Consistent, accurate acknowledgements for administrative mutations.
 * Only a confirmed server success is ever described as complete.
 * An accepted invitation is not proof an email was delivered.
 */
export type FeedbackNotice = {
  kind: 'success' | 'warning' | 'error';
  title: string; message: string; detail?: string;
};
const completed: Record<string, [title: string, message: string]> = {
  inviteUser: ['Invitation submitted', 'The invitation was accepted for sending. Check its delivery status in People & access.'],
  inviteDemoReviewer: ['Reviewer invitation submitted', 'The invitation was queued for delivery. Check the email delivery status before assuming it arrived.'],
  resendInvitation: ['Invitation re-sent', 'A new invitation email was submitted. Delivery may still be pending.'],
  correctInvitationEmail: ['Invitation address updated', 'The corrected email address was saved and a new invitation submitted for delivery.'],
  addOrganisationPosition: ['Organisation position saved', 'The management position is now available to assign to members.'],
  deactivateOrganisationPosition: ['Organisation position disabled', 'The position is no longer available for new assignments.'],
  createVetClinic: ['Veterinary clinic registered', 'The clinic is available for verified handover and clinic-specific staff invitations.'],
  assignMemberPositions: ['Management positions saved', 'The member’s committee and management assignments have been updated.'],
  updateMemberPosition: ['Member position saved', 'The member’s title is updated in the directory.'],
  updateMemberAccess: ['Member permissions saved', 'System permissions, trained areas and transport eligibility have been updated.'],
  enableUser: ['Account enabled', 'The member can sign in again, subject to their assigned permissions.'],
  disableUser: ['Account disabled', 'The member’s account has been disabled.'],
  removeUser: ['Member removed', 'The member was removed from active access. Historical rescue records remain intact.'],
  resetPassword: ['Password reset requested', 'Password reset instructions were requested for this member.']
};
export function adminActionFeedback(form: {
  action?: string; success?: boolean; error?: string; devCode?: string;
}): FeedbackNotice {
  if (form.error) {
    return { kind: 'error', title: 'Could not complete the action', message: form.error };
  }
  if (!form.success) {
    return { kind: 'warning', title: 'Action not confirmed', message: 'The server did not confirm this change. Refresh the record before trying again.' };
  }
  const [title, message] = completed[form.action ?? ''] ??
    ['Changes saved', 'The administration update was saved.'];
  return { kind: 'success', title, message,
    ...(form.devCode ? { detail: `Development reset code: ${form.devCode}` } : {}) };
}
