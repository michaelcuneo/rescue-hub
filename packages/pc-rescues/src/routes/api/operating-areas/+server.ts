import { json } from '@sveltejs/kit';
import { readOperatingAreasCache, writeOperatingAreasCache } from '$lib/server/operating-areas-cache';
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

	const response = await fetcher(`${SERVICE_URL}/${layer.layerId}/query?${params.toString()}`);

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

	return (payload.features ?? []).map((feature) => ({
		...feature,
		properties: {
			...feature.properties,
			layerId: layer.layerId,
			organisationId: layer.organisationId ?? '',
			organisationName: layer.organisationName,
			areaLabel: featureLabel(layer, feature.properties),
			directoryStatus: layer.directoryStatus,
			source: 'NSW DCCEEW Wildlife Rehabilitation Group boundaries'
		}
	}));
}

export const GET: RequestHandler = async ({ fetch, url }) => {
	const now = Date.now();
	const forceRefresh = url.searchParams.get('refresh') === '1';

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
			const persisted = await readOperatingAreasCache<GeoJsonCollection>();
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

	const settled = await Promise.allSettled(layers.map((layer) => fetchLayer(fetch, layer)));
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

	cached = {
		expiresAt: now + 12 * 60 * 60 * 1000,
		value
	};

	let persistentCacheStatus = 'write-skipped';
	try {
		await writeOperatingAreasCache(value);
		persistentCacheStatus = 'written';
	} catch (error) {
		persistentCacheStatus = 'write-failed';
		console.warn('Unable to persist operating-area cache.', error);
	}

	return json(value, {
		headers: {
			'cache-control': 'public, max-age=3600, s-maxage=43200',
			'x-rescuehub-operating-areas-cache': forceRefresh ? 'refreshed' : 'origin',
			'x-rescuehub-operating-areas-persist': persistentCacheStatus
		}
	});
};
