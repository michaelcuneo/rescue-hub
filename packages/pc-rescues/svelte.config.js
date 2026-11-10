import { preprocessMeltUI, sequence } from '@melt-ui/pp';
import adapter from 'svelte-kit-sst';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: sequence([vitePreprocess(), preprocessMeltUI()]),
  kit: {
    adapter: adapter(),
    // Apple returns a signed OAuth code using cross-origin form_post.
    // Trust Apple only; the callback independently validates one-time state.
    csrf: { trustedOrigins: ['https://appleid.apple.com'] }
  }
};

export default config;
