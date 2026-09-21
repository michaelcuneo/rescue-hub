import { fail, redirect } from '@sveltejs/kit';
import { acceptInvite } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) throw redirect(303, '/');
	return { email: url.searchParams.get('email') ?? '' };
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const code = String(form.get('code') ?? '');
		const password = String(form.get('password') ?? '');

		try {
			await acceptInvite(email, code, password, cookies);
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Unable to activate invitation.',
				email
			});
		}

		throw redirect(303, '/');
	}
};
