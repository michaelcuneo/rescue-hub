import { configuredSocialProviders } from '$lib/server/social-oauth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
  providers: configuredSocialProviders()
});
