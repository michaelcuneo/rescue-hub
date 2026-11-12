import { json } from '@sveltejs/kit';
import { listUsers } from '$lib/server/auth';
import type { RequestHandler } from './$types';

/** A minimum-information picker. Do not expose emails or private addresses. */
export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user;
  if (!user?.organisationId || !user.enabled || user.status !== 'ACTIVE' ||
      !user.roles.some(role => ['RESCUER', 'CARER', 'ORG_ADMIN', 'DISPATCHER'].includes(role)))
    return json({ error: 'Access denied.' }, { status: 403 });
  const people = await listUsers();
  return json({
    carers: people.filter(person =>
      person.organisationId === user.organisationId && person.enabled &&
      person.status === 'ACTIVE' && person.roles.includes('CARER') && person.id !== user.id
    ).map(person => ({ id: person.id, name: person.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, { headers: { 'cache-control': 'no-store' } });
};
