import { preprocessMeltUI, sequence } from '@melt-ui/pp';
import adapter from 'svelte-kit-sst';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: sequence([vitePreprocess(), preprocessMeltUI()]),
  kit: {
    adapter: adapter(),
    // Behind CloudFront/SST, the server URL can be derived from an internal
    // host instead of the public HTTPS domain. SvelteKit's CSRF check compares
    // the browser Origin against that URL for every HTML form POST. Trust only
    // our own public website origin (and Apple's OAuth form_post callback).
    // Never disable CSRF or use trustedOrigins: ['*'].
    csrf: {
      trustedOrigins: [
        'https://rescue.michaelcuneo.com.au',
        'https://appleid.apple.com'
      ]
    }
  }
};

export default config;
