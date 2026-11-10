import { json } from '@sveltejs/kit';
import { createRescue, getRescue } from '$lib/server/graphql';
import { getHunterDemo, HUNTER_DEMO_ORGANISATION } from '$lib/server/demo';
import { canTriage, getPublicReport, markPublicReportConverted } from '$lib/server/public-reports';
import { notifyEligibleRescuers } from '$lib/server/push';
import type { RequestHandler } from './$types';

/** Dispatch explicitly reviews and accepts a public sighting before dispatch. */
export const POST: RequestHandler = async ({ locals, cookies, params }) => {
  const user = locals.user;
  if (!canTriage(user)) return json({ error: 'Dispatcher access required.' }, { status: 403 });
  const organisationId = getHunterDemo(cookies, user)
    ? HUNTER_DEMO_ORGANISATION : user.organisationId;
  if (!organisationId) return json({ error: 'Select an organisation before converting a report.' }, { status: 403 });
  const report = await getPublicReport(params.id);
  if (!report) return json({ error: 'Report not found.' }, { status: 404 });
  if (report.status === 'CONVERTED') return json({ error: 'Report has already been converted.' }, { status: 409 });

  // Deterministic ID ensures concurrent dispatcher actions cannot create
  // duplicate rescues for one public sighting.
  const rescueId = `public-report-${report.id}`;
  try {
    let rescue = await getRescue(rescueId);
    if (!rescue) {
      rescue = await createRescue({
        id: rescueId, organisationId, type: report.animal,
        injury: report.condition, location: 'Public wildlife report (pin location)',
        latitude: report.latitude, longitude: report.longitude, status: 'PENDING'
      });
    }
    if (rescue.organisationId !== organisationId) {
      return json({ error: 'This report was converted by another organisation.' }, { status: 409 });
    }
    await markPublicReportConverted(report.id, rescue.id, organisationId);
    const notification = await notifyEligibleRescuers({
      id: rescue.id, organisationId, type: rescue.type, injury: rescue.injury ?? undefined,
      location: rescue.location ?? undefined, breed: rescue.breed ?? undefined
    }).catch(error => {
      console.error('Public report dispatch push failed:', error);
      return null;
    });
    return json({ rescue, notification });
  } catch (error) {
    console.error('Public report conversion failed:', error);
    return json({ error: 'Unable to convert this report. It may already have been handled.' }, { status: 409 });
  }
};
