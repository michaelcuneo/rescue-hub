import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
	DeleteCommand,
	DynamoDBDocumentClient,
	PutCommand,
	QueryCommand
} from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
	marshallOptions: { removeUndefinedValues: true }
});
const tableName = Resource.RescueHubData.name;

export type DispatchCapability =
	| 'BIRD'
	| 'MACROPOD'
	| 'POSSUM_GLIDER'
	| 'WOMBAT'
	| 'REPTILE_NON_VENOMOUS'
	| 'REPTILE_VENOMOUS'
	| 'BAT_FLYING_FOX'
	| 'RAPTOR'
	| 'MARINE'
	| 'OTHER';

export type MembershipTypeDefinition = {
	id: string;
	name: string;
	description: string;
	active: boolean;
};

export type TeamDefinition = {
	id: string;
	name: string;
	description: string;
	capabilityCode?: DispatchCapability;
	receivesAllRescues: boolean;
	active: boolean;
};

export type OrganisationMembershipConfig = {
	organisationId: string;
	membershipTypes: MembershipTypeDefinition[];
	teams: TeamDefinition[];
	source: 'STANDARD_DEFAULTS' | 'ORGANISATION';
};

export const STANDARD_MEMBERSHIP_TYPES: MembershipTypeDefinition[] = [
	{
		id: 'active-rescuer',
		name: 'Active rescuer',
		description: 'Active field rescuer eligible for organisation dispatch.',
		active: true
	},
	{
		id: 'probationary-rescuer',
		name: 'Probationary rescuer',
		description: 'Rescuer operating under organisation-specific supervision or restrictions.',
		active: true
	},
	{
		id: 'carer',
		name: 'Carer',
		description: 'Wildlife carer who may receive animals after rescue.',
		active: true
	},
	{
		id: 'transport-volunteer',
		name: 'Transport volunteer',
		description: 'Volunteer available to transport wildlife between rescue, vet and care.',
		active: true
	},
	{
		id: 'support-member',
		name: 'Support member',
		description: 'Organisation member without routine rescue dispatch.',
		active: true
	}
];

export const STANDARD_TEAMS: TeamDefinition[] = [
	{
		id: 'bird',
		name: 'Bird rescue',
		description: 'General native bird rescue.',
		capabilityCode: 'BIRD',
		receivesAllRescues: false,
		active: true
	},
	{
		id: 'raptor',
		name: 'Raptor rescue',
		description: 'Birds of prey requiring specialist handling.',
		capabilityCode: 'RAPTOR',
		receivesAllRescues: false,
		active: true
	},
	{
		id: 'macropod',
		name: 'Macropod rescue',
		description: 'Kangaroos, wallabies and related macropods.',
		capabilityCode: 'MACROPOD',
		receivesAllRescues: false,
		active: true
	},
	{
		id: 'possum-glider',
		name: 'Possum & glider rescue',
		description: 'Possums and gliders.',
		capabilityCode: 'POSSUM_GLIDER',
		receivesAllRescues: false,
		active: true
	},
	{
		id: 'wombat',
		name: 'Wombat rescue',
		description: 'Wombat rescue and transport.',
		capabilityCode: 'WOMBAT',
		receivesAllRescues: false,
		active: true
	},
	{
		id: 'reptile-non-venomous',
		name: 'Reptile — non-venomous',
		description: 'Non-venomous snakes and lizards.',
		capabilityCode: 'REPTILE_NON_VENOMOUS',
		receivesAllRescues: false,
		active: true
	},
	{
		id: 'reptile-venomous',
		name: 'Reptile — venomous',
		description: 'Venomous reptiles requiring appropriately authorised handlers.',
		capabilityCode: 'REPTILE_VENOMOUS',
		receivesAllRescues: false,
		active: true
	},
	{
		id: 'bat-flying-fox',
		name: 'Bat & flying fox',
		description: 'Flying fox and microbat rescue requiring appropriate vaccination/training.',
		capabilityCode: 'BAT_FLYING_FOX',
		receivesAllRescues: false,
		active: true
	},
	{
		id: 'marine',
		name: 'Marine wildlife',
		description: 'Marine wildlife response where the organisation supports it.',
		capabilityCode: 'MARINE',
		receivesAllRescues: false,
		active: true
	},
	{
		id: 'transport',
		name: 'Transport',
		description: 'Transport volunteers may be notified for any rescue requiring movement.',
		receivesAllRescues: true,
		active: true
	}
];

