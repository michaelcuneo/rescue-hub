import { json, type Handle } from '@sveltejs/kit';
import { getCurrentUser } from '$lib/server/auth';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function isCrossOriginMutation(event: Parameters<Handle>[0]['event']) {
	if (SAFE_METHODS.has(event.request.method.toUpperCase())) return false;
	const origin = event.request.headers.get('origin');
	if (!origin) return false;
	try { return new URL(origin).origin !== event.url.origin; } catch { return true; }
}

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/api/') && isCrossOriginMutation(event)) {
		return json({ error: 'Cross-origin request rejected.' }, { status: 403 });
	}
	try {
		event.locals.user = await getCurrentUser(event.cookies, event.request.headers.get('authorization'));
	} catch (error) {
		console.error('Unable to resolve Rescue Hub session', error);
		event.locals.user = null;
	}
	const response = await resolve(event);
	if (event.url.pathname.startsWith('/admin')) {
		response.headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
		response.headers.set('cache-control', 'private, no-store, max-age=0');
	}
	return response;
};
