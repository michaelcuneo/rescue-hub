import { json } from '@sveltejs/kit';
import { getRescues } from '$lib/server/graphql';
import {
	classifyDispatchCapability,
	getOrganisationMembershipConfig,
	memberCanReceiveCapability
} from '$lib/server/membership';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	if (!user?.organisationId) return json({ error: 'Authentication required.' }, { status: 401 });

	const [result, membership] = await Promise.all([
		getRescues('PENDING', 100),
		getOrganisationMembershipConfig(user.organisationId)
	]);

	const items = result.items.filter((rescue) => {
		if (rescue.organisationId !== user.organisationId) return false;
		const capability = classifyDispatchCapability(rescue.type, rescue.breed ?? '');
		return memberCanReceiveCapability(user.teamIds, membership, capability);
	});

	return json({ items });
};
