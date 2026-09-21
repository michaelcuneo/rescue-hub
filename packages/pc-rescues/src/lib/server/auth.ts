import { createHash, randomBytes, randomInt, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import {
	DeleteCommand,
	DynamoDBDocumentClient,
	GetCommand,
	PutCommand,
	QueryCommand,
	TransactWriteCommand,
	UpdateCommand
} from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import type { Cookies } from '@sveltejs/kit';

const scrypt = promisify(scryptCallback);
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
	marshallOptions: { removeUndefinedValues: true }
});
const ses = new SESv2Client({});
const tableName = Resource.RescueHubData.name;

const SESSION_COOKIE = 'rescuehub_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const CODE_TTL_SECONDS = 60 * 15;
const CODE_RESEND_SECONDS = 60;
const MAX_CODE_ATTEMPTS = 8;

export type RescueHubRole =
	| 'PLATFORM_ADMIN'
	| 'AUTHORITY_ADMIN'
	| 'AUTHORITY_AUDITOR'
	| 'ORG_ADMIN'
	| 'DISPATCHER'
	| 'RESCUER'
	| 'CARER'
	| 'DATA_STEWARD';

export type RescueHubUser = {
	id: string;
	email: string;
	name: string;
	enabled: boolean;
	status: 'INVITED' | 'ACTIVE' | 'REMOVED';
	emailVerified: boolean;
	organisationId?: string;
	roles: RescueHubRole[];
	membershipTypeId?: string;
	teamIds: string[];
	availabilityStatus: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
	createdAt: string;
	updatedAt: string;
};

type CodePurpose = 'INVITE' | 'RESET_PASSWORD';

function normalizeEmail(value: string) {
	return value.trim().toLowerCase();
}

function hashToken(value: string) {
	return createHash('sha256').update(value).digest('hex');
}

function mailFrom() {
	return String(Resource.RescueHubMailFrom.value ?? '').trim();
}

function cookieOptions(maxAge?: number) {
	return {
		path: '/',
		httpOnly: true as const,
		sameSite: 'lax' as const,
		secure: true,
		...(maxAge === undefined ? {} : { maxAge })
	};
}

async function hashPassword(password: string) {
	const salt = randomBytes(16);
	const derived = (await scrypt(password, salt, 64)) as Buffer;
	return { salt: salt.toString('base64'), hash: derived.toString('base64') };
}

