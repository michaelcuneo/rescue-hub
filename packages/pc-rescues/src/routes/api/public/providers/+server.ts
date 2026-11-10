import { json } from '@sveltejs/kit';
import { configuredSocialProviders } from '$lib/server/social-oauth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
  json({ providers: configuredSocialProviders() }, {
    headers: { 'cache-control': 'no-store' }
  });
