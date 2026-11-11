import { writable } from 'svelte/store';

export type RescueItem = {
	id: string;
	longitude: number;
	latitude: number;
	type: string;
	breed?: string | null;
	location?: string | null;
	disabled?: boolean;
	color: string;
	injury?: string | null;
	assignedUserId?: string | null;
	animalStatus?: string | null;
	intakeSource?: 'PHONE' | 'ONLINE' | null;
	pickedUpAt?: string | null;
	transportAnimalId?: string | null;
	awaitingCarer?: boolean | null;
	transportSourceRescueId?: string | null;
	createdAt?: string;
	updatedAt?: string;
	status?: string;
};

export type RescueHubPerson = {
	id: string;
	name: string;
	email: string;
	roles: string[];
	organisationId?: string;
    enabled: boolean;
    status: 'INVITED' | 'ACTIVE' | 'REMOVED';
    availabilityStatus: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
    teamIds: string[];
};

export type RescueData = {
	pending: RescueItem[];
	assigned: RescueItem[];
	completed: RescueItem[];
};

export type DraftLocation = {
	longitude: number;
	latitude: number;
	label: string;
};

export const coords = writable<[number, number]>([151.771274, -32.927406]);
export const mapRef = writable<any>(undefined);
export const selectedRescue = writable<RescueItem | null>(null);
export const intakeOpen = writable(false);
export const draftLocation = writable<DraftLocation | null>(null);
export const available = writable(true);
export const people = writable<RescueHubPerson[]>([]);

export const data = writable<RescueData>({ pending: [], assigned: [], completed: [] });