async function verifyPassword(password: string, saltBase64: string, expectedBase64: string) {
	const expected = Buffer.from(expectedBase64, 'base64');
	const actual = (await scrypt(password, Buffer.from(saltBase64, 'base64'), expected.length)) as Buffer;
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function validatePassword(password: string) {
	if (password.length < 10) return 'Password must be at least 10 characters.';
	if (password.length > 256) return 'Password is too long.';
	return null;
}

function toUser(item: Record<string, unknown>): RescueHubUser {
	return {
		id: String(item.id),
		email: String(item.email),
		name: String(item.name),
		enabled: Boolean(item.enabled),
		status: String(item.status ?? 'ACTIVE') as RescueHubUser['status'],
		emailVerified: Boolean(item.emailVerified),
		organisationId: item.organisationId ? String(item.organisationId) : undefined,
		roles: Array.isArray(item.roles) ? item.roles.map(String) as RescueHubRole[] : [],
		membershipTypeId: item.membershipTypeId ? String(item.membershipTypeId) : undefined,
		teamIds: Array.isArray(item.teamIds) ? item.teamIds.map(String) : [],
		availabilityStatus: ['AVAILABLE', 'BUSY', 'OFFLINE'].includes(String(item.availabilityStatus))
			? String(item.availabilityStatus) as RescueHubUser['availabilityStatus']
			: 'OFFLINE',
		createdAt: String(item.createdAt),
		updatedAt: String(item.updatedAt ?? item.createdAt)
	};
}

async function getUserRecord(userId: string) {
	const result = await db.send(new GetCommand({
		TableName: tableName,
		Key: { pk: `USER#${userId}`, sk: 'PROFILE' }
	}));
	return result.Item ?? null;
}

export async function getUserById(userId: string) {
	const record = await getUserRecord(userId);
	return record ? toUser(record) : null;
}

async function lookupUserIdByEmail(emailInput: string) {
	const result = await db.send(new GetCommand({
		TableName: tableName,
		Key: { pk: `AUTH#EMAIL#${normalizeEmail(emailInput)}`, sk: 'USER' }
	}));
	return result.Item?.userId ? String(result.Item.userId) : null;
}

function generateCode() {
	return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

async function sendCode(email: string, code: string, purpose: CodePurpose) {
	const sender = mailFrom();
	if (!sender) {
		if (process.env.NODE_ENV !== 'production') {
			console.info(`[Rescue Hub auth] ${purpose} ${email}: ${code}`);
			return;
		}
		throw new Error('Rescue Hub email delivery is not configured.');
	}

	const invitation = purpose === 'INVITE';
	const subject = invitation ? 'Your Rescue Hub invitation' : 'Reset your Rescue Hub password';
	const heading = invitation ? 'RESCUE HUB INVITATION' : 'RESET YOUR PASSWORD';
	const intro = invitation
		? 'Use this six-digit code to activate your Rescue Hub account and choose a password.'
		: 'Use this six-digit code to choose a new Rescue Hub password.';
	const text = `${heading}\n\n${intro}\n\n${code}\n\nThis code expires in 15 minutes.`;

	await ses.send(new SendEmailCommand({
		FromEmailAddress: sender,
		Destination: { ToAddresses: [email] },
		Content: {
			Simple: {
				Subject: { Data: subject, Charset: 'UTF-8' },
				Body: { Text: { Data: text, Charset: 'UTF-8' } }
			}
		}
	}));
}

async function issueCode(purpose: CodePurpose, userId: string, emailInput: string) {
	const email = normalizeEmail(emailInput);
	const key = { pk: `AUTHCODE#${purpose}#${email}`, sk: 'META' };
	const previous = await db.send(new GetCommand({ TableName: tableName, Key: key }));
	const previousAt = previous.Item?.createdAt ? Date.parse(String(previous.Item.createdAt)) : 0;

	if (previousAt && Date.now() - previousAt < CODE_RESEND_SECONDS * 1000) {
		throw new Error('Please wait a minute before requesting another code.');
	}

	const code = generateCode();
	const now = Math.floor(Date.now() / 1000);
	const expiresAt = now + CODE_TTL_SECONDS;

	await db.send(new PutCommand({
		TableName: tableName,
		Item: {
			pk: key.pk,
			sk: key.sk,
			entity: 'auth_code',
			purpose,
			userId,
			email,
			codeHash: hashToken(code),
			attempts: 0,
			createdAt: new Date(now * 1000).toISOString(),
			expiresAt,
			ttl: expiresAt
		}
	}));

	await sendCode(email, code, purpose);
	return { sent: true, devCode: !mailFrom() && process.env.NODE_ENV !== 'production' ? code : undefined };
}

async function consumeCode(purpose: CodePurpose, emailInput: string, code: string) {
	const email = normalizeEmail(emailInput);
	const key = { pk: `AUTHCODE#${purpose}#${email}`, sk: 'META' };
	const result = await db.send(new GetCommand({ TableName: tableName, Key: key }));
	const item = result.Item;
	const now = Math.floor(Date.now() / 1000);

	if (!item?.codeHash || Number(item.expiresAt ?? 0) <= now || Number(item.attempts ?? 0) >= MAX_CODE_ATTEMPTS) {
		throw new Error('That code is invalid or has expired.');
	}

	const actual = Buffer.from(hashToken(code.trim()));
	const expected = Buffer.from(String(item.codeHash));
	if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
		await db.send(new UpdateCommand({
			TableName: tableName,
			Key: key,
			UpdateExpression: 'SET attempts = if_not_exists(attempts, :zero) + :one',
			ExpressionAttributeValues: { ':zero': 0, ':one': 1 }
		}));
		throw new Error('That code is invalid or has expired.');
	}

	await db.send(new DeleteCommand({ TableName: tableName, Key: key }));
	return { userId: String(item.userId), email };
}

async function createSession(userId: string, cookies?: Cookies) {
	const user = await getUserRecord(userId);
	if (!user) throw new Error('Account not found.');

	const token = randomBytes(32).toString('base64url');
	const now = Math.floor(Date.now() / 1000);
	const expiresAt = now + SESSION_TTL_SECONDS;

	await db.send(new PutCommand({
		TableName: tableName,
		Item: {
			pk: `SESSION#${hashToken(token)}`,
			sk: 'META',
			entity: 'session',
			userId,
			authEpoch: Number(user.authEpoch ?? 0),
			createdAt: new Date(now * 1000).toISOString(),
			expiresAt,
			ttl: expiresAt
		}
	}));

	if (cookies) cookies.set(SESSION_COOKIE, token, cookieOptions(SESSION_TTL_SECONDS));
	return token;
}


export async function bootstrapPlatformAdmin(input: {
	name: string;
	email: string;
	password: string;
}, cookies?: Cookies) {
	const email = normalizeEmail(input.email);
	const name = input.name.trim();
	const passwordError = validatePassword(input.password);

	if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.');
	if (!name || name.length > 100) throw new Error('Enter a name.');
	if (passwordError) throw new Error(passwordError);

	const userId = randomUUID();
	const now = new Date().toISOString();
	const credential = await hashPassword(input.password);

	await db.send(new TransactWriteCommand({
		TransactItems: [
			{
				Put: {
					TableName: tableName,
					Item: {
						pk: 'SYSTEM#AUTH',
						sk: 'BOOTSTRAP',
						entity: 'auth_bootstrap',
						createdAt: now,
						createdByUserId: userId
					},
					ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)'
				}
			},
			{
				Put: {
					TableName: tableName,
					Item: { pk: `AUTH#EMAIL#${email}`, sk: 'USER', entity: 'auth_lookup', userId },
					ConditionExpression: 'attribute_not_exists(pk)'
				}
			},
			{
				Put: {
					TableName: tableName,
					Item: {
						pk: `USER#${userId}`,
						sk: 'PROFILE',
						entity: 'user',
						id: userId,
						email,
						name,
						enabled: true,
						status: 'ACTIVE',
						emailVerified: true,
						authEpoch: 0,
						roles: ['PLATFORM_ADMIN'],
						createdAt: now,
						updatedAt: now,
						gsi2pk: 'USERS',
						gsi2sk: `${name.toLowerCase()}#${userId}`
					}
				}
			},
			{
				Put: {
					TableName: tableName,
					Item: {
						pk: `USER#${userId}`,
						sk: 'PASSWORD',
						entity: 'credential',
						salt: credential.salt,
						passwordHash: credential.hash,
						updatedAt: now
					}
				}
			}
		]
	}));

	return {
		user: await getUserById(userId),
		sessionToken: await createSession(userId, cookies)
	};
}

