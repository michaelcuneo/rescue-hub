import { json } from '@sveltejs/kit';
import { listVetClinics } from '$lib/server/vet-clinics';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user;
  if (!user?.organisationId || !user.enabled || user.status !== 'ACTIVE' ||
      user.roles.includes('PUBLIC_REPORTER') || user.roles.includes('VET_STAFF'))
    return json({ error: 'Authorised rescue organisation account required.' }, { status: 403 });
  try {
    return json({ clinics: await listVetClinics(user.organisationId) }, {
      headers: { 'cache-control':'private, no-store' }
    });
  } catch (error) {
    console.error('Veterinary clinic list unavailable', error);
    return json({ error: 'Could not load veterinary clinic directory.' }, { status: 503 });
  }
};
