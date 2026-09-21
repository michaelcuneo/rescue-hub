import { json } from '@sveltejs/kit';
import { setUserAvailability } from '$lib/server/auth';
import type { RequestHandler } from './$types';

const ALLOWED = new Set(['AVAILABLE', 'BUSY', 'OFFLINE']);

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) return json({ error: 'Authentication required.' }, { status: 401 });
	const body = (await request.json()) as { status?: string };
	if (!body.status || !ALLOWED.has(body.status)) {
		return json({ error: 'Choose AVAILABLE, BUSY or OFFLINE.' }, { status: 400 });
	}
	await setUserAvailability(locals.user.id, body.status as 'AVAILABLE' | 'BUSY' | 'OFFLINE');
	return json({ ok: true, status: body.status });
};
