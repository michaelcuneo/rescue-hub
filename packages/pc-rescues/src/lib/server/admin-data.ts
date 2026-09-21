import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
	DynamoDBDocumentClient,
	QueryCommand
} from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import type {
	OrganisationDirectoryEntry,
	Rescue
} from '$lib/server/graphql';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
	marshallOptions: { removeUndefinedValues: true }
});
const tableName = Resource.RescueHubData.name;

export type AuditEvent = {
	id: string;
	organisationId?: string;
	action: string;
	summary: string;
	actorUserId?: string;
	createdAt: string;
	demo?: boolean;
};

async function queryIndex(pk: string, limit = 200) {
	const result = await db.send(new QueryCommand({
		TableName: tableName,
		IndexName: 'gsi2',
		KeyConditionExpression: 'gsi2pk = :pk',
		ExpressionAttributeValues: { ':pk': pk },
		ScanIndexForward: false,
		Limit: limit
	}));

	return result.Items ?? [];
}

export async function listAdminOrganisations(): Promise<OrganisationDirectoryEntry[]> {
	const items = await queryIndex('ORGANISATIONS#NSW', 100);

	return items.map((item) => ({
		id: String(item.id),
		authorityId: String(item.authorityId),
		jurisdiction: String(item.jurisdiction),
		officialName: String(item.officialName),
		displayName: String(item.displayName),
		areaDescription: String(item.areaDescription),
		speciesSpeciality: String(item.speciesSpeciality),
		boundaryStatus: String(item.boundaryStatus),
		aliases: Array.isArray(item.aliases) ? item.aliases.map(String) : [],
		sourceType: String(item.sourceType),
		sourceUrl: String(item.sourceUrl),
		sourceUpdatedAt: String(item.sourceUpdatedAt)
	}));
}

export async function listAdminRescues(): Promise<Rescue[]> {
	const items = await queryIndex('RESCUES', 200);

	return items.map((item) => ({
		id: String(item.id),
		organisationId: item.organisationId ? String(item.organisationId) : null,
		type: String(item.type),
		breed: item.breed ? String(item.breed) : null,
		location: item.location ? String(item.location) : null,
		latitude: Number(item.latitude),
		longitude: Number(item.longitude),
		injury: item.injury ? String(item.injury) : null,
		status: String(item.status) as Rescue['status'],
		assignedUserId: item.assignedUserId ? String(item.assignedUserId) : null,
		createdAt: String(item.createdAt),
		updatedAt: String(item.updatedAt)
	}));
}

export async function listAdminAuditEvents(): Promise<AuditEvent[]> {
	const items = await queryIndex('AUDIT', 200);

	return items.map((item) => ({
		id: String(item.id),
		organisationId: item.organisationId ? String(item.organisationId) : undefined,
		action: String(item.action),
		summary: String(item.summary),
		actorUserId: item.actorUserId ? String(item.actorUserId) : undefined,
		createdAt: String(item.createdAt),
		demo: Boolean(item.demo)
	}));
}
