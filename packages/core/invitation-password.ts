/** Keep the two password fields identical before an invitation is consumed.
 * Length and other password rules remain enforced by the existing auth service.
 */
export function validateInvitationPasswordConfirmation(
  password: string,
  confirmation: string
): string | null {
  if (!password || !confirmation || password !== confirmation) {
    return 'Passwords do not match. Enter the same password in both fields.';
  }
  return null;
}
