import { json } from '@sveltejs/kit';
import { canReport, listMyPublicReports, submitWildlifeReport } from '$lib/server/public-reports';
import type { RequestHandler } from './$types';
import { resolveReportOrganisation } from '$lib/server/operating-area-resolver';
import { dispatchPublicReport } from '$lib/server/public-report-dispatch';

export const GET: RequestHandler = async ({ locals }) => {
  if (!canReport(locals.user)) return json({ error: 'Reporter sign-in required.' }, { status: 403 });
  return json({ items: await listMyPublicReports(locals.user.id) }, {
    headers: { 'cache-control': 'private, no-store' }
  });
};

export const POST: RequestHandler = async ({ locals, request, fetch: eventFetch }) => {
  if (!canReport(locals.user)) return json({ error: 'Verified reporter account required.' }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.animal !== 'string' || typeof body.condition !== 'string' ||
      typeof body.latitude !== 'number' || typeof body.longitude !== 'number') {
    return json({ error: 'Animal, injury description and map position are required.' }, { status: 400 });
  }
  try {
    const routing = await resolveReportOrganisation(eventFetch, body.latitude, body.longitude)
      .then(route => route.status === 'MATCHED'
        ? ({ status: 'MATCHED', organisationId: route.organisationId, areaLabel: route.areaLabel } as const)
        : ({ status: 'UNROUTED', reason: route.reason } as const))
      .catch(error => {
        console.error('Public report boundary lookup failed:', error);
        return { status: 'ROUTING_UNAVAILABLE', reason: 'BOUNDARIES_UNAVAILABLE' } as const;
      });
    const report = await submitWildlifeReport(locals.user, {
      animal: body.animal, condition: body.condition,
      latitude: body.latitude, longitude: body.longitude,
      allowMessages: body.allowMessages === true,
      allowPhoneContact: body.allowPhoneContact === true,
      contactPhone: typeof body.contactPhone === 'string' ? body.contactPhone : undefined
    }, routing);
    if (routing.status === 'MATCHED') {
      try {
        const { rescue } = await dispatchPublicReport(report.id, eventFetch);
        return json({ report: { ...report, status: 'CONVERTED', rescueId: rescue.id }, dispatched: true },
          { status: 201, headers: { 'cache-control': 'no-store' } });
      } catch (error) {
        console.error('Public report auto-dispatch failed; report remains queued for review:', error);
      }
    }
    return json({ report, dispatched: false }, { status: 201, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unable to submit report.' }, { status: 400 });
  }
};
