import { fail } from '@sveltejs/kit';
import {
	deleteIdentity,
	inviteIdentity,
	listIdentities,
	resetIdentityPassword,
	setIdentityEnabled
} from '$lib/server/users';
import { getOrganisations, getRescues } from '$lib/server/graphql';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const [organisationsResult, rescuesResult, usersResult] = await Promise.allSettled([
    getOrganisations(100),
    getRescues(undefined, 100),
    listIdentities()
  ]);

  const organisations =
    organisationsResult.status === 'fulfilled'
      ? organisationsResult.value.items
      : [];

  const rescues =
    rescuesResult.status === 'fulfilled'
      ? rescuesResult.value.items
      : [];

  const users = usersResult.status === 'fulfilled' ? usersResult.value : [];

  const errors = [
    organisationsResult.status === 'rejected'
      ? `Organisation directory: ${String(organisationsResult.reason)}`
      : null,
    rescuesResult.status === 'rejected'
      ? `Rescue data: ${String(rescuesResult.reason)}`
      : null,
    usersResult.status === 'rejected'
      ? `User directory: ${String(usersResult.reason)}`
      : null
  ].filter((value): value is string => Boolean(value));

  return {
    organisations,
    rescues,
    users,
    backend: {
      online: errors.length === 0,
      errors
    }
  };
};



function requiredString(form: FormData, key: string) {
	const value = form.get(key);
	return typeof value === 'string' ? value.trim() : '';
}

export const actions: Actions = {
	inviteUser: async ({ request }) => {
		const form = await request.formData();
		const name = requiredString(form, 'name');
		const email = requiredString(form, 'email').toLowerCase();

		if (!name || !email || !email.includes('@')) {
			return fail(400, { action: 'inviteUser', error: 'Name and a valid email are required.' });
		}

		try {
			await inviteIdentity({ name, email });
			return { action: 'inviteUser', success: true };
		} catch (error) {
			return fail(500, {
				action: 'inviteUser',
				error: error instanceof Error ? error.message : 'Unable to create user.'
			});
		}
	},

	disableUser: async ({ request }) => {
		const form = await request.formData();
		const username = requiredString(form, 'username');
		if (!username) return fail(400, { action: 'disableUser', error: 'User is required.' });

		await setIdentityEnabled(username, false);
		return { action: 'disableUser', success: true };
	},

	enableUser: async ({ request }) => {
		const form = await request.formData();
		const username = requiredString(form, 'username');
		if (!username) return fail(400, { action: 'enableUser', error: 'User is required.' });

		await setIdentityEnabled(username, true);
		return { action: 'enableUser', success: true };
	},

	resetPassword: async ({ request }) => {
		const form = await request.formData();
		const username = requiredString(form, 'username');
		if (!username) return fail(400, { action: 'resetPassword', error: 'User is required.' });

		await resetIdentityPassword(username);
		return { action: 'resetPassword', success: true };
	},

	removeUser: async ({ request }) => {
		const form = await request.formData();
		const username = requiredString(form, 'username');
		if (!username) return fail(400, { action: 'removeUser', error: 'User is required.' });

		await deleteIdentity(username);
		return { action: 'removeUser', success: true };
	}
};
