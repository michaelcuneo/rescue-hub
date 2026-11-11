import { fail, redirect } from '@sveltejs/kit';
import { HUNTER_DEMO_ORGANISATION } from '$lib/server/demo';
import {
	hasAdministrativeRole,
	hasCompletedBootstrap,
  correctPendingInvitationEmail,
	inviteUser,
	listUsers,
	removeUser,
	requestPasswordResetForUser,
	sendOrganisationInvitation,
	setUserEnabled,
	updateUserAccess,
	type RescueHubRole,
	type RescueHubUser
} from '$lib/server/auth';
import {
	listAdminAuditEvents,
	listAdminOrganisations,
	listAdminRescues
} from '$lib/server/admin-data';
import {
	getOrganisationMembershipConfig,
	STANDARD_MEMBERSHIP_TYPES,
	STANDARD_TEAMS
} from '$lib/server/membership';
import type { Actions, PageServerLoad } from './$types';
import { assignableStaffRoles, mayAssignStaffRole, mayManageStaffAccount } from '../../../../core/portal-admin-roles';

function requiredString(form: FormData, key: string) {
	const value = form.get(key);
	return typeof value === 'string' ? value.trim() : '';
}

function isAuthorityAdmin(user: RescueHubUser) {
	return user.roles.includes('PLATFORM_ADMIN') || user.roles.includes('AUTHORITY_ADMIN');
}

async function requireAdmin(locals: App.Locals) {
	if (!locals.user) {
		if (!await hasCompletedBootstrap()) throw redirect(303, '/setup');
		throw redirect(303, '/login?next=/admin');
	}
	if (!hasAdministrativeRole(locals.user)) throw redirect(303, '/');
	return locals.user;
}

function canManageUser(actor: RescueHubUser, target: RescueHubUser) {
	return mayManageStaffAccount(actor, target);
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = await requireAdmin(locals);

	const [organisationsResult, rescuesResult, usersResult, auditResult] = await Promise.allSettled([
		listAdminOrganisations(),
		listAdminRescues(),
		listUsers(),
		listAdminAuditEvents()
	]);

	let organisations =
		organisationsResult.status === 'fulfilled' ? organisationsResult.value : [];
	let rescues =
		rescuesResult.status === 'fulfilled' ? rescuesResult.value : [];
	const auditEvents =
		auditResult.status === 'fulfilled' ? auditResult.value : [];
	let users = usersResult.status === 'fulfilled' ? usersResult.value : [];

	const organisationIds = [...new Set(users.map((user) => user.organisationId).filter((id): id is string => Boolean(id)))];
	const membershipConfigs = Object.fromEntries(
		await Promise.all(
			organisationIds.map(async (organisationId) => [
				organisationId,
				await getOrganisationMembershipConfig(organisationId)
			] as const)
		)
	);

	if (!isAuthorityAdmin(actor)) {
		organisations = organisations.filter((organisation) => organisation.id === actor.organisationId);
		users = users.filter((user) => user.organisationId === actor.organisationId);
		rescues = rescues.filter((rescue) => rescue.organisationId === actor.organisationId);
	}

	const errors = [
		organisationsResult.status === 'rejected'
			? `Organisation directory: ${String(organisationsResult.reason)}`
			: null,
		rescuesResult.status === 'rejected'
			? `Rescue data: ${String(rescuesResult.reason)}`
			: null,
		usersResult.status === 'rejected'
			? `User directory: ${String(usersResult.reason)}`
			: null,
		auditResult.status === 'rejected'
			? `Audit data: ${String(auditResult.reason)}`
			: null
	].filter((value): value is string => Boolean(value));

	return {
		currentUser: actor,
		organisations,
		rescues,
		users,
		auditEvents,
		membershipConfigs,
		standardMembershipTypes: STANDARD_MEMBERSHIP_TYPES,
		standardTeams: STANDARD_TEAMS,
		assignableRoles: assignableStaffRoles(actor),
		backend: {
			online: errors.length === 0,
			errors
		}
	};
};

