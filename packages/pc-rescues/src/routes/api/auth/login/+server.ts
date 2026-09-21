import { json } from '@sveltejs/kit';
import { loginUser } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const input = await request.json() as { email?: string; password?: string; mobile?: boolean };
		const result = await loginUser(input.email ?? '', input.password ?? '', input.mobile ? undefined : cookies);
		return json({
			user: result.user,
			...(input.mobile ? { sessionToken: result.sessionToken } : {})
		});
	} catch {
		return json({ error: 'Invalid email or password.' }, { status: 401 });
	}
};
