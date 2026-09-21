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
		if (!result.user?.organisationId) {
			return json({ error: 'This account is not attached to a rescue organisation.' }, { status: 403 });
		}
		const membership = await getOrganisationMembershipConfig(result.user.organisationId);
		return json({ token: result.sessionToken, user: result.user, membership });
	} catch (error) {
		return json({ error: error instanceof Error ? error.message : 'Unable to sign in.' }, { status: 401 });
	}
};
