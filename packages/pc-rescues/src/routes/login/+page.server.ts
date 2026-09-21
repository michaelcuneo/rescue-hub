import { fail, redirect } from '@sveltejs/kit';
import { hasCompletedBootstrap, loginUser } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!await hasCompletedBootstrap()) throw redirect(303, '/setup');
	if (locals.user) throw redirect(303, url.searchParams.get('next') || '/');
	return { next: url.searchParams.get('next') || '/' };
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const password = String(form.get('password') ?? '');

		try {
			await loginUser(email, password, cookies);
		} catch {
			return fail(401, { error: 'Invalid email or password.', email });
		}

		throw redirect(303, url.searchParams.get('next') || '/');
	}
};
