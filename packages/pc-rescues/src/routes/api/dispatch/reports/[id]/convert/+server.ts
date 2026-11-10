import { json } from '@sveltejs/kit';
import { getHunterDemo } from '$lib/server/demo';
import { canTriage } from '$lib/server/public-reports';
import { dispatchPublicReport, PublicReportRoutingError } from '$lib/server/public-report-dispatch';
import type { RequestHandler } from './$types';

// Exceptional retry only. Never trust a caller-supplied organisation ID.
export const POST: RequestHandler = async ({ locals, cookies, params, fetch: eventFetch }) => {
  const user = locals.user;
  if (!canTriage(user) || !(
    user.roles.some(role => ['PLATFORM_ADMIN', 'AUTHORITY_ADMIN'].includes(role)) ||
    getHunterDemo(cookies, user)
  )) return json({ error: 'Central public-report triage access required.' }, { status: 403 });
  try {
    return json(await dispatchPublicReport(params.id, eventFetch));
  } catch (error) {
    if (error instanceof PublicReportRoutingError) {
      const status = error.code === 'NOT_FOUND' ? 404
        : error.code === 'ALREADY_CONVERTED' || error.code === 'CONFLICT' ? 409 : 422;
      return json({ error: error.message, routingCode: error.code }, { status });
    }
    console.error('Public report dispatch retry failed:', error);
    return json({ error: 'Unable to dispatch report. It remains queued for review.' }, { status: 503 });
  }
};
