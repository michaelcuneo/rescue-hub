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


/**
 * Opening Operations is a conscious organisation-context choice for a
 * platform/authority admin with no current organisation. Don't redirect
 * them back to Admin; use the already guarded Hunter demo context switch.
 * A development-bootstrap account already has a local demo context.
 */
export function desktopOperationsHref(
  user: DesktopPortalIdentity | null | undefined,
  hasHunterContext: boolean
): '/' | '/demo/hunter' {
  if (user && !user.organisationId && !hasHunterContext &&
      !user.roles.includes('PUBLIC_REPORTER') &&
      user.roles.some(role => role === 'PLATFORM_ADMIN' || role === 'AUTHORITY_ADMIN')) {
    return '/demo/hunter';
  }
  return '/';
}
