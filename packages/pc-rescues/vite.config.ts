import { sveltekit } from '@sveltejs/kit/vite';
import mkcert from 'vite-plugin-mkcert';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
	server: {
		port: 3000,
		host: '0.0.0.0'
	},
	plugins: [sveltekit(), ...(command === 'serve' ? [mkcert()] : [])]
}));
