import { fail, redirect } from '@sveltejs/kit';
import { requestPasswordReset, resetPassword } from '$lib/server/auth';
import type { Actions } from './$types';

export const actions: Actions = {
	request: async ({ request }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		if (!email) return fail(400, { mode: 'request', error: 'Email is required.' });

		try {
			const result = await requestPasswordReset(email);
			return { mode: 'confirm', email, devCode: result.devCode };
		} catch (error) {
			return fail(400, { mode: 'request', error: error instanceof Error ? error.message : 'Unable to request reset.' });
		}
	},
	confirm: async ({ request, cookies }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const code = String(form.get('code') ?? '');
		const password = String(form.get('password') ?? '');

		try {
			await resetPassword(email, code, password, cookies);
		} catch (error) {
			return fail(400, { mode: 'confirm', email, error: error instanceof Error ? error.message : 'Unable to reset password.' });
		}

		throw redirect(303, '/');
	}
};