export async function hasCompletedBootstrap() {
	const result = await db.send(new GetCommand({
		TableName: tableName,
		Key: { pk: 'SYSTEM#AUTH', sk: 'BOOTSTRAP' }
	}));
	return Boolean(result.Item);
}

export async function inviteUser(input: {
	name: string;
	email: string;
	organisationId: string;
	roles: RescueHubRole[];
	membershipTypeId?: string;
	teamIds?: string[];
}) {
	const email = normalizeEmail(input.email);
	const name = input.name.trim();
	const organisationId = input.organisationId.trim();
	const roles = [...new Set(input.roles)];
	const membershipTypeId = input.membershipTypeId?.trim() || 'active-rescuer';
	const teamIds = [...new Set(input.teamIds ?? [])];

	if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.');
	if (!name || name.length > 100) throw new Error('Enter a name.');
	if (!organisationId) throw new Error('Choose an organisation.');
	if (!roles.length) throw new Error('Choose at least one role.');

	const userId = randomUUID();
	const now = new Date().toISOString();

	await db.send(new TransactWriteCommand({
		TransactItems: [
			{
				Put: {
					TableName: tableName,
					Item: { pk: `AUTH#EMAIL#${email}`, sk: 'USER', entity: 'auth_lookup', userId },
					ConditionExpression: 'attribute_not_exists(pk)'
				}
			},
			{
				Put: {
					TableName: tableName,
					Item: {
						pk: `USER#${userId}`,
						sk: 'PROFILE',
						entity: 'user',
						id: userId,
						email,
						name,
						enabled: true,
						status: 'INVITED',
						emailVerified: false,
						authEpoch: 0,
						organisationId,
						roles,
						membershipTypeId,
						teamIds,
						availabilityStatus: 'OFFLINE',
						createdAt: now,
						updatedAt: now,
						gsi1pk: `ORG#${organisationId}#USERS`,
						gsi1sk: `${name.toLowerCase()}#${userId}`,
						gsi2pk: 'USERS',
						gsi2sk: `${name.toLowerCase()}#${userId}`
					}
				}
			},
			{
				Put: {
					TableName: tableName,
					Item: {
						pk: `USER#${userId}`,
						sk: 'MEMBERSHIP',
						entity: 'membership',
						userId,
						organisationId,
						roles,
						membershipTypeId,
						teamIds,
						availabilityStatus: 'OFFLINE',
						status: 'PENDING',
						createdAt: now,
						updatedAt: now
					},
					ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)'
				}
			}
		]
	}));

	const invitation = await issueCode('INVITE', userId, email);
	return { user: await getUserById(userId), invitation };
}

