import { redirect } from '@sveltejs/kit';
import { hasCompletedBootstrap } from '$lib/server/auth';
import { getRescues } from '$lib/server/graphql';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!await hasCompletedBootstrap()) throw redirect(303, '/setup');
	if (!locals.user) throw redirect(303, '/login');

	if (
		!locals.user.organisationId &&
		(locals.user.roles.includes('PLATFORM_ADMIN') || locals.user.roles.includes('AUTHORITY_ADMIN'))
	) {
		throw redirect(303, '/admin');
	}

	try {
		const result = await getRescues(undefined, 100);

		return {
			user: locals.user,
			rescues: result.items,
			backendOnline: true
		};
	} catch (error) {
		console.warn('Rescue Hub started without live rescue data.', error);

		return {
			user: locals.user,
			rescues: [],
			backendOnline: false
		};
	}
};
