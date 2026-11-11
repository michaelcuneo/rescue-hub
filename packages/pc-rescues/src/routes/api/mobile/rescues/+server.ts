import { json } from '@sveltejs/kit';
import { getRescues, type Rescue } from '$lib/server/graphql';
import { listAdminRescues } from '$lib/server/admin-data';
import { listRescueAnimals, listCustodianAnimals } from '$lib/server/animals';
import {
  classifyDispatchCapability,
  getOrganisationMembershipConfig,
  memberCanReceiveCapability
} from '$lib/server/membership';
import type { RequestHandler } from './$types';
import { canRescueForOrganisation, canTransportForOrganisation } from '../../../../../../core/care-delivery';

/**
 * An OFF-duty member can still browse the open rescues their assigned team
 * is qualified for. Availability is enforced separately for push and claims.
 */
export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user;
  if (!user?.organisationId || !user.enabled || user.status !== 'ACTIVE') return json({ error: 'Authentication required.' }, { status: 401 });
  const membership = await getOrganisationMembershipConfig(user.organisationId);
  let rescues: Rescue[] = [];
  let nextToken: string | undefined;
  let source: 'appsync' | 'dynamodb-fallback' = 'appsync';
  let graphqlFailed = false;

  try {
    let page = 0;
    do {
      const result = await getRescues(undefined, 100, nextToken);
      rescues.push(...result.items);
      nextToken = result.nextToken ?? undefined;
      page += 1;
    } while (nextToken && page < 20);
  } catch (error) {
    graphqlFailed = true;
    console.error('Mobile AppSync rescue feed unavailable; trying the DynamoDB index', error);
    rescues = [];
  }

  // The dispatcher portal reads the DynamoDB index directly. Use that same
  // index when AppSync has no data or fails, instead of showing an empty map.
  if (rescues.length === 0) {
    const fallback = await listAdminRescues();
    if (fallback.length || graphqlFailed) {
      rescues = fallback;
      source = 'dynamodb-fallback';
      nextToken = undefined;
    }
  }

  const inOrganisation = rescues.filter((rescue) => rescue.organisationId === user.organisationId);
  const pending = inOrganisation.filter((rescue) => rescue.status === 'PENDING' && !rescue.assignedUserId && !rescue.awaitingCarer);
  const permittedRole = canRescueForOrganisation(user) || canTransportForOrganisation(user);
  const qualified = pending.filter((rescue) =>
    (rescue.transportAnimalId ? canTransportForOrganisation(user) : canRescueForOrganisation(user) && memberCanReceiveCapability(
      user.teamIds,
      membership,
      classifyDispatchCapability(rescue.type, rescue.breed ?? '')
    ))
  );
  const canBrowse = user.enabled && user.status === 'ACTIVE' && (permittedRole || user.membershipTypeId === 'transport-volunteer');

  // Current custody (not historical claimant) governs ongoing care visibility.
  // After every registered animal has been accepted by another custodian,
  // the original rescuer's completed handoff disappears from their queue.
  const finalOutcomes = new Set(['RELEASED', 'EUTHANISED', 'DECEASED']);
  const currentCustody = (await listCustodianAnimals(user.organisationId, user.id))
    .filter(animal => !finalOutcomes.has(animal.status));
  const custodianRescueIds = new Set(currentCustody.map(animal => animal.rescueId));
  const owned = inOrganisation.filter(rescue => rescue.assignedUserId === user.id &&
    !['COMPLETED', 'CANCELLED'].includes(rescue.status));
  const ownedAnimalGroups = await Promise.all(owned.map(async rescue => ({
    id: rescue.id,
    animals: await listRescueAnimals(rescue.id, user.organisationId!)
  })));
  const activeOwned = new Set(ownedAnimalGroups.filter(group =>
    group.animals.length === 0 || group.animals.some(animal =>
      animal.currentCustodianUserId === user.id && !finalOutcomes.has(animal.status)
    )
  ).map(group => group.id));

  const stages = new Map<string, string>();
  for (const group of ownedAnimalGroups) {
    if (group.animals.some(animal => animal.status === 'AT_VET' &&
      animal.vetStage === 'ASSESSED_AWAITING_TRANSPORT')) {
      stages.set(group.id, 'Assessed · awaiting transport');
    } else if (group.animals.some(animal => animal.status === 'AT_VET')) {
      stages.set(group.id, 'At vet · being assessed');
    } else if (group.animals.some(animal => animal.status === 'IN_TRANSIT')) {
      stages.set(group.id, 'Animal in transport');
    } else if (group.animals.some(animal => animal.status === 'IN_CARE')) {
      stages.set(group.id, 'In care');
    }
  }
  for (const animal of currentCustody) {
    if (!stages.has(animal.rescueId)) stages.set(animal.rescueId,
      animal.status === 'AT_VET'
        ? animal.vetStage === 'ASSESSED_AWAITING_TRANSPORT' ? 'Assessed · awaiting transport' : 'At vet · being assessed'
        : animal.status === 'IN_TRANSIT' ? 'Animal in transport'
          : animal.status === 'IN_CARE' ? 'In care' : 'Rescue in progress');
  }

  const items = inOrganisation.filter(rescue =>
    activeOwned.has(rescue.id) ||
    custodianRescueIds.has(rescue.id) ||
    (canBrowse && rescue.status === 'PENDING' && !rescue.assignedUserId && !rescue.awaitingCarer &&
      (rescue.transportAnimalId ? canTransportForOrganisation(user) : canRescueForOrganisation(user) && memberCanReceiveCapability(
        user.teamIds, membership, classifyDispatchCapability(rescue.type, rescue.breed ?? '')
      )))
  ).map(rescue => ({
    ...rescue,
    custodyRole: custodianRescueIds.has(rescue.id) ? 'CUSTODIAN' : undefined,
    stageLabel: rescue.transportAnimalId ? 'Transport pickup job' : stages.get(rescue.id)
  }));

  return json({
    items,
    truncated: Boolean(nextToken),
    feed: {
      source,
      organisationRescues: inOrganisation.length,
      pendingRescues: pending.length,
      qualifiedPending: qualified.length,
      visibleRescues: items.length,
      canBrowse,
      organisationId: user.organisationId,
      teamIds: user.teamIds
    }
  }, { headers: { 'cache-control': 'private, no-store' } });
};
