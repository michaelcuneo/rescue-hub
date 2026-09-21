import { json } from '@sveltejs/kit';
import { requestPasswordReset } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const input = await request.json() as { email?: string };
		if (!input.email) return json({ error: 'Email is required.' }, { status: 400 });
		return json(await requestPasswordReset(input.email));
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unable to request password reset.';
		return json({ error: message }, { status: message.includes('wait a minute') ? 429 : 400 });
	}
};
