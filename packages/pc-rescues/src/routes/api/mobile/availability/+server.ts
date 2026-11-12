import { json } from '@sveltejs/kit';
import { saveUserAvailabilityPolicy } from '$lib/server/auth';
import { defaultAvailabilityPolicy, effectiveAvailability, validateAvailabilityPolicy } from '$lib/server/availability';
import type { RequestHandler } from './$types';

function canManageRescuerFeatures(user: { organisationId?: string; enabled: boolean; status: string; roles: string[]; canTransport?: boolean } | null | undefined): user is NonNullable<typeof user> {
  return Boolean(user?.organisationId && user.enabled && user.status === 'ACTIVE' &&
    !user.roles.includes('PUBLIC_REPORTER'));
}


export const GET: RequestHandler = async ({ locals }) => {
	if (!canManageRescuerFeatures(locals.user)) return json({ error: 'Active organisation membership required.' }, { status: 403 });
	const policy = locals.user.availabilityPolicy ?? defaultAvailabilityPolicy(locals.user.availabilityStatus);
	return json({ policy, status: effectiveAvailability({ availabilityPolicy: policy }) }, { headers: { 'cache-control': 'no-store' } });
};

export const PUT: RequestHandler = async ({ locals, request }) => {
	if (!canManageRescuerFeatures(locals.user)) return json({ error: 'Rescue organisation membership required.' }, { status: 403 });
	try {
		const policy = validateAvailabilityPolicy(await request.json());
		const status = await saveUserAvailabilityPolicy(locals.user.id, policy);
		return json({ ok: true, policy, status });
	} catch (error) {
		return json({ error: error instanceof Error ? error.message : 'Unable to save availability.' }, { status: 400 });
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!canManageRescuerFeatures(locals.user)) return json({ error: 'Rescue organisation membership required.' }, { status: 403 });
	try {
		const body = await request.json() as { status?: 'AVAILABLE' | 'OFFLINE' | 'BUSY' };
		if (!['AVAILABLE', 'OFFLINE', 'BUSY'].includes(String(body.status))) {
			return json({ error: 'Choose AVAILABLE, BUSY or OFFLINE.' }, { status: 400 });
		}
		const policy = { ...(locals.user.availabilityPolicy ?? defaultAvailabilityPolicy(locals.user.availabilityStatus)),
			mode: body.status === 'AVAILABLE' ? 'ON' : body.status === 'BUSY' ? 'BUSY' : 'OFF' };
		const verified = validateAvailabilityPolicy(policy);
		const status = await saveUserAvailabilityPolicy(locals.user.id, verified);
		return json({ ok: true, policy: verified, status });
	} catch (error) {
		return json({ error: error instanceof Error ? error.message : 'Unable to update availability.' }, { status: 400 });
	}
};
