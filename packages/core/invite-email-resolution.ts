/** Categorise existing email identities before an administrator invites someone.
 * Removed profiles may release their email without reviving their credentials.
 * An active account or public reporter must never be silently re-privileged.
 */
export type InviteLookupAccount = {
  status: 'INVITED' | 'ACTIVE' | 'REMOVED';
  enabled: boolean;
  organisationId?: string | null;
  roles: readonly string[];
};
export type InviteLookupAction =
  'CREATE'|'RECLAIM_REMOVED'|'RECLAIM_ORPHAN'|'REUSE_INVITATION'|
  'PENDING_DISABLED'|'PENDING_OTHER_ORG'|'ALREADY_MEMBER'|
  'ACTIVE_DISABLED'|'ACTIVE_OTHER_ORG'|'EXISTING_REPORTER';
export function resolveInviteLookup(
  hasEmailLookup: boolean,
  account: InviteLookupAccount | null,
  requestedOrganisationId: string
): InviteLookupAction {
  if (!hasEmailLookup) return 'CREATE';
  if (!account) return 'RECLAIM_ORPHAN';
  if (account.status === 'REMOVED') return 'RECLAIM_REMOVED';
  if (account.roles.includes('PUBLIC_REPORTER')) return 'EXISTING_REPORTER';
  if (account.status === 'INVITED') {
    if (account.organisationId !== requestedOrganisationId) return 'PENDING_OTHER_ORG';
    return account.enabled ? 'REUSE_INVITATION' : 'PENDING_DISABLED';
  }
  if (!account.enabled) return 'ACTIVE_DISABLED';
  return account.organisationId === requestedOrganisationId ? 'ALREADY_MEMBER' : 'ACTIVE_OTHER_ORG';
}
export function inviteLookupExplanation(action: InviteLookupAction): string {
  switch (action) {
    case 'PENDING_DISABLED':
      return 'This email has a disabled pending invitation. Re-enable the person in People & Access before resending.';
    case 'PENDING_OTHER_ORG':
      return 'This email has a pending invitation for another organisation. An administrator must resolve that invitation before assigning a different organisation.';
    case 'ALREADY_MEMBER':
      return 'This person already has an active account in this organisation. Open People & Access to manage their access instead of inviting them again.';
    case 'ACTIVE_DISABLED':
      return 'This email belongs to a disabled account. Re-enable or review it in People & Access rather than creating a duplicate.';
    case 'ACTIVE_OTHER_ORG':
      return 'This email belongs to an active account in another organisation. An authorised account transfer is required; no second account was created.';
    case 'EXISTING_REPORTER':
      return 'This email already belongs to a public reporter account. Reporter accounts cannot be silently upgraded to rescue access; use an authorised membership upgrade.';
    default: return '';
  }
}
