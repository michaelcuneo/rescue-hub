import { json } from '@sveltejs/kit';
import { createRescue } from '$lib/server/graphql';
import { getHunterDemo, HUNTER_DEMO_ORGANISATION } from '$lib/server/demo';
import { notifyEligibleRescuers } from '$lib/server/push';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, cookies }) => {
	if (!locals.user) {
		return json({ error: 'Authentication required.' }, { status: 401 });
	}

	const demoMode = getHunterDemo(cookies, locals.user);
	const organisationId = demoMode
		? HUNTER_DEMO_ORGANISATION
		: locals.user.organisationId;

	if (!organisationId) {
		return json({ error: 'An operational organisation is required.' }, { status: 403 });
	}
	const body = (await request.json()) as {
		type?: string;
		breed?: string;
		location?: string;
		latitude?: number;
		longitude?: number;
		injury?: string;
	};

	const type = body.type?.trim();
	const latitude = Number(body.latitude);
	const longitude = Number(body.longitude);

	if (!type) {
		return json({ error: 'Animal type is required.' }, { status: 400 });
	}

	if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
		return json({ error: 'A rescue location is required.' }, { status: 400 });
	}

	try {
		const rescue = await createRescue({
			id: crypto.randomUUID(),
			organisationId,
			type,
			breed: body.breed?.trim() || undefined,
			location: body.location?.trim() || undefined,
			latitude,
			longitude,
			injury: body.injury?.trim() || undefined,
			status: 'PENDING'
		});

		await notifyEligibleRescuers({
			id: rescue.id,
			organisationId,
			type: rescue.type,
			breed: rescue.breed ?? undefined,
			location: rescue.location ?? undefined,
			injury: rescue.injury ?? undefined
		}).catch((error) => {
			console.error('Unable to deliver rescue push notifications.', error);
		});

		return json({ rescue }, { status: 201 });
	} catch (error) {
		console.error('Unable to create rescue.', error);

		return json(
			{
				error: error instanceof Error ? error.message : 'Unable to create rescue.'
			},
			{ status: 503 }
		);
	}
};

export const PATCH: RequestHandler = async ({ request, locals, cookies }) => {
	if (!locals.user) return json({ error: 'Authentication required.' }, { status: 401 });
	const demoMode = getHunterDemo(cookies, locals.user);
	const organisationId = demoMode ? HUNTER_DEMO_ORGANISATION : locals.user.organisationId;
	if (!organisationId || !locals.user.roles.some((role) =>
		['PLATFORM_ADMIN', 'AUTHORITY_ADMIN', 'ORG_ADMIN', 'DISPATCHER'].includes(role)
	)) return json({ error: 'Dispatcher access required.' }, { status: 403 });

	const body = (await request.json()) as { id?: string; status?: string; userId?: string };
	if (!body.id || (body.status !== undefined && !['PENDING', 'ASSIGNED', 'COMPLETED'].includes(body.status))) {
		return json({ error: 'Invalid rescue update.' }, { status: 400 });
	}
	try {
		const { getRescue, assignRescue, updateRescueStatus } = await import('$lib/server/graphql');
		const existing = await getRescue(body.id);
		if (!existing || existing.organisationId !== organisationId) {
			return json({ error: 'Rescue not found in your organisation.' }, { status: 404 });
		}
		if (body.userId) {
			const { listUsers } = await import('$lib/server/auth');
			const users = await listUsers();
			const rescuer = users.find((user) => user.id === body.userId &&
				user.organisationId === organisationId && user.roles.some((role) => ['RESCUER', 'CARER'].includes(role)));
			if (!rescuer) return json({ error: 'Eligible rescuer not found.' }, { status: 400 });
			return json({ rescue: await assignRescue(body.id, body.userId) });
		}
		if (body.status) return json({ rescue: await updateRescueStatus(body.id, body.status as 'PENDING' | 'ASSIGNED' | 'COMPLETED') });
		return json({ error: 'Specify a status or rescuer.' }, { status: 400 });
	} catch (error) {
		console.error('Unable to update rescue.', error);
		return json({ error: 'Unable to update rescue.' }, { status: 503 });
	}
};
