export const STAFF_ROLES = [
  'RESCUER', 'CARER', 'DISPATCHER', 'ORG_ADMIN', 'DATA_STEWARD',
  'AUTHORITY_AUDITOR', 'AUTHORITY_ADMIN', 'PLATFORM_ADMIN'
] as const;

type AccessUser = {
  id: string;
  organisationId?: string;
  roles: readonly string[];
};

export function assignableStaffRoles(actor: AccessUser): string[] {
  if (actor.roles.includes('PLATFORM_ADMIN')) return [...STAFF_ROLES];
  if (actor.roles.includes('AUTHORITY_ADMIN')) return STAFF_ROLES.filter(role =>
    role !== 'PLATFORM_ADMIN' && role !== 'AUTHORITY_ADMIN'
  );
  if (actor.roles.includes('ORG_ADMIN')) return STAFF_ROLES.filter(role =>
    ['RESCUER', 'CARER', 'DISPATCHER', 'ORG_ADMIN', 'DATA_STEWARD'].includes(role)
  );
  return [];
}

/** Never let an organisation admin modify higher-trust authority accounts.
 * Only platform admins may administer another platform admin.
 */
export function mayManageStaffAccount(actor: AccessUser, target: AccessUser): boolean {
  if (actor.roles.includes('PLATFORM_ADMIN')) return true;
  if (target.roles.includes('PLATFORM_ADMIN')) return false;
  if (actor.roles.includes('AUTHORITY_ADMIN')) return true;
  if (target.roles.some(role => ['AUTHORITY_ADMIN', 'AUTHORITY_AUDITOR'].includes(role))) return false;
  return actor.roles.includes('ORG_ADMIN') &&
    !!actor.organisationId && actor.organisationId === target.organisationId;
}

export function mayAssignStaffRole(actor: AccessUser, targetRole: string): boolean {
  return assignableStaffRoles(actor).includes(targetRole);
}
