import { fail, redirect } from '@sveltejs/kit';
import { acceptInvite, getInvitation } from '$lib/server/auth';
import { validateInvitationPasswordConfirmation } from '../../../../core/invitation-password';
import type { Actions, PageServerLoad } from './$types';

const COOKIE = 'rescuehub_pending_invitation';
const cookieOptions = { path: '/activate', httpOnly: true, secure: true, sameSite: 'lax' as const, maxAge: 7 * 24 * 60 * 60 };

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
  const link = url.searchParams.get('invite');
  if (link !== null) {
    // Email scanners may GET the link. We validate but never consume it until
    // the intended recipient chooses a password and submits the form.
    cookies.delete(COOKIE, { path: '/activate' });
    if (await getInvitation(link)) cookies.set(COOKIE, link, cookieOptions);
    // Strip the bearer token from the address bar before rendering any HTML.
    throw redirect(303, '/activate');
  }

  const invitation = await getInvitation(cookies.get(COOKIE));
  if (!invitation) cookies.delete(COOKIE, { path: '/activate' });
  if (locals.user && !invitation) {
    throw redirect(303, locals.user.roles.some(role => role === 'PLATFORM_ADMIN' || role === 'AUTHORITY_ADMIN') ? '/admin' : '/');
  }
  return { invitation };
};

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const form = await request.formData();
    const password = String(form.get('password') ?? '');
    const confirmation = String(form.get('confirmPassword') ?? '');
    const confirmationError = validateInvitationPasswordConfirmation(password, confirmation);
    if (confirmationError) return fail(400, { error: confirmationError });
    const credential = cookies.get(COOKIE);
    if (!credential) return fail(400, { error: 'Your invitation link has expired. Ask your organisation administrator to resend it.' });
    try {
      await acceptInvite(credential, password, cookies);
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : 'Unable to activate invitation.' });
    }
    cookies.delete(COOKIE, { path: '/activate' });
    throw redirect(303, '/');
  }
};
