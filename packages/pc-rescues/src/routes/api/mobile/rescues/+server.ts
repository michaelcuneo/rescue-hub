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
import { mobileRescueVisibility } from '../../../../../../core/mobile-rescue-visibility';

/**
 * An OFF-duty member can still browse the open rescues their assigned team
 * is qualified for. Availability is enforced separately for push and claims.
 */
export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user;
  if (!user || !user.enabled || user.status !== 'ACTIVE' ||
      user.roles.includes('PUBLIC_REPORTER') || user.roles.includes('VET_STAFF') ||
      (!user.organisationId && !user.roles.some(role => ['PLATFORM_ADMIN','AUTHORITY_ADMIN'].includes(role))))
    return json({ error: 'Active rescue organisation or platform access required.' }, { status: 403 });
  const membership = user.organisationId
    ? await getOrganisationMembershipConfig(user.organisationId) : null;
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
    (rescue.transportAnimalId ? canTransportForOrganisation(user) : canRescueForOrganisation(user) && membership !== null && memberCanReceiveCapability(
      user.teamIds,
      membership,
      classifyDispatchCapability(rescue.type, rescue.breed ?? '')
    ))
  );
  // Coordinators use the desktop Operations portal for broad oversight.
  // Mobile is a field worklist: a role such as ORG_ADMIN must not expose jobs
  // the same person is unqualified to rescue or transport.
  const canBrowse = user.enabled && user.status === 'ACTIVE' && permittedRole;
  const qualifiedIds = new Set(qualified.map(rescue => rescue.id));

  const finalOutcomes = new Set(['RELEASED', 'EUTHANISED', 'DECEASED']);
  const currentCustody = user.organisationId
    ? (await listCustodianAnimals(user.organisationId, user.id))
        .filter(animal => !finalOutcomes.has(animal.status)) : [];
  const custodianRescueIds = new Set(currentCustody.map(animal => animal.rescueId));
  // Keep all of MY assignments in the list, including ones previously picked
  // up or handed to a vet. Only the map pin disappears at physical collection.
  // A platform administrator without an organisation can still see assignments
  // explicitly made to their own identity, never arbitrary other-org cases.
  const owned = rescues.filter(rescue =>
    rescue.assignedUserId === user.id &&
    (rescue.organisationId === user.organisationId ||
      user.roles.some(role => ['PLATFORM_ADMIN','AUTHORITY_ADMIN'].includes(role))));
  const ownedAnimalGroups = await Promise.all(owned.map(async rescue => ({
    id: rescue.id,
    animals: await listRescueAnimals(rescue.id, rescue.organisationId!)
  })));
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

  const items = rescues.flatMap(rescue => {
    // Reuse the exact same role/team/transport check that supplies feed
    // diagnostics. Never grant a broader view to dispatcher/admin roles.
    const qualification = qualifiedIds.has(rescue.id);
    const visibility = mobileRescueVisibility(
      user, rescue, custodianRescueIds.has(rescue.id), qualification
    );
    if (!visibility) return [];
    return [{
      ...rescue,
      custodyRole: custodianRescueIds.has(rescue.id) ? 'CUSTODIAN' as const : undefined,
      visibility,
      stageLabel: rescue.transportAnimalId ? 'Transport pickup job' :
        stages.get(rescue.id) ?? (rescue.pickedUpAt ? 'Collected · history available' : undefined)
    }];
  });

  return json({
    items,
    truncated: Boolean(nextToken),
    feed: {
      source,
      organisationRescues: inOrganisation.length,
      pendingRescues: pending.length,
      qualifiedPending: qualified.length,
      visibleRescues: items.length,
      assignedToMe: items.filter(item => item.assignedUserId === user.id).length,
      canBrowse,
      organisationId: user.organisationId,
      teamIds: user.teamIds
    }
  }, { headers: { 'cache-control': 'private, no-store' } });
};
