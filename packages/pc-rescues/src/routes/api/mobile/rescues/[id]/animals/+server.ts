import { json } from '@sveltejs/kit';
import { getRescue } from '$lib/server/graphql';
import { getHunterDemo, HUNTER_DEMO_ORGANISATION } from '$lib/server/demo';
import { createAnimal, getAnimal, listRescueAnimals } from '$lib/server/animals';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params, cookies }) => {
  const user = locals.user;
  const organisationId = getHunterDemo(cookies, user) ? HUNTER_DEMO_ORGANISATION : user?.organisationId;
  if (!user || !organisationId || !user.enabled || user.status !== 'ACTIVE') return json({ error: 'Access denied.' }, { status: 403 });
  const rescue = await getRescue(params.id);
  if (!rescue || rescue.organisationId !== organisationId) return json({ error: 'Rescue not found.' }, { status: 404 });
  const items = await listRescueAnimals(params.id, organisationId);
  if (rescue.transportAnimalId && (rescue.assignedUserId === user.id || user.roles.some(role => ['ORG_ADMIN', 'DISPATCHER', 'PLATFORM_ADMIN', 'AUTHORITY_ADMIN'].includes(role)))) {
    const linked = await getAnimal(rescue.transportAnimalId);
    if (linked && linked.organisationId === organisationId && !items.some(a => a.id === linked.id)) items.push(linked);
  }
  const ownsAnimal = items.some(animal => animal.currentCustodianUserId === user.id);
  if (rescue.assignedUserId !== user.id && !ownsAnimal && !user.roles.some((r) =>
    ['ORG_ADMIN', 'DISPATCHER', 'CARER', 'PLATFORM_ADMIN', 'AUTHORITY_ADMIN'].includes(r)
  )) return json({ error: 'Access denied.' }, { status: 403 });
  // Retain historical species/status access for the original claimant, but
  // never leak a carer's private residential/workplace destination after handover.
  const coordinator = user.roles.some(role =>
    ['ORG_ADMIN', 'DISPATCHER', 'PLATFORM_ADMIN', 'AUTHORITY_ADMIN'].includes(role));
  const visible = items.map(animal => {
    const currentCustodian = animal.currentCustodianUserId === user.id;
    const activeTransporter = rescue.transportAnimalId === animal.id &&
      rescue.status === 'ASSIGNED' && rescue.assignedUserId === user.id;
    if (coordinator || currentCustodian || activeTransporter || animal.reservedCarerUserId === user.id)
      return animal;
    return { ...animal, currentLocation: undefined, reservedCarerUserId: undefined };
  });
  return json({ items: visible });
};
export const POST: RequestHandler = async ({ locals, params, request }) => {
  const user = locals.user;
  if (!user?.organisationId || !user.enabled || user.status !== 'ACTIVE' || !user.roles.some(role => ['RESCUER', 'CARER', 'ORG_ADMIN'].includes(role))) return json({ error: 'Access denied.' }, { status: 403 });
  const rescue = await getRescue(params.id);
  if (!rescue || rescue.transportAnimalId || rescue.organisationId !== user.organisationId || rescue.assignedUserId !== user.id) return json({ error: 'Only the claiming rescuer can register animals.' }, { status: 403 });
  const body = await request.json().catch(() => null) as { species?: unknown; description?: unknown; location?: unknown } | null;
  if (typeof body?.species !== 'string' || !body.species.trim() || body.species.length > 120) return json({ error: 'Species is required (max 120 characters).' }, { status: 400 });
  if (body.description !== undefined && (typeof body.description !== 'string' || body.description.length > 2000)) return json({ error: 'Invalid description.' }, { status: 400 });
  if (body.location !== undefined && (typeof body.location !== 'string' || body.location.length > 250)) return json({ error: 'Invalid location.' }, { status: 400 });
  try {
    const animal = await createAnimal({ rescueId: rescue.id, organisationId: user.organisationId, species: body.species.trim(), description: body.description as string | undefined, location: body.location as string | undefined, custodianUserId: user.id });
    return json({ animal }, { status: 201 });
  } catch (error) {
    console.error('Animal registration failed.', error);
    return json({ error: 'Could not register animal.' }, { status: 409 });
  }
};
