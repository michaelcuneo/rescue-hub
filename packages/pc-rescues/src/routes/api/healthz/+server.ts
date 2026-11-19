import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Lightweight public availability probe. Never return credentials, deployment
// stage, AWS resource identifiers, user data, or private operational details.
export const GET: RequestHandler = async () =>
  json({ status: 'ok' }, {
    headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
  });
