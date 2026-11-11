import { preprocessMeltUI, sequence } from '@melt-ui/pp';
import adapter from 'svelte-kit-sst';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: sequence([vitePreprocess(), preprocessMeltUI()]),
  kit: {
    adapter: adapter(),
    // Apple's external OAuth form_post is a genuine third-party POST.
    // The organisation invitation form is SAME-ORIGIN; its referrer policy
    // must preserve the Origin header instead of bypassing CSRF here.
    csrf: { trustedOrigins: ['https://appleid.apple.com'] }
  }
};

export default config;
