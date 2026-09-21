import { redirect } from '@sveltejs/kit';
import { hasCompletedBootstrap, listUsers } from '$lib/server/auth';
import { getHunterDemo, HUNTER_DEMO_ORGANISATION } from '$lib/server/demo';
import { getRescues } from '$lib/server/graphql';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	if (!await hasCompletedBootstrap()) throw redirect(303, '/setup');
	if (!locals.user) throw redirect(303, '/login');

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

	try {
		const [rescueResult, users] = await Promise.all([
			getRescues(undefined, 100),
			listUsers()
		]);

		return {
			user: demoMode
				? {
						...locals.user,
						organisationId: HUNTER_DEMO_ORGANISATION,
						roles: [...new Set([...locals.user.roles, 'DISPATCHER' as const])]
					}
				: locals.user,
			rescues: organisationId
				? rescueResult.items.filter((rescue) => rescue.organisationId === organisationId)
				: rescueResult.items,
			people: organisationId
				? users.filter((user) => user.organisationId === organisationId)
				: [],
			demoMode,
			backendOnline: true
		};
	} catch (error) {
		console.warn('Rescue Hub started without live rescue data.', error);
		return {
			user: locals.user,
			rescues: [],
			people: [],
			demoMode,
			backendOnline: false
		};
	}
};