export const actions: Actions = {
	inviteDemoReviewer: async ({ request, locals }) => {
		const actor = await requireAdmin(locals);
		if (!actor.roles.includes('PLATFORM_ADMIN') && !actor.roles.includes('AUTHORITY_ADMIN')) {
			return fail(403, { action: 'inviteDemoReviewer', error: 'Platform administrator access required.' });
		}
		const form = await request.formData();
		const email = requiredString(form, 'email').toLowerCase();
		const name = requiredString(form, 'name') || 'DCCEEW Demo Reviewer';
		if (!/^\S+@\S+\.\S+$/.test(email)) {
			return fail(400, { action: 'inviteDemoReviewer', error: 'Enter a valid reviewer email.' });
		}
		try {
			await inviteUser({
				name, email, organisationId: HUNTER_DEMO_ORGANISATION,
				roles: ['DISPATCHER'], membershipTypeId: 'support-member', teamIds: []
			});
			return { action: 'inviteDemoReviewer', success: true };
		} catch (error) {
			return fail(400, { action: 'inviteDemoReviewer', error: error instanceof Error ? error.message : 'Unable to invite reviewer.' });
		}
	},
	inviteUser: async ({ request, locals }) => {
		const actor = await requireAdmin(locals);
		const form = await request.formData();
		const name = requiredString(form, 'name');
		const email = requiredString(form, 'email').toLowerCase();
		const requestedOrganisationId = requiredString(form, 'organisationId');
		const requestedRole = requiredString(form, 'role') as RescueHubRole;
		const membershipTypeId = requiredString(form, 'membershipTypeId') || 'active-rescuer';
		const teamIds = form.getAll('teamIds').map(String).filter(Boolean);

		const organisationId = isAuthorityAdmin(actor)
			? requestedOrganisationId
			: actor.organisationId ?? '';

		if (!name || !email || !email.includes('@') || !organisationId) {
			return fail(400, {
				action: 'inviteUser',
				error: 'Name, email and organisation are required.'
			});
		}

		if (!mayAssignStaffRole(actor, requestedRole)) {
			return fail(403, { action: 'inviteUser', error: 'You cannot grant that access role.' });
		}
		const membership = await getOrganisationMembershipConfig(organisationId);
		if (!membership.membershipTypes.some(type => type.id === membershipTypeId && type.active) ||
				teamIds.some(id => !membership.teams.some(team => team.id === id && team.active))) {
			return fail(400, { action: 'inviteUser', error: 'Choose active membership and dispatch teams for the selected organisation.' });
		}

		try {
			await inviteUser({
				name,
				email,
				organisationId,
				roles: [requestedRole],
				membershipTypeId,
				teamIds
			});
			return { action: 'inviteUser', success: true };
		} catch (error) {
			return fail(400, {
				action: 'inviteUser',
                email,
				error: error instanceof Error ? error.message : 'Unable to invite user.'
			});
		}
	},

	resendInvitation: async ({ request, locals }) => {
		const actor = await requireAdmin(locals);
		const form = await request.formData();
		const userId = requiredString(form, 'userId');
		const target = (await listUsers()).find(user => user.id === userId);
		if (!target || !canManageUser(actor, target)) {
			return fail(403, { action: 'resendInvitation', error: 'You cannot manage that account.' });
		}
		if (target.status !== 'INVITED' || !target.enabled) {
			return fail(400, { action: 'resendInvitation', error: 'This invitation is no longer pending.' });
		}
		try {
			await sendOrganisationInvitation(target.id);
			return { action: 'resendInvitation', userId, success: true };
		} catch (error) {
			return fail(400, {
				action: 'resendInvitation',
                userId,
				error: error instanceof Error ? error.message : 'Unable to resend invitation.'
			});
		}
	},
  correctInvitationEmail: async ({ request, locals }) => {
    const actor = await requireAdmin(locals);
    const form = await request.formData();
    const userId = requiredString(form, 'userId');
    const email = requiredString(form, 'email').toLowerCase();
    const target = (await listUsers()).find(user => user.id === userId);
    if (!target || !canManageUser(actor, target))
      return fail(403, { action: 'correctInvitationEmail', userId, error: 'You cannot manage this account.' });
    if (target.status !== 'INVITED' || !target.enabled || target.roles.includes('PUBLIC_REPORTER'))
      return fail(400, { action: 'correctInvitationEmail', userId, error: 'Only pending organisation invitations can have their email corrected.' });
    try {
      await correctPendingInvitationEmail(userId, email);
      return { action: 'correctInvitationEmail', userId, success: true };
    } catch (error) {
      return fail(400, { action: 'correctInvitationEmail', userId,
        error: error instanceof Error ? error.message : 'Could not correct invitation email.' });
    }
  },
	updateMemberAccess: async ({ request, locals }) => {
		const actor = await requireAdmin(locals);
		const form = await request.formData();
		const userId = requiredString(form, 'userId');
		const role = requiredString(form, 'role') as RescueHubRole;
		const membershipTypeId = requiredString(form, 'membershipTypeId');
		const teamIds = form.getAll('teamIds').map(String).filter(Boolean);
		// Read the current account on the server: never trust roles sent by the browser.
		const target = (await listUsers()).find(user => user.id === userId);
		if (!target || !canManageUser(actor, target)) {
			return fail(403, { action: 'updateMemberAccess', error: 'You cannot manage that account.' });
		}
		if (actor.id === target.id) {
			return fail(400, { action: 'updateMemberAccess', error: 'Change another administrator\'s account rather than your own access level.' });
		}
		if (!mayAssignStaffRole(actor, role)) {
			return fail(403, { action: 'updateMemberAccess', error: 'Only a platform administrator can grant platform administrator access.' });
		}
		if (!target.organisationId) {
			return fail(400, { action: 'updateMemberAccess', error: 'The account must belong to an organisation.' });
		}
		const config = await getOrganisationMembershipConfig(target.organisationId);
		if (!config.membershipTypes.some(type => type.id === membershipTypeId && type.active)) {
			return fail(400, { action: 'updateMemberAccess', error: 'Select an active operational membership.' });
		}
		if (teamIds.some(id => !config.teams.some(team => team.id === id && team.active))) {
			return fail(400, { action: 'updateMemberAccess', error: 'Invalid or inactive dispatch team selected.' });
		}
		try {
			await updateUserAccess({
				userId, expectedRoles: target.roles, role,
				membershipTypeId, teamIds
			});
			return { action: 'updateMemberAccess', success: true };
		} catch (error) {
			return fail(409, { action: 'updateMemberAccess', error: error instanceof Error ? error.message : 'Unable to update account access.' });
		}
	},

	disableUser: async ({ request, locals }) => {
		const actor = await requireAdmin(locals);
		const form = await request.formData();
		const userId = requiredString(form, 'userId');
		const target = (await listUsers()).find((user) => user.id === userId);
		if (!target || !canManageUser(actor, target)) {
			return fail(403, { action: 'disableUser', error: 'You cannot manage that user.' });
		}
		if (target.id === actor.id) {
			return fail(400, { action: 'disableUser', error: 'You cannot disable your own account.' });
		}
		await setUserEnabled(userId, false);
		return { action: 'disableUser', success: true };
	},

	enableUser: async ({ request, locals }) => {
		const actor = await requireAdmin(locals);
		const form = await request.formData();
		const userId = requiredString(form, 'userId');
		const target = (await listUsers()).find((user) => user.id === userId);
		if (!target || !canManageUser(actor, target)) {
			return fail(403, { action: 'enableUser', error: 'You cannot manage that user.' });
		}
		await setUserEnabled(userId, true);
		return { action: 'enableUser', success: true };
	},

	resetPassword: async ({ request, locals }) => {
		const actor = await requireAdmin(locals);
		const form = await request.formData();
		const userId = requiredString(form, 'userId');
		const target = (await listUsers()).find((user) => user.id === userId);
		if (!target || !canManageUser(actor, target)) {
			return fail(403, { action: 'resetPassword', error: 'You cannot manage that user.' });
		}
		const result = await requestPasswordResetForUser(userId);
		return {
			action: 'resetPassword',
			success: true,
			devCode: result.devCode
		};
	},

	removeUser: async ({ request, locals }) => {
		const actor = await requireAdmin(locals);
		const form = await request.formData();
		const userId = requiredString(form, 'userId');
		const target = (await listUsers()).find((user) => user.id === userId);
		if (!target || !canManageUser(actor, target)) {
			return fail(403, { action: 'removeUser', error: 'You cannot manage that user.' });
		}
		if (target.id === actor.id) {
			return fail(400, { action: 'removeUser', error: 'You cannot remove your own account.' });
		}
		await removeUser(userId);
		return { action: 'removeUser', success: true };
	}
};
