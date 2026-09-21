import type { Cookies } from '@sveltejs/kit';
import type { RescueHubUser } from '$lib/server/auth';

export const HUNTER_DEMO_ORGANISATION = 'native-animal-trust-fund';
const COOKIE = 'rescuehub_demo_org';

export function canUseHunterDemo(user: RescueHubUser | null | undefined) {
	return Boolean(user?.roles.includes('PLATFORM_ADMIN') || user?.roles.includes('AUTHORITY_ADMIN'));
}

export function getHunterDemo(cookies: Cookies, user: RescueHubUser | null | undefined) {
	if (!canUseHunterDemo(user)) return false;
	return cookies.get(COOKIE) === HUNTER_DEMO_ORGANISATION;
}

export function enterHunterDemo(cookies: Cookies) {
	cookies.set(COOKIE, HUNTER_DEMO_ORGANISATION, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: true,
		maxAge: 60 * 60 * 8
	});
}

export function exitHunterDemo(cookies: Cookies) {
	cookies.delete(COOKIE, { path: '/', secure: true });
}
