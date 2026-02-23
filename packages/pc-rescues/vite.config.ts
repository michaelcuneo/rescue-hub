import { sveltekit } from '@sveltejs/kit/vite';
import mkcert from 'vite-plugin-mkcert'
import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		https: true,
		port: 3000,
		host: '0.0.0.0',
	},
	plugins: [sveltekit(), mkcert()],
});
