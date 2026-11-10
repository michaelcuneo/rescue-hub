import { json } from '@sveltejs/kit';
import { registerPublicReporter } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => null) as { name?: unknown; email?: unknown; password?: unknown } | null;
  if (typeof body?.name !== 'string' || typeof body.email !== 'string' || typeof body.password !== 'string') {
    return json({ error: 'Name, email and password are required.' }, { status: 400 });
  }
  try {
    await registerPublicReporter({ name: body.name, email: body.email, password: body.password });
    return json({ ok: true, message: 'Check your email for your verification code.' }, {
      headers: { 'cache-control': 'no-store' }
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unable to register.' }, { status: 400 });
  }
};
