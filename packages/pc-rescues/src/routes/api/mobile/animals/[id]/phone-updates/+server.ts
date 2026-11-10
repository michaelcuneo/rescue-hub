import { json } from '@sveltejs/kit';
import { getAnimal } from '$lib/server/animals';
import { getRescue } from '$lib/server/graphql';
import { getHunterDemo, HUNTER_DEMO_ORGANISATION } from '$lib/server/demo';
import { recordAnimalPhoneUpdate, listAnimalPhoneUpdates, AnimalPhoneConflict } from '$lib/server/animal-phone-updates';
import { validatePhoneUpdate } from '../../../../../../../../core/rescue-phone-update';
import { notifyEligibleRescuers } from '$lib/server/push';
import type { RequestHandler } from './$types';

async function access(event: Parameters<RequestHandler>[0], write: boolean) {
  const user = event.locals.user;
  if (!user?.enabled || user.status !== 'ACTIVE') return null;
  const organisationId = getHunterDemo(event.cookies, user) ? HUNTER_DEMO_ORGANISATION : user.organisationId;
  if (!organisationId) return null;
  const animal = await getAnimal(event.params.id);
  if (!animal || animal.organisationId !== organisationId) return null;
  const coordinator = user.roles.some(role =>
    ['DISPATCHER', 'ORG_ADMIN', 'PLATFORM_ADMIN', 'AUTHORITY_ADMIN'].includes(role));
  const rescue = await getRescue(animal.rescueId);
  if (!rescue || rescue.organisationId !== organisationId) return null;
  const transport = animal.activeTransportRescueId ? await getRescue(animal.activeTransportRescueId) : null;
  const claimedTransport = transport?.organisationId === organisationId && transport.assignedUserId === user.id;
  if (write ? !coordinator :
    !coordinator && animal.currentCustodianUserId !== user.id && rescue.assignedUserId !== user.id && !claimedTransport)
    return null;
  return { user, animal, coordinator };
}

export const GET: RequestHandler = async event => {
  const ctx = await access(event, false);
  if (!ctx) return json({ error: 'Animal record unavailable.' }, { status: 403 });
  try {
    return json({ items: await listAnimalPhoneUpdates(ctx.animal.id, ctx.animal.organisationId) },
      { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    console.error('Unable to list animal phone history:', error);
    return json({ error: 'Unable to load phone history.' }, { status: 503 });
  }
};

export const POST: RequestHandler = async event => {
  const ctx = await access(event, true);
  if (!ctx) return json({ error: 'Dispatcher access required to record telephone updates.' }, { status: 403 });
  const body = await event.request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return json({ error: 'Telephone update is required.' }, { status: 400 });
  let input;
  try { input = validatePhoneUpdate(body); }
  catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Invalid telephone update.' }, { status: 400 });
  }
  try {
    const update = await recordAnimalPhoneUpdate(ctx.animal, ctx.user.id, input);
    let notification = null;
    if (update.transportRescueId) {
      const rescue = await getRescue(update.transportRescueId);
      if (rescue) {
        notification = await notifyEligibleRescuers({
          id: rescue.id, organisationId: ctx.animal.organisationId,
          type: rescue.type, breed: rescue.breed ?? undefined,
          location: rescue.location ?? undefined, injury: rescue.injury ?? undefined
        }).catch(error => {
          console.error('Transport job created, push notification failed:', error);
          return null;
        });
      }
    }
    return json({ update, notification },
      { status: 201, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    if (error instanceof AnimalPhoneConflict)
      return json({ error: error.message }, { status: 409 });
    console.error('Unable to record animal telephone update:', error);
    return json({ error: 'Unable to save telephone update.' }, { status: 503 });
  }
};
