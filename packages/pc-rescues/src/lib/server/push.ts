import { createHash } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import {
	classifyDispatchCapability,
	getOrganisationMembershipConfig,
	memberCanReceiveCapability
} from './membership';
import type { RescueHubUser } from './auth';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
	marshallOptions: { removeUndefinedValues: true }
});
const tableName = Resource.RescueHubData.name;

export async function registerPushDevice(input: {
	userId: string;
	pushToken: string;
	platform: 'ios' | 'android';
	deviceName?: string;
}) {
	const token = input.pushToken.trim();
	if (!/^ExponentPushToken\[.+\]$|^ExpoPushToken\[.+\]$/.test(token)) {
		throw new Error('Invalid Expo push token.');
	}
	const tokenId = createHash('sha256').update(token).digest('hex');
	await db.send(new PutCommand({
		TableName: tableName,
		Item: {
			pk: `USER#${input.userId}`,
			sk: `DEVICE#${tokenId}`,
			entity: 'push_device',
			pushToken: token,
			platform: input.platform,
			deviceName: input.deviceName ?? '',
			enabled: true,
			updatedAt: new Date().toISOString()
		}
	}));
}

async function listOrganisationUsers(organisationId: string): Promise<RescueHubUser[]> {
	const result = await db.send(new QueryCommand({
		TableName: tableName,
		IndexName: 'gsi1',
		KeyConditionExpression: 'gsi1pk = :pk',
		ExpressionAttributeValues: { ':pk': `ORG#${organisationId}#USERS` }
	}));
	return (result.Items ?? []).map((item) => ({
		id: String(item.id),
		email: String(item.email),
		name: String(item.name),
		enabled: Boolean(item.enabled),
		status: String(item.status ?? 'ACTIVE') as RescueHubUser['status'],
		emailVerified: Boolean(item.emailVerified),
		organisationId: item.organisationId ? String(item.organisationId) : undefined,
		roles: Array.isArray(item.roles) ? item.roles.map(String) as RescueHubUser['roles'] : [],
		membershipTypeId: item.membershipTypeId ? String(item.membershipTypeId) : undefined,
		teamIds: Array.isArray(item.teamIds) ? item.teamIds.map(String) : [],
		availabilityStatus: ['AVAILABLE', 'BUSY', 'OFFLINE'].includes(String(item.availabilityStatus))
			? String(item.availabilityStatus) as RescueHubUser['availabilityStatus']
			: 'OFFLINE',
		createdAt: String(item.createdAt),
		updatedAt: String(item.updatedAt ?? item.createdAt)
	}));
}

async function pushTokensForUser(userId: string) {
	const result = await db.send(new QueryCommand({
		TableName: tableName,
		KeyConditionExpression: 'pk = :pk AND begins_with(sk, :device)',
		ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':device': 'DEVICE#' }
	}));
	return (result.Items ?? [])
		.filter((item) => item.enabled !== false && typeof item.pushToken === 'string')
		.map((item) => String(item.pushToken));
}

export async function notifyEligibleRescuers(input: {
	id: string;
	organisationId: string;
	type: string;
	breed?: string;
	location?: string;
	injury?: string;
}) {
	const capability = classifyDispatchCapability(input.type, input.breed ?? '');
	const [config, users] = await Promise.all([
		getOrganisationMembershipConfig(input.organisationId),
		listOrganisationUsers(input.organisationId)
	]);

	const eligible = users.filter((user) =>
		user.enabled &&
		user.status === 'ACTIVE' &&
		user.availabilityStatus === 'AVAILABLE' &&
		memberCanReceiveCapability(user.teamIds, config, capability)
	);

	const tokens = [...new Set((await Promise.all(eligible.map((user) => pushTokensForUser(user.id)))).flat())];
	if (!tokens.length) return { capability, eligibleUsers: eligible.length, pushTokens: 0 };

	const response = await fetch('https://exp.host/--/api/v2/push/send', {
		method: 'POST',
		headers: { 'content-type': 'application/json', accept: 'application/json' },
		body: JSON.stringify(tokens.map((to) => ({
			to,
			sound: 'default',
			title: `${input.type} rescue available`,
			body: [input.location, input.injury].filter(Boolean).join(' · ').slice(0, 180),
			data: { rescueId: input.id, organisationId: input.organisationId, capability }
		})))
	});
	if (!response.ok) throw new Error(`Expo push request failed: ${response.status}`);
	return { capability, eligibleUsers: eligible.length, pushTokens: tokens.length };
}
