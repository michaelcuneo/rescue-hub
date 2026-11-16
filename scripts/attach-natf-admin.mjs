
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  TransactWriteCommand
} from '@aws-sdk/lib-dynamodb';

const email = 'me@michaelcuneo.com.au';
const organisationId = 'native-animal-trust-fund';
const table = process.env.RESCUE_HUB_TABLE;

if (!table) {
  throw new Error('Set RESCUE_HUB_TABLE to the DynamoDB table name.');
}

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const lookup = await db.send(new GetCommand({
  TableName: table,
  Key: {
    pk: `AUTH#EMAIL#${email}`,
    sk: 'USER'
  }
}));

const userId = lookup.Item?.userId;
if (!userId) throw new Error('Account not found.');

const profileKey = { pk: `USER#${userId}`, sk: 'PROFILE' };
const membershipKey = { pk: `USER#${userId}`, sk: 'MEMBERSHIP' };

const [profileResult, membershipResult] = await Promise.all([
  db.send(new GetCommand({ TableName: table, Key: profileKey })),
  db.send(new GetCommand({ TableName: table, Key: membershipKey }))
]);

const profile = profileResult.Item;
const membership = membershipResult.Item;

if (!profile) throw new Error('User profile missing.');
if (profile.email !== email) throw new Error('Account email mismatch.');

if (profile.organisationId && profile.organisationId !== organisationId) {
  throw new Error('Account already belongs to another organisation.');
}

if (membership?.organisationId &&
    membership.organisationId !== organisationId) {
  throw new Error('Existing membership belongs to another organisation.');
}

const roles = [...new Set([
  ...(profile.roles ?? []),
  'ORG_ADMIN'
])];

const now = new Date().toISOString();

console.log('Updating:', {
  email,
  userId,
  organisationId,
  roles
});

const membershipItem = {
  ...membership,
  pk: membershipKey.pk,
  sk: membershipKey.sk,
  entity: 'membership',
  userId,
  organisationId,
  roles,
  membershipTypeId: profile.membershipTypeId ?? 'active-rescuer',
  teamIds: profile.teamIds ?? [],
  availabilityStatus: profile.availabilityStatus ?? 'OFFLINE',
  status: 'ACTIVE',
  createdAt: membership?.createdAt ?? now,
  updatedAt: now
};

await db.send(new TransactWriteCommand({
  TransactItems: [
    {
      Update: {
        TableName: table,
        Key: profileKey,
        UpdateExpression: 'SET organisationId = :org, #roles = :roles, gsi1pk = :gsi, gsi1sk = :sort, updatedAt = :now',
        ExpressionAttributeNames: {
          '#roles': 'roles'
        },
        ConditionExpression: 'email = :email AND (attribute_not_exists(organisationId) OR organisationId = :org)',
        ExpressionAttributeValues: {
          ':org': organisationId,
          ':roles': roles,
          ':gsi': `ORG#${organisationId}#USERS`,
          ':sort': `${profile.name.toLowerCase()}#${userId}`,
          ':now': now,
          ':email': email
        }
      }
    },
    {
      Put: {
        TableName: table,
        Item: membershipItem,
        ConditionExpression: 'attribute_not_exists(organisationId) OR organisationId = :org',
        ExpressionAttributeValues: { ':org': organisationId }
      }
    }
  ]
}));

console.log('Success: account attached to NATF as ORG_ADMIN.');

