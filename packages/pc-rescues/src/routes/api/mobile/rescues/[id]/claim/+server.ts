import { effectiveAvailability } from '$lib/server/availability';
import { json } from '@sveltejs/kit';
import { getRescue } from '$lib/server/graphql';
import { claimRescue, RescueAlreadyClaimedError } from '$lib/server/rescue-claims';
import { classifyDispatchCapability, getOrganisationMembershipConfig, memberCanReceiveCapability } from '$lib/server/membership';
import type { RequestHandler } from './$types';
import { canRescueForOrganisation, canTransportForOrganisation } from '../../../../../../../../core/care-delivery';

export const POST: RequestHandler = async ({ locals, params }) => {
  const user = locals.user;
  if (!user) return json({ error: 'Sign in again before claiming a rescue.' }, { status: 401 });
  if (!user.organisationId) return json({
    error: 'Your account is not linked to a rescue organisation. Platform administrator access alone does not authorise field rescue claims.'
  }, { status: 403 });
  if (!user.enabled || user.status !== 'ACTIVE' || user.roles.includes('PUBLIC_REPORTER') ||
      effectiveAvailability(user) !== 'AVAILABLE') {
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
    if (rescue.transportAnimalId && rescue.awaitingCarer) {
      return json({ error: 'A wildlife carer must claim the animal before transport is available.' }, { status: 409 });
    }
    // Transport work is independent of species rescue accreditation.
    if (rescue.transportAnimalId) {
      if (!canTransportForOrganisation(user))
        return json({ error: 'Transport must be explicitly authorised by your administrator.' }, { status: 403 });
      return json({ rescue: await claimRescue(rescue.id, user.organisationId, user.id) });
    }
    const membership = await getOrganisationMembershipConfig(user.organisationId);
    const capability = classifyDispatchCapability(rescue.type, rescue.breed ?? '');
    if (!canRescueForOrganisation(user))
      return json({ error: 'Your account needs the Rescuer system permission to claim species rescues. Set it under Administration → People.' }, { status: 403 });
    if (!memberCanReceiveCapability(user.teamIds, membership, capability)) {
      const label = capability.toLowerCase().replaceAll('_', ' ');
      return json({ error: `This rescue requires ${label} training. Check your trained areas and the reported animal type under Administration → People.` }, { status: 403 });
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
