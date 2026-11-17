import { json, type Handle } from '@sveltejs/kit';
import { getCurrentUser, logoutUser } from '$lib/server/auth';
import { mayUseDesktopPortal } from '../../../core/desktop-portal-access';

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
		const authorization = event.request.headers.get('authorization');
		event.locals.user = await getCurrentUser(event.cookies, authorization);
		if (event.locals.user && !mayUseDesktopPortal(event.locals.user)) {
			// Bearer-authenticated mobile API endpoints stay available to reporters.
			const bearer = /^Bearer\s+\S+/i.test(authorization ?? '');
			if (!(bearer && event.url.pathname.startsWith('/api/'))) {
				if (!bearer) await logoutUser(event.cookies);
				event.locals.user = null;
			}
		}
	} catch (error) {
		console.error('Unable to resolve Rescue Hub session', error);
		event.locals.user = null;
	}
	const response = await resolve(event);
	if (event.url.pathname === '/activate' || event.url.pathname === '/api/auth/activate') {
		response.headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
		response.headers.set('cache-control', 'private, no-store, max-age=0');
		// `no-referrer` makes ordinary HTML form POSTs send `Origin: null`,
		// which SvelteKit correctly rejects as CSRF. `origin` sends only the
		// scheme/host (never the secret invite token or URL path).
		response.headers.set('referrer-policy', 'origin');
	}
	if (event.url.pathname.startsWith('/admin')) {
		response.headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
		response.headers.set('cache-control', 'private, no-store, max-age=0');
	}
	return response;
};
