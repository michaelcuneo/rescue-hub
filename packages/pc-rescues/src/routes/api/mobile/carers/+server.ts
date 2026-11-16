import { json } from '@sveltejs/kit';
import { listUsers } from '$lib/server/auth';
import { getRescue } from '$lib/server/graphql';
import type { RequestHandler } from './$types';

/** A minimum-information picker. Do not expose emails or private addresses. */
export const GET: RequestHandler = async ({ locals, url }) => {
  const user = locals.user;
  if (!user || !user.enabled || user.status !== 'ACTIVE' ||
      user.roles.includes('PUBLIC_REPORTER') || user.roles.includes('VET_STAFF'))
    return json({ error: 'Access denied.' }, { status: 403 });
  let organisationId = user.organisationId;
  if (!organisationId && user.roles.some(role => ['PLATFORM_ADMIN','AUTHORITY_ADMIN'].includes(role))) {
    const rescueId = url.searchParams.get('rescueId');
    const rescue = rescueId ? await getRescue(rescueId) : null;
    if (!rescue || rescue.assignedUserId !== user.id || !rescue.organisationId)
      return json({ error: 'An assigned rescue is required to select a carer.' }, { status: 403 });
    organisationId = rescue.organisationId;
  }
  if (!organisationId || !user.roles.some(role =>
      ['RESCUER','CARER','ORG_ADMIN','DISPATCHER','PLATFORM_ADMIN','AUTHORITY_ADMIN'].includes(role)))
    return json({ error: 'Access denied.' }, { status: 403 });
  const people = await listUsers();
  return json({
    carers: people.filter(person =>
      person.organisationId === organisationId && person.enabled &&
      person.status === 'ACTIVE' && person.roles.includes('CARER') && person.id !== user.id
    ).map(person => ({ id: person.id, name: person.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, { headers: { 'cache-control': 'no-store' } });
};
