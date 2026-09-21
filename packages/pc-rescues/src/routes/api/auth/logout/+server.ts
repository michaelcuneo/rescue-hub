import { json } from '@sveltejs/kit';
import { logoutUser } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, request }) => {
	await logoutUser(cookies, request.headers.get('authorization'));
	return json({ ok: true });
};
