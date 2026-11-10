import { json } from '@sveltejs/kit';
import { redeemMobileAuthHandoff } from '$lib/server/mobile-oauth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => null) as { code?: unknown; verifier?: unknown } | null;
  if (typeof body?.code !== 'string' || typeof body.verifier !== 'string') {
    return json({ error: 'A mobile sign-in code and verifier are required.' }, { status: 400 });
  }
  try {
    const result = await redeemMobileAuthHandoff(body.code, body.verifier);
    return json({ token: result.sessionToken, user: result.user, membership: null }, {
      headers: { 'cache-control': 'no-store' }
    });
  } catch {
    return json({ error: 'Mobile social sign-in expired or could not be verified.' }, { status: 401 });
  }
};
