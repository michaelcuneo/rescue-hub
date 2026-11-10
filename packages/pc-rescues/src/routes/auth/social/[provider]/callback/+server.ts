import { redirect } from '@sveltejs/kit';
import { createOrLoginSocialReporter } from '$lib/server/auth';
import { finishSocialOAuth, isSocialProvider } from '$lib/server/social-oauth';
import { createMobileAuthHandoff } from '$lib/server/mobile-oauth';
import type { RequestHandler } from './$types';

async function finish(input: {
  provider: string; origin: string; state: string; code: string;
  appleUser?: string; cookies: Parameters<RequestHandler>[0]['cookies']
}): Promise<Response> {
  if (!isSocialProvider(input.provider)) throw redirect(303, '/join?social_error=unknown');
  try {
    const identity = await finishSocialOAuth({
      provider: input.provider, origin: input.origin,
      state: input.state, code: input.code, appleUser: input.appleUser
    });
    const mobile = Boolean(identity.mobileChallenge);
    const result = await createOrLoginSocialReporter(identity, mobile ? undefined : input.cookies);
    if (identity.mobileChallenge) {
      const target = await createMobileAuthHandoff(result.user!.id, identity.mobileChallenge);
      throw redirect(303, target);
    }
    throw redirect(303, '/report');
  } catch (e) {
    if (e && typeof e === 'object' && 'status' in e && 'location' in e) throw e;
    console.error('Public social sign-in failed:', e instanceof Error ? e.message : 'Unknown error');
    throw redirect(303, '/join?social_error=failed');
  }
}

export const GET: RequestHandler = async ({ params, url, cookies }) =>
  finish({
    provider: params.provider, origin: url.origin,
    state: url.searchParams.get('state') ?? '',
    code: url.searchParams.get('code') ?? '', cookies
  });

export const POST: RequestHandler = async ({ params, url, request, cookies }) => {
  const form = await request.formData();
  return finish({
    provider: params.provider, origin: url.origin, cookies,
    state: String(form.get('state') ?? ''), code: String(form.get('code') ?? ''),
    appleUser: String(form.get('user') ?? '')
  });
};
