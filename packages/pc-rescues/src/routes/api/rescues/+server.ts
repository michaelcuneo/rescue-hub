import { json } from '@sveltejs/kit';
import { createRescue } from '$lib/server/graphql';
import { markPhoneRescueIntake } from '$lib/server/admin-data';
import { getHunterDemo, HUNTER_DEMO_ORGANISATION } from '$lib/server/demo';
import { notifyEligibleRescuers } from '$lib/server/push';
import { classifyDispatchCapability, getOrganisationMembershipConfig, memberCanReceiveCapability } from '$lib/server/membership';
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
	if (!locals.user.roles.some((role) => ['PLATFORM_ADMIN', 'AUTHORITY_ADMIN', 'ORG_ADMIN', 'DISPATCHER'].includes(role))) {
		return json({ error: 'Dispatcher access required to create rescues.' }, { status: 403 });
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

	if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
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

		// The call and the online form are the same kind of public report.
		// Record the intake channel before notifying or returning the case.
		await markPhoneRescueIntake(rescue.id);
		rescue.intakeSource = 'PHONE';

		const notifications = await notifyEligibleRescuers({
			id: rescue.id,
			organisationId,
			type: rescue.type,
			breed: rescue.breed ?? undefined,
			location: rescue.location ?? undefined,
			injury: rescue.injury ?? undefined
		}).catch((error) => {
			console.error('Unable to deliver rescue push notifications.', error);
			return {
				capability: classifyDispatchCapability(rescue.type, rescue.breed ?? ''),
				eligibleUsers: 0,
				pushTokens: 0,
				accepted: 0,
				rejected: 0,
				errors: [error instanceof Error ? error.message : 'Push delivery request failed']
			};
		});

		return json({ rescue, notifications }, { status: 201 });
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

