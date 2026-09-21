import type { RescueHubUser } from '$lib/server/auth';

declare global {
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
