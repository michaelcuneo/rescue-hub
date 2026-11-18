import type { RescueHubUser } from '$lib/server/auth';

declare global {
  // Replaced by Vite at build time; available in SSR and browser bundles.
  const __RESCUE_HUB_BUILD_INFO__: {
    version: string;
    gitCommit: string | null;
    gitBranch: string | null;
    builtAt: string;
  };
	namespace App {
		interface Locals {
			user: RescueHubUser | null;
		}
		interface PageState {
			dialogOpen?: string;
			accordionSelected?: string;
		}
	}
}

export {};
