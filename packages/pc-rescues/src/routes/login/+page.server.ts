import { fail, redirect } from '@sveltejs/kit';
import { hasCompletedBootstrap, loginUser, loginPublicDemo, type RescueHubUser } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

function loginDestination(user: RescueHubUser, next: string | null) {
	// Honour explicitly requested local destinations, but never redirect off-site.
	if (user.roles.includes('PUBLIC_REPORTER')) return '/login';
  if (user.roles.includes('VET_STAFF')) return '/vet';
	if (next?.startsWith('/') && !next.startsWith('//') && !next.includes('\\')) return next;
	return user.roles.includes('PLATFORM_ADMIN') || user.roles.includes('AUTHORITY_ADMIN') ? '/admin' : '/';
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!await hasCompletedBootstrap()) throw redirect(303, '/setup');
	if (locals.user) throw redirect(303, loginDestination(locals.user, url.searchParams.get('next')));
	return { next: url.searchParams.get('next') || '/', publicDemoEnabled: process.env.RESCUE_HUB_PUBLIC_DEMO_ENABLED === 'true' };
};

export const actions: Actions = {
  demo: async ({ cookies }) => {
    try {
      await loginPublicDemo(cookies);
    } catch {
      return fail(503, { error: 'The public demo is temporarily unavailable.' });
    }
    throw redirect(303, '/');
  },
	default: async ({ request, cookies, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const password = String(form.get('password') ?? '');
		let user: RescueHubUser;
		try {
			({ user } = await loginUser(email, password, cookies));
		} catch {
			return fail(401, { error: 'Invalid email or password.', email });
		}

		throw redirect(303, loginDestination(user, url.searchParams.get('next')));
	}
};
