import { json } from '@sveltejs/kit';
import { getRescue } from '$lib/server/graphql';
import { listAdminRescues } from '$lib/server/admin-data';
import { getHunterDemo, HUNTER_DEMO_ORGANISATION } from '$lib/server/demo';
import { getOrganisationMembershipConfig, classifyDispatchCapability, memberCanReceiveCapability } from '$lib/server/membership';
import { reverseRescueAddress } from '$lib/server/rescue-geocoding';
import { canSeeDesktopRescue } from '../../../../../../../../core/desktop-dispatch-access';
import { rescueDirectionsUrl, formatRescueCoordinates, locationFallback, type MappedAddress } from '../../../../../../../../core/rescue-location';
import type { RequestHandler } from './$types';

/** A location lookup is not a public geocoding proxy: authorise the rescue ID
 * before reading coordinates, then return only temporary address orientation.
 */
export const GET: RequestHandler = async ({ locals, cookies, params, fetch: eventFetch }) => {
  const user = locals.user;
  if (!user || !user.enabled || user.status !== 'ACTIVE' ||
      user.roles.includes('PUBLIC_REPORTER'))
    return json({ error: 'Authentication required.' }, { status: 401 });

  const demo = getHunterDemo(cookies, user);
  const organisationId = demo ? HUNTER_DEMO_ORGANISATION : user.organisationId;
  if (!organisationId) return json({ error: 'Organisation required.' }, { status: 403 });
  const viewer = demo ? {
    ...user, organisationId,
    roles: [...new Set([...user.roles, 'DISPATCHER' as const])]
  } : user;

  // AppSync is canonical for active work; the indexed rescue snapshot also
  // includes demo fixtures and serves as a fallback during AppSync outages.
  let rescue = null;
  try { rescue = await getRescue(params.id); } catch {
    // Lookup will fall back to the DynamoDB dispatch index.
  }
  if (!rescue) rescue = (await listAdminRescues()).find(item => item.id === params.id) ?? null;
  if (!rescue || rescue.organisationId !== organisationId)
    return json({ error: 'Rescue not found.' }, { status: 404 });
  const membership = await getOrganisationMembershipConfig(organisationId);
  const eligible = memberCanReceiveCapability(
    viewer.teamIds, membership,
    classifyDispatchCapability(rescue.type, rescue.breed ?? '')
  );
  if (!canSeeDesktopRescue(viewer, rescue, eligible))
    return json({ error: 'Rescue not found.' }, { status: 404 });

  const coordinates = { latitude: rescue.latitude, longitude: rescue.longitude };
  const address: MappedAddress = await reverseRescueAddress(coordinates, eventFetch);
  return json({
    address: address.address,
    precision: address.precision,
    location: locationFallback(rescue.location),
    coordinates: formatRescueCoordinates(coordinates),
    directionsUrl: rescueDirectionsUrl(coordinates)
  }, { headers: { 'cache-control': 'private, no-store' } });
};
