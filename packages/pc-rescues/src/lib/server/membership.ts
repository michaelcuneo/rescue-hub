import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
	DeleteCommand,
	DynamoDBDocumentClient,
	PutCommand,
	QueryCommand
} from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { australianAnimalGroups } from '$lib/data/australian-animals';
import { classifySpeciesCapability, findCatalogueGroup, matchesSpeciesTeam, type SpeciesCapability } from '../../../../core/dispatch-species';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
	marshallOptions: { removeUndefinedValues: true }
});
const tableName = Resource.RescueHubData.name;

export type DispatchCapability = SpeciesCapability;

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

export type OrganisationPosition = { id: string; name: string; active: boolean };
export type OrganisationMembershipConfig = {
	organisationId: string;
	membershipTypes: MembershipTypeDefinition[];
	teams: TeamDefinition[];
  positions: OrganisationPosition[];
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
		id: 'amphibian',
		name: 'Native amphibian rescue',
		description: 'Frogs and native amphibians; not invasive cane toads.',
		capabilityCode: 'AMPHIBIAN',
		receivesAllRescues: false,
		active: true
	},
	{
		id: 'invasive',
		name: 'Authorised invasive species response',
		description: 'Separate specialist pathway for cane toads and invasive wildlife reports; not general native rescue.',
		capabilityCode: 'INVASIVE',
		receivesAllRescues: false,
		active: true
	},
	{
		id: 'mammal',
		name: 'Other native mammal rescue',
		description: 'Native mammals not already covered by specialist macropod, possum or wombat teams.',
		capabilityCode: 'MAMMAL',
		receivesAllRescues: false,
		active: true
	},
	{
		id: 'invertebrate',
		name: 'Invertebrate rescue',
		description: 'Specialist invertebrate response.',
		capabilityCode: 'INVERTEBRATE',
		receivesAllRescues: false,
		active: true
	},
	{
		id: 'non-native',
		name: 'Domestic and introduced animal triage',
		description: 'Specialist referral for domestic and non-native animals, separate from native wildlife rehabilitation.',
		capabilityCode: 'NON_NATIVE',
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

  const positions = (result.Items ?? [])
    .filter(item => String(item.sk ?? '').startsWith('POSITION#'))
    .map(item => ({ id: String(item.id), name: String(item.name), active: item.active !== false }));
	return {
		organisationId,
		positions,
		membershipTypes: membershipTypes.length ? membershipTypes : STANDARD_MEMBERSHIP_TYPES,
		teams: teams.length ? teams : STANDARD_TEAMS,
		source: membershipTypes.length || teams.length || positions.length ? 'ORGANISATION' : 'STANDARD_DEFAULTS'
	};
}

export function classifyDispatchCapability(type: string, breed = ''): DispatchCapability {
	const catalogueGroup = findCatalogueGroup(type, breed, australianAnimalGroups);
	return classifySpeciesCapability(type, breed, catalogueGroup);
}

export function teamMatchesCapability(team: TeamDefinition, capability: DispatchCapability) {
	// The transport group is NOT a universal species accreditation.
	// Transport jobs have a separate transport membership/claim pathway.
	return matchesSpeciesTeam(team, capability);
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

/** Manage organisation-specific governance/committee titles, not login roles. */
export async function addOrganisationPosition(organisationId: string, nameInput: string) {
  const name = nameInput.trim();
  if (!name || name.length > 80 || /[\\u0000-\\u001f\\u007f]/.test(name))
    throw new Error('Enter a position name of up to 80 readable characters.');
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 72);
  if (!id) throw new Error('Position must contain letters or numbers.');
  await db.send(new PutCommand({
    TableName: tableName, Item: {
      pk: `ORG#${organisationId}`, sk: `POSITION#${id}`,
      entity: 'organisation_position', id, name, active: true, updatedAt: new Date().toISOString()
    },
    ConditionExpression: 'attribute_not_exists(pk)'
  }));
  return { id, name, active: true };
}

export async function deactivateOrganisationPosition(organisationId: string, positionId: string) {
  if (!/^[a-z0-9-]{1,72}$/.test(positionId)) throw new Error('Invalid position ID.');
  const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
  await db.send(new UpdateCommand({
    TableName: tableName, Key: { pk: `ORG#${organisationId}`, sk: `POSITION#${positionId}` },
    UpdateExpression: 'SET active = :inactive, updatedAt = :now',
    ConditionExpression: 'attribute_exists(pk)',
    ExpressionAttributeValues: { ':inactive': false, ':now': new Date().toISOString() }
  }));
}
