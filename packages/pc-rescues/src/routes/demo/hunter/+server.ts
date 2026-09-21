import { redirect } from '@sveltejs/kit';
import { canUseHunterDemo, enterHunterDemo } from '$lib/server/demo';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, cookies }) => {
	if (!locals.user) throw redirect(303, '/login?next=/admin');
	if (!canUseHunterDemo(locals.user)) throw redirect(303, '/');
	enterHunterDemo(cookies);
	throw redirect(303, '/');
};
