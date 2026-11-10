import { json } from '@sveltejs/kit';
import { getRescue } from '$lib/server/graphql';
import { createAnimal, listRescueAnimals } from '$lib/server/animals';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
  const user = locals.user;
  if (!user?.organisationId || !user.enabled || user.status !== 'ACTIVE') return json({ error: 'Access denied.' }, { status: 403 });
  const rescue = await getRescue(params.id);
  if (!rescue || rescue.organisationId !== user.organisationId) return json({ error: 'Rescue not found.' }, { status: 404 });
  if (rescue.assignedUserId !== user.id && !user.roles.some((r) => ['ORG_ADMIN', 'DISPATCHER', 'CARER'].includes(r))) return json({ error: 'Access denied.' }, { status: 403 });
  return json({ items: await listRescueAnimals(params.id, user.organisationId) });
};
export const POST: RequestHandler = async ({ locals, params, request }) => {
  const user = locals.user;
  if (!user?.organisationId || !user.enabled || user.status !== 'ACTIVE' || !user.roles.includes('RESCUER')) return json({ error: 'Access denied.' }, { status: 403 });
  const rescue = await getRescue(params.id);
  if (!rescue || rescue.organisationId !== user.organisationId || rescue.assignedUserId !== user.id) return json({ error: 'Only the claiming rescuer can register animals.' }, { status: 403 });
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