export async function acceptInvite(email: string, code: string, password: string, cookies?: Cookies) {
	const passwordError = validatePassword(password);
	if (passwordError) throw new Error(passwordError);

	const record = await consumeCode('INVITE', email, code);
	const credential = await hashPassword(password);
	const now = new Date().toISOString();

	await db.send(new TransactWriteCommand({
		TransactItems: [
			{
				Put: {
					TableName: tableName,
					Item: {
						pk: `USER#${record.userId}`,
						sk: 'PASSWORD',
						entity: 'credential',
						salt: credential.salt,
						passwordHash: credential.hash,
						updatedAt: now
					}
				}
			},
			{
				Update: {
					TableName: tableName,
					Key: { pk: `USER#${record.userId}`, sk: 'PROFILE' },
					UpdateExpression: 'SET #status = :active, emailVerified = :yes, updatedAt = :at',
					ExpressionAttributeNames: { '#status': 'status' },
					ExpressionAttributeValues: { ':active': 'ACTIVE', ':yes': true, ':at': now }
				}
			},
			{
				Update: {
					TableName: tableName,
					Key: { pk: `USER#${record.userId}`, sk: 'MEMBERSHIP' },
					UpdateExpression: 'SET #status = :active, updatedAt = :at',
					ExpressionAttributeNames: { '#status': 'status' },
					ExpressionAttributeValues: { ':active': 'ACTIVE', ':at': now }
				}
			}
		]
	}));

	return { user: await getUserById(record.userId), sessionToken: await createSession(record.userId, cookies) };
}

