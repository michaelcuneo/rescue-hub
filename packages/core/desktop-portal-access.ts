/**
 * Browser access is for rescue organisation members and authority/platform staff.
 * Public reporters (whether verified or still invited) use the mobile app.
 */
export type DesktopPortalIdentity = {
  organisationId?: string;
  roles: readonly string[];
};

export function mayUseDesktopPortal(user: DesktopPortalIdentity | null | undefined): boolean {
  if (!user || user.roles.includes('PUBLIC_REPORTER')) return false;
  return Boolean(user.organisationId ||
    user.roles.some(role => ['PLATFORM_ADMIN', 'AUTHORITY_ADMIN', 'AUTHORITY_AUDITOR'].includes(role)));
}
