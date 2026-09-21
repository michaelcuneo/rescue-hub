import { gzipSync, gunzipSync } from 'node:zlib';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
	DynamoDBDocumentClient,
	GetCommand,
	PutCommand,
	QueryCommand
} from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
	marshallOptions: { removeUndefinedValues: true }
});
const tableName = Resource.RescueHubData.name;

const CACHE_PK = 'CACHE#NSW_OPERATING_AREAS';
const META_SK = 'META';
const CHUNK_PREFIX = 'CHUNK#';
const CHUNK_SIZE = 300_000;
const CACHE_VERSION = 1;

export type CachedOperatingAreas<T> = {
	value: T;
	cachedAt: string;
	compressedBytes: number;
	chunkCount: number;
};

export async function readOperatingAreasCache<T>(): Promise<CachedOperatingAreas<T> | null> {
	const metaResult = await db.send(new GetCommand({
		TableName: tableName,
		Key: { pk: CACHE_PK, sk: META_SK },
		ConsistentRead: true
	}));

	const meta = metaResult.Item;
	if (
		!meta ||
		Number(meta.cacheVersion) !== CACHE_VERSION ||
		!Number(meta.chunkCount)
	) {
		return null;
	}

	const chunks: Array<{ sk: string; payload: string }> = [];
	let exclusiveStartKey: Record<string, unknown> | undefined;

	do {
		const result = await db.send(new QueryCommand({
			TableName: tableName,
			KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
			ExpressionAttributeValues: {
				':pk': CACHE_PK,
				':prefix': CHUNK_PREFIX
			},
			ProjectionExpression: 'sk, payload',
			ScanIndexForward: true,
			ExclusiveStartKey: exclusiveStartKey
		}));

		for (const item of result.Items ?? []) {
			if (typeof item.sk === 'string' && typeof item.payload === 'string') {
				chunks.push({ sk: item.sk, payload: item.payload });
			}
		}

		exclusiveStartKey = result.LastEvaluatedKey;
	} while (exclusiveStartKey);

	const expectedChunks = Number(meta.chunkCount);
	const payload = chunks
		.sort((a, b) => a.sk.localeCompare(b.sk))
		.slice(0, expectedChunks)
		.map((chunk) => chunk.payload)
		.join('');

	if (!payload || chunks.length < expectedChunks) return null;

	const compressed = Buffer.from(payload, 'base64');
	const json = gunzipSync(compressed).toString('utf8');

	return {
		value: JSON.parse(json) as T,
		cachedAt: String(meta.cachedAt),
		compressedBytes: Number(meta.compressedBytes ?? compressed.byteLength),
		chunkCount: expectedChunks
	};
}

export async function writeOperatingAreasCache<T>(value: T) {
	const compressed = gzipSync(Buffer.from(JSON.stringify(value), 'utf8'), { level: 9 });
	const encoded = compressed.toString('base64');
	const chunks: string[] = [];

	for (let offset = 0; offset < encoded.length; offset += CHUNK_SIZE) {
		chunks.push(encoded.slice(offset, offset + CHUNK_SIZE));
	}

	const cachedAt = new Date().toISOString();

	for (let index = 0; index < chunks.length; index += 20) {
		await Promise.all(
			chunks.slice(index, index + 20).map((payload, relativeIndex) => {
				const chunkIndex = index + relativeIndex;
				return db.send(new PutCommand({
					TableName: tableName,
					Item: {
						pk: CACHE_PK,
						sk: `${CHUNK_PREFIX}${String(chunkIndex).padStart(5, '0')}`,
						entity: 'operating_area_cache_chunk',
						cacheVersion: CACHE_VERSION,
						payload,
						cachedAt
					}
				}));
			})
		);
	}

	await db.send(new PutCommand({
		TableName: tableName,
		Item: {
			pk: CACHE_PK,
			sk: META_SK,
			entity: 'operating_area_cache',
			cacheVersion: CACHE_VERSION,
			cachedAt,
			chunkCount: chunks.length,
			compressedBytes: compressed.byteLength,
			uncompressedBytes: Buffer.byteLength(JSON.stringify(value), 'utf8')
		}
	}));

	return {
		cachedAt,
		compressedBytes: compressed.byteLength,
		chunkCount: chunks.length
	};
}