export async function loginUser(email: string, password: string, cookies?: Cookies) {
	const userId = await lookupUserIdByEmail(email);
	if (!userId) throw new Error('Invalid email or password.');

	const [profile, credential] = await Promise.all([
		getUserRecord(userId),
		db.send(new GetCommand({ TableName: tableName, Key: { pk: `USER#${userId}`, sk: 'PASSWORD' } }))
	]);

	if (!profile || !Boolean(profile.enabled) || String(profile.status) !== 'ACTIVE' || !credential.Item?.salt || !credential.Item?.passwordHash) {
		throw new Error('Invalid email or password.');
	}

	if (!await verifyPassword(password, String(credential.Item.salt), String(credential.Item.passwordHash))) {
		throw new Error('Invalid email or password.');
	}

	return { user: toUser(profile), sessionToken: await createSession(userId, cookies) };
}

export async function requestPasswordReset(emailInput: string) {
	const email = normalizeEmail(emailInput);
	const userId = await lookupUserIdByEmail(email);
	if (!userId) return { sent: true, devCode: undefined };

	const user = await getUserRecord(userId);
	if (!user || !Boolean(user.enabled) || String(user.status) === 'REMOVED') {
		return { sent: true, devCode: undefined };
	}
	return issueCode('RESET_PASSWORD', userId, email);
}

export async function requestPasswordResetForUser(userId: string) {
	const user = await getUserRecord(userId);
	if (!user?.email) throw new Error('Account not found.');
	return issueCode('RESET_PASSWORD', userId, String(user.email));
}

export async function resetPassword(email: string, code: string, password: string, cookies?: Cookies) {
	const passwordError = validatePassword(password);
	if (passwordError) throw new Error(passwordError);

	const record = await consumeCode('RESET_PASSWORD', email, code);
	const credential = await hashPassword(password);
	const now = new Date().toISOString();

	await db.send(new TransactWriteCommand({
		TransactItems: [
			{
				Put: {
					TableName: tableName,
					Item: {
						pk: `USER#${record.userId}`,
						sk: 'PASSWORD',
						entity: 'credential',
						salt: credential.salt,
						passwordHash: credential.hash,
						updatedAt: now
					}
				}
			},
			{
				Update: {
					TableName: tableName,
					Key: { pk: `USER#${record.userId}`, sk: 'PROFILE' },
					UpdateExpression: 'SET authEpoch = if_not_exists(authEpoch, :zero) + :one, updatedAt = :at',
					ExpressionAttributeValues: { ':zero': 0, ':one': 1, ':at': now }
				}
			}
		]
	}));

	return { user: await getUserById(record.userId), sessionToken: await createSession(record.userId, cookies) };
}

export async function getCurrentUser(cookies: Cookies, authorizationHeader?: string | null) {
	const bearer = authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
	const token = bearer || cookies.get(SESSION_COOKIE);
	if (!token) return null;

	const session = await db.send(new GetCommand({
		TableName: tableName,
		Key: { pk: `SESSION#${hashToken(token)}`, sk: 'META' }
	}));
	const now = Math.floor(Date.now() / 1000);

	if (!session.Item?.userId || Number(session.Item.expiresAt ?? 0) <= now) return null;

	const user = await getUserRecord(String(session.Item.userId));
	if (!user || !Boolean(user.enabled) || String(user.status) === 'REMOVED' || Number(session.Item.authEpoch ?? 0) !== Number(user.authEpoch ?? 0)) {
		return null;
	}

	return toUser(user);
}

export async function logoutUser(cookies: Cookies, authorizationHeader?: string | null) {
	const bearer = authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
	const token = bearer || cookies.get(SESSION_COOKIE);

	if (token) {
		await db.send(new DeleteCommand({
			TableName: tableName,
			Key: { pk: `SESSION#${hashToken(token)}`, sk: 'META' }
		})).catch(() => undefined);
	}
	if (!bearer) cookies.delete(SESSION_COOKIE, cookieOptions());
}

export async function listUsers() {
	const result = await db.send(new QueryCommand({
		TableName: tableName,
		IndexName: 'gsi2',
		KeyConditionExpression: 'gsi2pk = :pk',
		ExpressionAttributeValues: { ':pk': 'USERS' }
	}));
	return (result.Items ?? []).map((item) => toUser(item));
}

