#!/usr/bin/env node
/**
 * Explicit, interactive recovery bootstrap for an SST development stage.
 *
 * This is a CLI script, never an HTTP endpoint or a login bypass.
 * Usage:
 * npx sst shell --stage <stage> -- node packages/pc-rescues/scripts/create-dev-admin.mjs --stage <stage>
 *
 * Use --email <address> to specify a different development login.
 * The generated password is printed to your terminal ONCE, never committed.
 */
import { randomBytes, randomUUID, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';

const scrypt = promisify(scryptCallback);

function fail(message) {
  throw new Error(message);
}

function flagValue(flag) {
  const offset = process.argv.indexOf(flag);
  if (offset < 0) return undefined;
  const value = process.argv[offset + 1];
  if (!value || value.startsWith('--')) fail(`Missing value after ${flag}`);
  return value;
}

const stage = flagValue('--stage');
if (!stage || !/^[A-Za-z0-9_-]{1,64}$/.test(stage)) {
  fail('An explicit non-production SST stage is required: --stage <stage>.');
}
if (/(^|[-_])(demo|prod|production)([-_]|$)/i.test(stage)) {
  fail('Refusing to create an administrator in a demo or production stage.');
}
if (process.env.SST_STAGE && process.env.SST_STAGE !== stage) {
  fail(`Connected SST stage ${process.env.SST_STAGE} does not match --stage ${stage}.`);
}

const email = (flagValue('--email') || 'dev-admin@rescuehub.example').trim().toLowerCase();
if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
  fail('Enter a valid development email address with --email.');
}
const name = 'Development Administrator';
const tableName = Resource.RescueHubData?.name;
if (!tableName) fail('RescueHubData is not linked. Run this script using npx sst shell.');
if (!tableName.toLowerCase().includes(stage.toLowerCase())) {
  fail(`The linked table name does not contain stage "${stage}". Refusing to modify ${tableName}.`);
}

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
});
const emailKey = { pk: `AUTH#EMAIL#${email}`, sk: 'USER' };
const bootstrapKey = { pk: 'SYSTEM#AUTH', sk: 'BOOTSTRAP' };

const [lookup, bootstrap] = await Promise.all([
  db.send(new GetCommand({ TableName: tableName, Key: emailKey, ConsistentRead: true })),
  db.send(new GetCommand({ TableName: tableName, Key: bootstrapKey, ConsistentRead: true }))
]);

let userId;
let reset = false;
if (lookup.Item?.userId) {
  userId = String(lookup.Item.userId);
  const profile = await db.send(new GetCommand({
    TableName: tableName,
    Key: { pk: `USER#${userId}`, sk: 'PROFILE' },
    ConsistentRead: true
  }));
  if (!profile.Item?.devBootstrap || profile.Item.email !== email ||
      !Array.isArray(profile.Item.roles) || !profile.Item.roles.includes('PLATFORM_ADMIN')) {
    fail('An existing non-development user has this email. Refusing to overwrite it.');
  }
  reset = true;
} else {
  userId = randomUUID();
}

console.log('\nRescue Hub development administrator');
console.log(`Stage:     ${stage}`);
console.log(`Table:     ${tableName}`);
console.log(`Email:     ${email}`);
console.log(`Operation: ${reset ? 'Reset development administrator password' : 'Create development administrator'}`);

if (!stdin.isTTY) fail('Interactive confirmation is required. Run this command in your local terminal.');
const rl = createInterface({ input: stdin, output: stdout });
let confirmation;
try {
  confirmation = await rl.question(`\nType "${reset ? 'RESET' : 'CREATE'} ${stage}" to confirm: `);
} finally {
  rl.close();
}
if (confirmation !== `${reset ? 'RESET' : 'CREATE'} ${stage}`) {
  fail('Cancelled without changes.');
}

const password = randomBytes(24).toString('base64url');
const salt = randomBytes(16);
const derived = await scrypt(password, salt, 64);
const credential = {
  salt: salt.toString('base64'),
  passwordHash: derived.toString('base64')
};
const now = new Date().toISOString();
const userPk = `USER#${userId}`;
const transactions = [];

if (!bootstrap.Item && !reset) {
  transactions.push({
    Put: {
      TableName: tableName,
      Item: {
        ...bootstrapKey,
        entity: 'auth_bootstrap',
        createdAt: now,
        createdByUserId: userId
      },
      ConditionExpression: 'attribute_not_exists(pk)'
    }
  });
}

if (reset) {
  transactions.push({
    Update: {
      TableName: tableName,
      Key: { pk: userPk, sk: 'PROFILE' },
      UpdateExpression: 'SET authEpoch = if_not_exists(authEpoch, :zero) + :one, updatedAt = :now',
      ConditionExpression: 'devBootstrap = :yes AND email = :email',
      ExpressionAttributeValues: {
        ':zero': 0, ':one': 1, ':now': now, ':yes': true, ':email': email
      }
    }
  });
} else {
  transactions.push(
    {
      Put: {
        TableName: tableName,
        Item: { ...emailKey, entity: 'auth_lookup', userId },
        ConditionExpression: 'attribute_not_exists(pk)'
      }
    },
    {
      Put: {
        TableName: tableName,
        Item: {
          pk: userPk, sk: 'PROFILE', entity: 'user',
          id: userId, name, email, enabled: true, status: 'ACTIVE',
          emailVerified: true, authEpoch: 0, roles: ['PLATFORM_ADMIN'],
          teamIds: [], availabilityStatus: 'OFFLINE', devBootstrap: true,
          createdAt: now, updatedAt: now,
          gsi2pk: 'USERS',
          gsi2sk: `${name.toLowerCase()}#${userId}`
        },
        ConditionExpression: 'attribute_not_exists(pk)'
      }
    }
  );
}

transactions.push({
  Put: {
    TableName: tableName,
    Item: {
      pk: userPk, sk: 'PASSWORD', entity: 'credential',
      ...credential, updatedAt: now
    },
    ...(reset ? { ConditionExpression: 'attribute_exists(pk)' } : {
      ConditionExpression: 'attribute_not_exists(pk)'
    })
  }
});

await db.send(new TransactWriteCommand({ TransactItems: transactions }));
console.log('\nDevelopment account ready.');
console.log(`Email:    ${email}`);
console.log(`Password: ${password}`);
console.log('\nSave this password privately. It is not stored in the repository.');
console.log('Sign in at http://localhost:3000/login');
