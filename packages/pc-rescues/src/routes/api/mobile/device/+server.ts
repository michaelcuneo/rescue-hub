import { json } from '@sveltejs/kit';
import { registerPushDevice } from '$lib/server/push';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) return json({ error: 'Authentication required.' }, { status: 401 });
	const body = (await request.json()) as {
		pushToken?: string;
		platform?: 'ios' | 'android';
		deviceName?: string;
	};
	if (!body.pushToken || !body.platform) {
		return json({ error: 'Push token and platform are required.' }, { status: 400 });
	}
	try {
		await registerPushDevice({
			userId: locals.user.id,
			pushToken: body.pushToken,
			platform: body.platform,
			deviceName: body.deviceName
		});
		return json({ ok: true });
	} catch (error) {
		return json({ error: error instanceof Error ? error.message : 'Unable to register device.' }, { status: 400 });
	}
};
