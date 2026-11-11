import { redirect } from '@sveltejs/kit';
import { hasCompletedBootstrap, listUsers } from '$lib/server/auth';
import { getHunterDemo, HUNTER_DEMO_ORGANISATION } from '$lib/server/demo';
import { listAdminRescues } from '$lib/server/admin-data';
import { classifyDispatchCapability, getOrganisationMembershipConfig, memberCanReceiveCapability } from '$lib/server/membership';
import { canSeeDesktopRescue } from '../../../core/desktop-dispatch-access';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	if (!await hasCompletedBootstrap()) throw redirect(303, '/setup');
	if (!locals.user) throw redirect(303, '/login');
	if (locals.user.roles.includes('PUBLIC_REPORTER')) throw redirect(303, '/report');

	const demoMode = getHunterDemo(cookies, locals.user);
	const organisationId = demoMode
		? HUNTER_DEMO_ORGANISATION
		: locals.user.organisationId;

	if (
		!organisationId &&
		(locals.user.roles.includes('PLATFORM_ADMIN') || locals.user.roles.includes('AUTHORITY_ADMIN'))
	) {
		throw redirect(303, '/admin');
	}

	const viewer = demoMode ? {
		...locals.user,
		organisationId: HUNTER_DEMO_ORGANISATION,
		roles: [...new Set([...locals.user.roles, 'DISPATCHER' as const])]
	} : locals.user;
	const canCoordinate = viewer.roles.some(role =>
		['PLATFORM_ADMIN', 'AUTHORITY_ADMIN', 'ORG_ADMIN', 'DISPATCHER'].includes(role));
	const [rescueResult, usersResult] = await Promise.allSettled([
		listAdminRescues(),
		canCoordinate ? listUsers() : Promise.resolve([])
	]);
	if (rescueResult.status === 'rejected') console.error('Unable to load rescue queue.', rescueResult.reason);
	if (usersResult.status === 'rejected') console.error('Unable to load rescue people.', usersResult.reason);
	const rescues = rescueResult.status === 'fulfilled' ? rescueResult.value : [];
	const users = usersResult.status === 'fulfilled' ? usersResult.value : [];
	const membershipConfig = await getOrganisationMembershipConfig(organisationId ?? HUNTER_DEMO_ORGANISATION);
	const visibleRescues = rescues.filter((rescue) => canSeeDesktopRescue(
		viewer, rescue,
		memberCanReceiveCapability(
			viewer.teamIds, membershipConfig,
			classifyDispatchCapability(rescue.type, rescue.breed ?? '')
		)
	));
	return {
        membershipConfig,
		user: viewer,
		rescues: visibleRescues,
		people: organisationId
			? users.filter((user) => user.organisationId === organisationId)
			: [],
		demoMode,
		backendOnline: rescueResult.status === 'fulfilled'
	};
};
