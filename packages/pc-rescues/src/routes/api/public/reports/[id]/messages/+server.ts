import { json } from '@sveltejs/kit';
import { authoriseReporterConversation, listReporterMessages, sendReporterMessage, ReporterConversationError } from '$lib/server/public-report-messages';
import type { RequestHandler } from './$types';

function failure(error: unknown) {
  if (error instanceof ReporterConversationError) return json({ error: error.message }, { status: error.status });
  console.error('Public reporter conversation failed:', error);
  return json({ error: 'Reporter conversation currently unavailable.' }, { status: 503 });
}

export const GET: RequestHandler = async ({ locals, params }) => {
  try {
    const { report, role } = await authoriseReporterConversation(locals.user, params.id);
    return json({
      items: await listReporterMessages(report.id),
      role, reportId: report.id, rescueId: report.rescueId ?? null,
      // Phone numbers are revealed only to the claimed responder, and only
      // after the reporter separately opted into phone contact.
      contactPhone: role === 'RESCUER' && report.allowPhoneContact ? report.contactPhone : null
    }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) { return failure(error); }
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
  try {
    const { role } = await authoriseReporterConversation(locals.user, params.id);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body.text !== 'string')
      return json({ error: 'Message text is required.' }, { status: 400 });
    return json({ message: await sendReporterMessage(locals.user!, params.id, body.text, role) },
      { status: 201, headers: { 'cache-control': 'no-store' } });
  } catch (error) { return failure(error); }
};
