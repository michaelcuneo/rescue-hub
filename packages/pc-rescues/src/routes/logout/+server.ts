import { redirect } from '@sveltejs/kit';
import { logoutUser } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, request }) => {
	await logoutUser(cookies, request.headers.get('authorization'));
	throw redirect(303, '/login');
};
