import { json } from '@sveltejs/kit';
import { verifyPublicReporter } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const body = await request.json().catch(() => null) as { email?: unknown; code?: unknown } | null;
  if (typeof body?.email !== 'string' || typeof body.code !== 'string') {
    return json({ error: 'Email and verification code are required.' }, { status: 400 });
  }
  try {
    const result = await verifyPublicReporter(body.email, body.code, cookies);
    return json({ ok: true, user: result.user, token: result.sessionToken }, {
      headers: { 'cache-control': 'no-store' }
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Invalid verification code.' }, { status: 400 });
  }
};
