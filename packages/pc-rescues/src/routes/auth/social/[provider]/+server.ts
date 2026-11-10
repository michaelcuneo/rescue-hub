import { error, redirect } from '@sveltejs/kit';
import { isSocialProvider, startSocialOAuth } from '$lib/server/social-oauth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
  if (!isSocialProvider(params.provider)) error(404, 'Unknown sign-in provider.');
  try {
    const destination = await startSocialOAuth(params.provider, url.origin);
    redirect(303, destination);
  } catch (e) {
    // SvelteKit redirects throw Response-like objects and must not be swallowed.
    if (e && typeof e === 'object' && 'status' in e && 'location' in e) throw e;
    error(503, e instanceof Error ? e.message : 'Social sign-in is unavailable.');
  }
};
