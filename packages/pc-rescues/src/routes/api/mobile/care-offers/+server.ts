import { json } from '@sveltejs/kit';
import { listAvailableCareOffers, listMyCareReservations } from '$lib/server/care-reservations';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user;
  if (!user?.organisationId || !user.enabled || user.status !== 'ACTIVE' ||
      !user.roles.includes('CARER'))
    return json({ error: 'Active wildlife carer membership is required.' }, { status: 403 });
  try {
    const [items, mine] = await Promise.all([
      listAvailableCareOffers(user.organisationId),
      listMyCareReservations(user.organisationId, user.id)
    ]);
    return json({ items, mine },
      { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    console.error('Unable to load animal care offers:', error);
    return json({ error: 'Care offers are temporarily unavailable.' }, { status: 503 });
  }
};
