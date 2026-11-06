import { json } from '@sveltejs/kit';
import { readOperatingAreasCache } from '$lib/server/operating-areas-cache';
import { hasAdministrativeRole } from '$lib/server/auth';
import type { RequestHandler } from './$types';

type OperatingAreaLayer = {
	layerId: number;
	organisationId: string | null;
	organisationName: string;
	directoryStatus: 'CURRENT' | 'LEGACY_OR_SHARED';
	dynamicNameField?: string;
};

type GeoJsonFeature = {
	type: 'Feature';
	geometry: {
		type: string;
		coordinates: unknown;
	};
	properties: Record<string, unknown>;
};

type GeoJsonCollection = {
	type: 'FeatureCollection';
	features: GeoJsonFeature[];
	metadata: {
		source: string;
		sourceUrl: string;
		generatedAt: string;
		loadedLayers: number[];
		failedLayers: Array<{ layerId: number; name: string; error: string }>;
	};
};

const SERVICE_URL =
	'https://maptest.environment.nsw.gov.au/arcgis/rest/services/WildlifeRehab/Wildlife_Rehab_Groups/MapServer';

const UPSTREAM_TIMEOUT_MS = 8000;
const CACHE_READ_TIMEOUT_MS = 2500;

async function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			work,
			new Promise<never>((_, reject) => {
				timeout = setTimeout(() => reject(new Error(`Operation exceeded ${ms}ms`)), ms);
			})
		]);
	} finally {
		if (timeout) clearTimeout(timeout);
	}
}

const layers: OperatingAreaLayer[] = [
	{ layerId: 0, organisationId: 'wires', organisationName: 'WIRES', directoryStatus: 'CURRENT', dynamicNameField: 'WIRES_Branch' },
	{ layerId: 2, organisationId: 'fawna', organisationName: 'FAWNA', directoryStatus: 'CURRENT' },
	{ layerId: 3, organisationId: 'friends-of-the-koala', organisationName: 'Friends of the Koala', directoryStatus: 'CURRENT' },
	{ layerId: 4, organisationId: null, organisationName: 'Kangaroo Protection Co-op', directoryStatus: 'LEGACY_OR_SHARED' },
	{ layerId: 5, organisationId: 'koalas-in-care', organisationName: 'Koalas In Care', directoryStatus: 'CURRENT' },
	{ layerId: 6, organisationId: 'snowy-mountains-wildlife-rescue-laoko', organisationName: 'Snowy Mountains Wildlife Rescue LAOKO', directoryStatus: 'CURRENT' },
	{ layerId: 7, organisationId: 'native-animal-rescue-group', organisationName: 'Native Animal Rescue Group', directoryStatus: 'CURRENT' },
	{ layerId: 8, organisationId: 'native-animal-trust-fund', organisationName: 'Hunter Wildlife Rescue', directoryStatus: 'CURRENT' },
	{ layerId: 9, organisationId: 'northern-rivers-wildlife-carers', organisationName: 'Northern Rivers Wildlife Carers', directoryStatus: 'CURRENT' },
	{ layerId: 10, organisationId: 'northern-tablelands-wildlife-carers', organisationName: 'Northern Tablelands Wildlife Carers', directoryStatus: 'CURRENT' },
	{ layerId: 11, organisationId: 'port-macquarie-koala-hospital', organisationName: 'Port Macquarie Koala Hospital', directoryStatus: 'CURRENT' },
	{ layerId: 12, organisationId: 'port-stephens-koalas', organisationName: 'Port Stephens Koalas', directoryStatus: 'CURRENT' },
	{ layerId: 13, organisationId: 'sydney-metropolitan-wildlife-services', organisationName: 'Sydney Metropolitan Wildlife Services', directoryStatus: 'CURRENT' },
	{ layerId: 14, organisationId: 'sona', organisationName: 'Saving Our Native Animals', directoryStatus: 'CURRENT' },
	{ layerId: 15, organisationId: 'sunraysia-wildlife-carers', organisationName: 'Sunraysia Wildlife Carers', directoryStatus: 'CURRENT' },
	{ layerId: 16, organisationId: 'tweed-valley-wildlife-carers', organisationName: 'Tweed Valley Wildlife Carers', directoryStatus: 'CURRENT' },
	{ layerId: 17, organisationId: 'winc', organisationName: 'WINC', directoryStatus: 'CURRENT' },
	{ layerId: 18, organisationId: 'wildcare-queanbeyan', organisationName: 'Wildcare Queanbeyan', directoryStatus: 'CURRENT' },
	{ layerId: 19, organisationId: 'wildlife-arc', organisationName: 'Wildlife ARC', directoryStatus: 'CURRENT' },
	{ layerId: 20, organisationId: 'wildlife-carers-network-central-west', organisationName: 'Wildlife Carers Network Central West', directoryStatus: 'CURRENT' },
	{ layerId: 21, organisationId: 'wildlife-rescue-south-coast', organisationName: 'Wildlife Rescue South Coast', directoryStatus: 'CURRENT' },
	{ layerId: 22, organisationId: null, organisationName: 'NSW coastal wildlife services', directoryStatus: 'LEGACY_OR_SHARED' }
];

let cached: { expiresAt: number; value: GeoJsonCollection } | null = null;

// Reduce ArcGIS polygon precision to approximately metre-level coordinates and
// omit unused upstream attributes. This preserves polygon topology and holes.
function compactCoordinates(value: unknown): unknown {
	if (!Array.isArray(value)) return value;
	if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
		return value.map((coordinate, index) => index < 2 && typeof coordinate === 'number'
			? Math.round(coordinate * 100000) / 100000
			: coordinate);
	}
	return value.map(compactCoordinates);
}

