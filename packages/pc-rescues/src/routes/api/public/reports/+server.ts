import { json } from '@sveltejs/kit';
import { canReport, listMyPublicReports, submitWildlifeReport } from '$lib/server/public-reports';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  if (!canReport(locals.user)) return json({ error: 'Reporter sign-in required.' }, { status: 403 });
  return json({ items: await listMyPublicReports(locals.user.id) }, {
    headers: { 'cache-control': 'private, no-store' }
  });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!canReport(locals.user)) return json({ error: 'Verified reporter account required.' }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.animal !== 'string' || typeof body.condition !== 'string' ||
      typeof body.latitude !== 'number' || typeof body.longitude !== 'number') {
    return json({ error: 'Animal, injury description and map position are required.' }, { status: 400 });
  }
  try {
    const report = await submitWildlifeReport(locals.user, {
      animal: body.animal, condition: body.condition,
      latitude: body.latitude, longitude: body.longitude
    });
    return json({ report }, { status: 201, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unable to submit report.' }, { status: 400 });
  }
};
