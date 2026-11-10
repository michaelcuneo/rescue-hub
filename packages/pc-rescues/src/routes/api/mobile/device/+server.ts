import { json } from '@sveltejs/kit';
import { getPushDeviceRegistrationCount, registerPushDevice } from '$lib/server/push';
import type { RequestHandler } from './$types';

function canManageRescuerFeatures(user: { organisationId?: string; enabled: boolean; status: string; roles: string[] } | null | undefined) {
  return Boolean(user?.organisationId && user.enabled && user.status === 'ACTIVE' &&
    user.roles.some(role => ['RESCUER', 'CARER', 'ORG_ADMIN', 'DISPATCHER'].includes(role)));
}


export const POST: RequestHandler = async ({ locals, request }) => {
	if (!canManageRescuerFeatures(locals.user)) return json({ error: 'Rescue organisation membership required.' }, { status: 403 });
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

export const GET: RequestHandler = async ({ locals }) => {
  if (!canManageRescuerFeatures(locals.user)) return json({ error: 'Rescue organisation membership required.' }, { status: 403 });
  const registeredDevices = await getPushDeviceRegistrationCount(locals.user.id);
  return json({ registeredDevices }, { headers: { 'cache-control': 'private, no-store' } });
};
