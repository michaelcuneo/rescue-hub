import { getOrganisations, getRescues } from '$lib/server/graphql';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const [organisationsResult, rescuesResult] = await Promise.allSettled([
    getOrganisations(100),
    getRescues(undefined, 100)
  ]);

  const organisations =
    organisationsResult.status === 'fulfilled'
      ? organisationsResult.value.items
      : [];

  const rescues =
    rescuesResult.status === 'fulfilled'
      ? rescuesResult.value.items
      : [];

  const errors = [
    organisationsResult.status === 'rejected'
      ? `Organisation directory: ${String(organisationsResult.reason)}`
      : null,
    rescuesResult.status === 'rejected'
      ? `Rescue data: ${String(rescuesResult.reason)}`
      : null
  ].filter((value): value is string => Boolean(value));

  return {
    organisations,
    rescues,
    backend: {
      online: errors.length === 0,
      errors
    }
  };
};
