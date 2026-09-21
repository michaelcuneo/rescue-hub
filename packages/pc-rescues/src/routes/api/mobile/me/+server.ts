import { json } from '@sveltejs/kit';
import { getOrganisationMembershipConfig } from '$lib/server/membership';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return json({ error: 'Authentication required.' }, { status: 401 });
	const membership = locals.user.organisationId
		? await getOrganisationMembershipConfig(locals.user.organisationId)
		: null;
	return json({ user: locals.user, membership });
};
