import { effectiveAvailability } from '$lib/server/availability';
import { json } from '@sveltejs/kit';
import { getRescue } from '$lib/server/graphql';
import { claimRescue, RescueAlreadyClaimedError } from '$lib/server/rescue-claims';
import { classifyDispatchCapability, getOrganisationMembershipConfig, memberCanReceiveCapability } from '$lib/server/membership';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, params }) => {
  const user = locals.user;
  if (!user?.organisationId) return json({ error: 'Authentication required.' }, { status: 401 });
  if (!user.enabled || user.status !== 'ACTIVE' || effectiveAvailability(user) !== 'AVAILABLE' ||
      !user.roles.some((role) => role === 'RESCUER' || role === 'CARER' || role === 'ORG_ADMIN')) {
    return json({ error: 'An active, available rescuer account is required.' }, { status: 403 });
  }

  try {
    const rescue = await getRescue(params.id);
    if (!rescue || rescue.organisationId !== user.organisationId) {
      return json({ error: 'Rescue not found.' }, { status: 404 });
    }
    if (rescue.status !== 'PENDING' || rescue.assignedUserId) {
      return json({ error: 'This rescue has already been claimed.' }, { status: 409 });
    }
    const membership = await getOrganisationMembershipConfig(user.organisationId);
    const capability = classifyDispatchCapability(rescue.type, rescue.breed ?? '');
    if (!memberCanReceiveCapability(user.teamIds, membership, capability)) {
      return json({ error: 'You are not qualified for this rescue.' }, { status: 403 });
    }
    return json({ rescue: await claimRescue(rescue.id, user.organisationId, user.id) });
  } catch (error) {
    if (error instanceof RescueAlreadyClaimedError) {
      return json({ error: error.message }, { status: 409 });
    }
    console.error('Unable to claim rescue.', error);
    return json({ error: 'Unable to claim rescue.' }, { status: 503 });
  }
};