function featureLabel(layer: OperatingAreaLayer, properties: Record<string, unknown>) {
	if (layer.dynamicNameField) {
		const dynamicName = properties[layer.dynamicNameField];
		if (typeof dynamicName === 'string' && dynamicName.trim()) {
			return `WIRES — ${dynamicName.trim()}`;
		}
	}

	return layer.organisationName;
}

async function fetchLayer(fetcher: typeof fetch, layer: OperatingAreaLayer): Promise<GeoJsonFeature[]> {
	const params = new URLSearchParams({
		where: '1=1',
		outFields: '*',
		returnGeometry: 'true',
		outSR: '4326',
		f: 'geojson'
	});

	const response = await fetcher(`${SERVICE_URL}/${layer.layerId}/query?${params.toString()}`, {
		signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}`);
	}

	const payload = (await response.json()) as {
		type?: string;
		features?: GeoJsonFeature[];
		error?: { message?: string };
	};

	if (payload.error) {
		throw new Error(payload.error.message ?? 'ArcGIS query failed');
	}

	return (payload.features ?? []).filter((feature) => feature.geometry?.coordinates).map((feature) => ({
		type: 'Feature' as const,
		geometry: {
			type: feature.geometry.type,
			coordinates: compactCoordinates(feature.geometry.coordinates)
		},
		properties: {
			layerId: layer.layerId,
			organisationId: layer.organisationId ?? '',
			organisationName: layer.organisationName,
			areaLabel: featureLabel(layer, feature.properties ?? {}),
			directoryStatus: layer.directoryStatus,
			source: 'NSW DCCEEW Wildlife Rehabilitation Group boundaries'
		}
	}));
}

export const GET: RequestHandler = async ({ fetch, url, locals }) => {
	const startedAt = Date.now();
	console.info('[operating-areas] request started');
	const now = Date.now();
	const refreshRequested = url.searchParams.get('refresh') === '1';
	const forceRefresh = refreshRequested && hasAdministrativeRole(locals.user);

	if (refreshRequested && !forceRefresh) {
		return json({ error: 'Administrative access is required to refresh operating areas.' }, { status: 403 });
	}

	if (!forceRefresh && cached && cached.expiresAt > now) {
		return json(cached.value, {
			headers: {
				'cache-control': 'public, max-age=3600, s-maxage=43200',
				'x-rescuehub-operating-areas-cache': 'memory'
			}
		});
	}

	if (!forceRefresh) {
		try {
			console.info('[operating-areas] reading DynamoDB cache');
			const persisted = await withDeadline(readOperatingAreasCache<GeoJsonCollection>(), CACHE_READ_TIMEOUT_MS);
			console.info('[operating-areas] cache read finished', { found: Boolean(persisted), elapsedMs: Date.now() - startedAt });
			if (persisted) {
				cached = {
					expiresAt: now + 12 * 60 * 60 * 1000,
					value: persisted.value
				};

				return json(persisted.value, {
					headers: {
						'cache-control': 'public, max-age=3600, s-maxage=43200',
						'x-rescuehub-operating-areas-cache': 'dynamodb',
						'x-rescuehub-operating-areas-cached-at': persisted.cachedAt
					}
				});
			}
		} catch (error) {
			console.warn('Unable to read persisted operating-area cache.', error);
		}
	}

	console.info('[operating-areas] fetching ArcGIS layers', { count: layers.length, elapsedMs: Date.now() - startedAt });
	const settled = await Promise.allSettled(layers.map((layer) => fetchLayer(fetch, layer)));
	console.info('[operating-areas] ArcGIS fetch finished', { elapsedMs: Date.now() - startedAt });
	const features: GeoJsonFeature[] = [];
	const loadedLayers: number[] = [];
	const failedLayers: Array<{ layerId: number; name: string; error: string }> = [];

	settled.forEach((result, index) => {
		const layer = layers[index];

		if (result.status === 'fulfilled') {
			features.push(...result.value);
			loadedLayers.push(layer.layerId);
			return;
		}

		failedLayers.push({
			layerId: layer.layerId,
			name: layer.organisationName,
			error: result.reason instanceof Error ? result.reason.message : String(result.reason)
		});
	});

	const value: GeoJsonCollection = {
		type: 'FeatureCollection',
		features,
		metadata: {
			source: 'NSW DCCEEW Wildlife Rehabilitation Group boundaries',
			sourceUrl: SERVICE_URL,
			generatedAt: new Date().toISOString(),
			loadedLayers,
			failedLayers
		}
	};

	if (features.length > 0) {
		cached = {
			expiresAt: now + 12 * 60 * 60 * 1000,
			value
		};
	}

	// Do not write large GeoJSON datasets to DynamoDB during an HTTP request.
	// In-memory cache serves warm instances; persistent refresh should be a separate job.
	const persistentCacheStatus = 'write-skipped';

	const responseBytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
	console.info('[operating-areas] returning response', { featureCount: features.length, responseBytes, elapsedMs: Date.now() - startedAt });
	if (responseBytes > 5_000_000) {
		return json({ error: 'Boundary geometry exceeds the response budget.', responseBytes }, { status: 503, headers: { 'cache-control': 'no-store' } });
	}
	return json(value, {
		status: features.length ? 200 : 503,
		headers: {
			'cache-control': features.length ? 'public, max-age=3600, s-maxage=43200' : 'no-store',
			'x-rescuehub-operating-areas-cache': forceRefresh ? 'refreshed' : 'origin',
			'x-rescuehub-operating-areas-persist': persistentCacheStatus
		}
	});
};
