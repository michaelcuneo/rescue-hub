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

export const data = writable<RescueData>({
	pending: [
		{
			id: 'awmdfk3k2rtnmr',
			longitude: 151.7306,
			latitude: -32.9242,
			type: 'Bird',
			breed: 'Unknown',
			location: 'Broadmeadow',
			disabled: false,
			color: 'd2222d',
			injury: 'Unable to fly',
			createdAt: '2026-09-20T00:20:00.000Z',
			updatedAt: '2026-09-20T00:20:00.000Z'
		},
		{
			id: 'asdasfq34qwf4',
			longitude: 151.635,
			latitude: -33.0852,
			type: 'Bird',
			breed: 'Pelican',
			location: 'Swansea',
			disabled: false,
			color: 'd2222d',
			injury: 'Fishing line entanglement',
			createdAt: '2026-09-20T00:05:00.000Z',
			updatedAt: '2026-09-20T00:05:00.000Z'
		}
	],
	assigned: [
		{
			id: 'g4e5ag4aeg4ea4g',
			longitude: 151.6568,
			latitude: -32.9482,
			type: 'Snake',
			breed: 'Brown',
			location: 'Cardiff',
			disabled: false,
			color: 'ffbf00',
			injury: 'Vehicle strike',
			assignedUserId: 'demo-rescuer-1',
			createdAt: '2026-09-19T23:40:00.000Z',
			updatedAt: '2026-09-20T00:08:00.000Z'
		},
		{
			id: 'fasoiufdna8sfh7',
			longitude: 151.6827,
			latitude: -32.9925,
			type: 'Possum',
			breed: 'Brushtail',
			location: 'Windale',
			disabled: false,
			color: 'ffbf00',
			injury: 'Cat attack',
			assignedUserId: 'demo-rescuer-2',
			createdAt: '2026-09-19T23:25:00.000Z',
			updatedAt: '2026-09-20T00:00:00.000Z'
		}
	],
	completed: [
		{
			id: 'gae4fgaw34faw4t',
			longitude: 151.7364,
			latitude: -32.8974,
			type: 'Wombat',
			breed: '-',
			location: 'Mayfield',
			disabled: false,
			color: '238823',
			injury: 'Vehicle strike',
			createdAt: '2026-09-19T21:30:00.000Z',
			updatedAt: '2026-09-19T23:20:00.000Z'
		}
	]
});
