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
import { reconcileRescueSnapshots } from '../../../../../../core/rescue-feed-reconciliation';

/**
 * An OFF-duty member can still browse the open rescues their assigned team
 * is qualified for. Availability is enforced separately for push and claims.
 */
export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user;
  if (!user?.organisationId || !user.enabled || user.status !== 'ACTIVE') return json({ error: 'Authentication required.' }, { status: 401 });
  const membership = await getOrganisationMembershipConfig(user.organisationId);
  let nextToken: string | undefined;
  // Both sources are projections of the same rescue table. A nonempty AppSync
  // result can still be stale, so ALWAYS reconcile it with the desktop GSI.
  const [appsync, indexed] = await Promise.allSettled([
    (async () => {
      const items: Rescue[] = [];
      let cursor: string | undefined;
      let page = 0;
      do {
        const result = await getRescues(undefined, 100, cursor);
        items.push(...result.items);
        cursor = result.nextToken ?? undefined;
        page += 1;
      } while (cursor && page < 20);
      return { items, nextToken: cursor };
    })(),
    listAdminRescues()
  ]);

  if (appsync.status === 'rejected')
    console.error('Mobile AppSync rescue query failed; reconciling with the dispatch index.', appsync.reason);
  if (indexed.status === 'rejected')
    console.error('Mobile DynamoDB dispatch index unavailable; using AppSync.', indexed.reason);
  if (appsync.status === 'rejected' && indexed.status === 'rejected')
    return json({ error: 'Rescue feed is unavailable. Retry shortly.' }, { status: 503 });

  nextToken = appsync.status === 'fulfilled' ? appsync.value.nextToken : undefined;
  const source: 'appsync' | 'dynamodb-fallback' | 'reconciled' =
    appsync.status === 'fulfilled' && indexed.status === 'fulfilled'
      ? 'reconciled' : indexed.status === 'fulfilled' ? 'dynamodb-fallback' : 'appsync';
  const rescues: Rescue[] = reconcileRescueSnapshots(
    appsync.status === 'fulfilled' ? appsync.value.items : [],
    indexed.status === 'fulfilled' ? indexed.value : []
  );

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
  const canBrowse = user.enabled && user.status === 'ACTIVE' && permittedRole;

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
