import { effectiveAvailability } from '$lib/server/availability';
import { json } from '@sveltejs/kit';
import { loginUser } from '$lib/server/auth';
import { getOrganisationMembershipConfig } from '$lib/server/membership';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as { email?: string; password?: string };
	if (!body.email || !body.password) {
		return json({ error: 'Email and password are required.' }, { status: 400 });
	}

	try {
		const result = await loginUser(body.email, body.password);
		if (!result.user?.organisationId && !result.user?.roles.includes('PUBLIC_REPORTER')) {
			return json({ error: 'This account cannot use the mobile application.' }, { status: 403 });
		}
		const membership = result.user.organisationId
			? await getOrganisationMembershipConfig(result.user.organisationId)
			: null;
		return json({ token: result.sessionToken, user: { ...result.user, availabilityStatus: effectiveAvailability(result.user) }, membership });
	} catch (error) {
		return json({ error: error instanceof Error ? error.message : 'Unable to sign in.' }, { status: 401 });
	}
};
