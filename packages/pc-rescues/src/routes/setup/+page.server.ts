import { fail, redirect } from '@sveltejs/kit';
import { bootstrapPlatformAdmin, hasCompletedBootstrap } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) throw redirect(303, locals.user.roles.includes('PLATFORM_ADMIN') ? '/admin' : '/');
	if (await hasCompletedBootstrap()) throw redirect(303, '/login');
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');

		try {
			await bootstrapPlatformAdmin({ name, email, password }, cookies);
		} catch (error) {
			return fail(400, { error: error instanceof Error ? error.message : 'Unable to initialise Rescue Hub.' });
		}

		throw redirect(303, '/admin');
	}
};
