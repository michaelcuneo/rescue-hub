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

	const membership = await getOrganisationMembershipConfig(user.organisationId);
	// The map must not silently show only the first page of matching rescues.
	// Fetch pages server-side; cap work per request to protect the demo API.
	const rescues: Awaited<ReturnType<typeof getRescues>>['items'] = [];
	let nextToken: string | undefined;
	let page = 0;
	do {
		const result = await getRescues(undefined, 100, nextToken);
		rescues.push(...result.items);
		nextToken = result.nextToken ?? undefined;
		page += 1;
	} while (nextToken && page < 20);

	const items = rescues.filter((rescue) => {
		if (rescue.organisationId !== user.organisationId) return false;
        if (rescue.assignedUserId === user.id) return true;
        // Visibility is qualification-based, not availability-based. OFF-duty members may browse the map.
        if (rescue.status !== 'PENDING' || !user.enabled || user.status !== 'ACTIVE') return false;
        // Org admins can also rescue when explicitly assigned a qualified dispatch team.
        // No admin role alone bypasses the capability and organisation filters.
        if (!user.roles.some((role) => role === 'RESCUER' || role === 'ORG_ADMIN')) return false;
		const capability = classifyDispatchCapability(rescue.type, rescue.breed ?? '');
		return memberCanReceiveCapability(user.teamIds, membership, capability);
	});

	return json({ items, truncated: Boolean(nextToken) }, { headers: { 'cache-control': 'private, no-store' } });
};
