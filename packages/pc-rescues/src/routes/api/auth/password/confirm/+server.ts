import { json } from '@sveltejs/kit';
import { resetPassword } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const input = await request.json() as {
			email?: string;
			code?: string;
			password?: string;
			mobile?: boolean;
		};
		const result = await resetPassword(
			input.email ?? '',
			input.code ?? '',
			input.password ?? '',
			input.mobile ? undefined : cookies
		);
		return json({
			user: result.user,
			...(input.mobile ? { sessionToken: result.sessionToken } : {})
		});
	} catch (error) {
		return json(
			{ error: error instanceof Error ? error.message : 'Unable to reset password.' },
			{ status: 400 }
		);
	}
};
