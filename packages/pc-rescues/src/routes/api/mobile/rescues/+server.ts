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
		getRescues(undefined, 100),
		getOrganisationMembershipConfig(user.organisationId)
	]);

	const items = result.items.filter((rescue) => {
		if (rescue.organisationId !== user.organisationId) return false;
        if (rescue.assignedUserId === user.id) return true;
        // Visibility is qualification-based, not availability-based. OFF-duty members may browse the map.
        if (rescue.status !== 'PENDING' || !user.enabled || user.status !== 'ACTIVE') return false;
        if (!user.roles.includes('RESCUER')) return false;
		const capability = classifyDispatchCapability(rescue.type, rescue.breed ?? '');
		return memberCanReceiveCapability(user.teamIds, membership, capability);
	});

	return json({ items }, { headers: { 'cache-control': 'private, no-store' } });
};
