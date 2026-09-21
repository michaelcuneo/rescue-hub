import { redirect } from '@sveltejs/kit';
import { exitHunterDemo } from '$lib/server/demo';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	exitHunterDemo(cookies);
	throw redirect(303, '/admin');
};