export async function getOrganisationMembershipConfig(
	organisationId: string
): Promise<OrganisationMembershipConfig> {
	const result = await db.send(new QueryCommand({
		TableName: tableName,
		KeyConditionExpression: 'pk = :pk',
		ExpressionAttributeValues: { ':pk': `ORG#${organisationId}` }
	}));

	const membershipTypes = (result.Items ?? [])
		.filter((item) => String(item.sk ?? '').startsWith('MEMBERSHIP_TYPE#'))
		.map((item) => ({
			id: String(item.id),
			name: String(item.name),
			description: String(item.description ?? ''),
			active: item.active !== false
		}));

	const teams = (result.Items ?? [])
		.filter((item) => String(item.sk ?? '').startsWith('TEAM#'))
		.map((item) => ({
			id: String(item.id),
			name: String(item.name),
			description: String(item.description ?? ''),
			capabilityCode: item.capabilityCode
				? String(item.capabilityCode) as DispatchCapability
				: undefined,
			receivesAllRescues: Boolean(item.receivesAllRescues),
			active: item.active !== false
		}));

	return {
		organisationId,
		membershipTypes: membershipTypes.length ? membershipTypes : STANDARD_MEMBERSHIP_TYPES,
		teams: teams.length ? teams : STANDARD_TEAMS,
		source: membershipTypes.length || teams.length ? 'ORGANISATION' : 'STANDARD_DEFAULTS'
	};
}

export function classifyDispatchCapability(type: string, breed = ''): DispatchCapability {
	const value = `${type} ${breed}`.toLowerCase();

	if (/eagle|hawk|falcon|kite|owl|raptor/.test(value)) return 'RAPTOR';
	if (/flying fox|flying-fox|microbat|\bbat\b/.test(value)) return 'BAT_FLYING_FOX';
	if (/kangaroo|wallaby|pademelon|wallaroo/.test(value)) return 'MACROPOD';
	if (/possum|glider/.test(value)) return 'POSSUM_GLIDER';
	if (/wombat/.test(value)) return 'WOMBAT';
	if (/brown snake|red[- ]bellied|tiger snake|death adder|taipan|venomous/.test(value)) {
		return 'REPTILE_VENOMOUS';
	}
	if (/snake|lizard|blue[- ]?tongue|dragon|skink|gecko|python/.test(value)) {
		return 'REPTILE_NON_VENOMOUS';
	}
	if (/turtle|sea snake|seal|dolphin|whale|marine/.test(value)) return 'MARINE';
	if (/bird|magpie|lorikeet|kookaburra|pelican|frogmouth|duck|cockatoo|galah|ibis/.test(value)) {
		return 'BIRD';
	}

	return 'OTHER';
}

export function teamMatchesCapability(
	team: TeamDefinition,
	capability: DispatchCapability
) {
	return team.active && (team.receivesAllRescues || team.capabilityCode === capability);
}

export function memberCanReceiveCapability(
	teamIds: string[],
	config: OrganisationMembershipConfig,
	capability: DispatchCapability
) {
	const selected = new Set(teamIds);
	return config.teams.some((team) => selected.has(team.id) && teamMatchesCapability(team, capability));
}


export async function saveOrganisationMembershipConfig(
	config: OrganisationMembershipConfig
) {
	const pk = `ORG#${config.organisationId}`;
	const existing = await db.send(new QueryCommand({
		TableName: tableName,
		KeyConditionExpression: 'pk = :pk',
		ExpressionAttributeValues: { ':pk': pk }
	}));

	const managedKeys = (existing.Items ?? [])
		.filter((item) =>
			String(item.sk ?? '').startsWith('MEMBERSHIP_TYPE#') ||
			String(item.sk ?? '').startsWith('TEAM#')
		)
		.map((item) => ({ pk, sk: String(item.sk) }));

	await Promise.all(managedKeys.map((key) =>
		db.send(new DeleteCommand({ TableName: tableName, Key: key }))
	));

	const now = new Date().toISOString();

	await Promise.all([
		...config.membershipTypes.map((type) =>
			db.send(new PutCommand({
				TableName: tableName,
				Item: {
					pk,
					sk: `MEMBERSHIP_TYPE#${type.id}`,
					entity: 'membership_type',
					id: type.id,
					name: type.name,
					description: type.description,
					active: type.active,
					updatedAt: now
				}
			}))
		),
		...config.teams.map((team) =>
			db.send(new PutCommand({
				TableName: tableName,
				Item: {
					pk,
					sk: `TEAM#${team.id}`,
					entity: 'dispatch_team',
					id: team.id,
					name: team.name,
					description: team.description,
					capabilityCode: team.capabilityCode,
					receivesAllRescues: team.receivesAllRescues,
					active: team.active,
					updatedAt: now
				}
			}))
		)
	]);
}
