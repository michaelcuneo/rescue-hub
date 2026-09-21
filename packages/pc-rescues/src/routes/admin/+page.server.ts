import { fail, redirect } from '@sveltejs/kit';
import {
	hasAdministrativeRole,
	hasCompletedBootstrap,
	inviteUser,
	listUsers,
	removeUser,
	requestPasswordResetForUser,
	setUserEnabled,
	updateUserDispatchMembership,
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

const ORGANISATION_ROLES: RescueHubRole[] = [
	'ORG_ADMIN',
	'DISPATCHER',
	'RESCUER',
	'CARER',
	'DATA_STEWARD'
];

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
	if (isAuthorityAdmin(actor)) return true;
	return actor.roles.includes('ORG_ADMIN') &&
		Boolean(actor.organisationId) &&
		actor.organisationId === target.organisationId;
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
		backend: {
			online: errors.length === 0,
			errors
		}
	};
};

export const actions: Actions = {
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

		if (!ORGANISATION_ROLES.includes(requestedRole)) {
			return fail(400, { action: 'inviteUser', error: 'Choose a valid organisation role.' });
		}

		try {
			const result = await inviteUser({
				name,
				email,
				organisationId,
				roles: [requestedRole],
				membershipTypeId,
				teamIds
			});
			return {
				action: 'inviteUser',
				success: true,
				devCode: result.invitation.devCode
			};
		} catch (error) {
			return fail(500, {
				action: 'inviteUser',
				error: error instanceof Error ? error.message : 'Unable to invite user.'
			});
		}
	},

	updateDispatchMembership: async ({ request, locals }) => {
		const actor = await requireAdmin(locals);
		const form = await request.formData();
		const userId = requiredString(form, 'userId');
		const membershipTypeId = requiredString(form, 'membershipTypeId');
		const teamIds = form.getAll('teamIds').map(String).filter(Boolean);
		const target = (await listUsers()).find((user) => user.id === userId);

		if (!target || !canManageUser(actor, target)) {
			return fail(403, { action: 'updateDispatchMembership', error: 'You cannot manage that user.' });
		}
		if (!membershipTypeId) {
			return fail(400, { action: 'updateDispatchMembership', error: 'Choose a membership type.' });
		}

		await updateUserDispatchMembership({ userId, membershipTypeId, teamIds });
		return { action: 'updateDispatchMembership', success: true };
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
