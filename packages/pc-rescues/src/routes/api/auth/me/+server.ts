import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	return locals.user
		? json({ user: locals.user })
		: json({ error: 'Not authenticated.' }, { status: 401 });
};
