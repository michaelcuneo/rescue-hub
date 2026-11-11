import { json } from '@sveltejs/kit';
import { acceptInvite } from '$lib/server/auth';
import type { RequestHandler } from './$types';

// Mobile clients may activate using the same invitation link credential.
// No email address or six-digit code is accepted.
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const input = await request.json() as {
      invite?: string;
      password?: string;
      mobile?: boolean;
    };
    const result = await acceptInvite(
      input.invite ?? '',
      input.password ?? '',
      input.mobile ? undefined : cookies
    );
    return json({
      user: result.user,
      ...(input.mobile ? { sessionToken: result.sessionToken } : {})
    }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Unable to activate invitation.' },
      { status: 400, headers: { 'cache-control': 'no-store' } }
    );
  }
};