export async function updateUserDispatchMembership(input: {
	userId: string;
	membershipTypeId: string;
	teamIds: string[];
}) {
	const now = new Date().toISOString();
	const teamIds = [...new Set(input.teamIds.filter(Boolean))];
	await db.send(new TransactWriteCommand({
		TransactItems: [
			{
				Update: {
					TableName: tableName,
					Key: { pk: `USER#${input.userId}`, sk: 'PROFILE' },
					UpdateExpression: 'SET membershipTypeId = :membershipTypeId, teamIds = :teamIds, updatedAt = :at',
					ExpressionAttributeValues: { ':membershipTypeId': input.membershipTypeId, ':teamIds': teamIds, ':at': now }
				}
			},
			{
				Update: {
					TableName: tableName,
					Key: { pk: `USER#${input.userId}`, sk: 'MEMBERSHIP' },
					UpdateExpression: 'SET membershipTypeId = :membershipTypeId, teamIds = :teamIds, updatedAt = :at',
					ExpressionAttributeValues: { ':membershipTypeId': input.membershipTypeId, ':teamIds': teamIds, ':at': now }
				}
			}
		]
	}));
}

export async function setUserAvailability(userId: string, availabilityStatus: RescueHubUser['availabilityStatus']) {
	const now = new Date().toISOString();
	await db.send(new TransactWriteCommand({
		TransactItems: [
			{
				Update: {
					TableName: tableName,
					Key: { pk: `USER#${userId}`, sk: 'PROFILE' },
					UpdateExpression: 'SET availabilityStatus = :status, updatedAt = :at',
					ExpressionAttributeValues: { ':status': availabilityStatus, ':at': now }
				}
			},
			{
				Update: {
					TableName: tableName,
					Key: { pk: `USER#${userId}`, sk: 'MEMBERSHIP' },
					UpdateExpression: 'SET availabilityStatus = :status, updatedAt = :at',
					ExpressionAttributeValues: { ':status': availabilityStatus, ':at': now }
				}
			}
		]
	}));
}

export async function setUserEnabled(userId: string, enabled: boolean) {
	await db.send(new UpdateCommand({
		TableName: tableName,
		Key: { pk: `USER#${userId}`, sk: 'PROFILE' },
		UpdateExpression: 'SET enabled = :enabled, authEpoch = if_not_exists(authEpoch, :zero) + :one, updatedAt = :at',
		ExpressionAttributeValues: { ':enabled': enabled, ':zero': 0, ':one': 1, ':at': new Date().toISOString() }
	}));
}

export async function removeUser(userId: string) {
	const now = new Date().toISOString();
	await db.send(new TransactWriteCommand({
		TransactItems: [
			{
				Update: {
					TableName: tableName,
					Key: { pk: `USER#${userId}`, sk: 'PROFILE' },
					UpdateExpression: 'SET enabled = :no, #status = :removed, authEpoch = if_not_exists(authEpoch, :zero) + :one, updatedAt = :at',
					ExpressionAttributeNames: { '#status': 'status' },
					ExpressionAttributeValues: { ':no': false, ':removed': 'REMOVED', ':zero': 0, ':one': 1, ':at': now }
				}
			},
			{
				Update: {
					TableName: tableName,
					Key: { pk: `USER#${userId}`, sk: 'MEMBERSHIP' },
					UpdateExpression: 'SET #status = :removed, updatedAt = :at',
					ExpressionAttributeNames: { '#status': 'status' },
					ExpressionAttributeValues: { ':removed': 'REMOVED', ':at': now }
				}
			}
		]
	}));
}

export function hasAdministrativeRole(user: RescueHubUser | null | undefined) {
	return Boolean(user?.roles.some((role) => ['PLATFORM_ADMIN', 'AUTHORITY_ADMIN', 'ORG_ADMIN'].includes(role)));
}
