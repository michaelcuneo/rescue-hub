<script lang="ts">
	import { env } from '$env/dynamic/public';
	import { Map, controls } from '@beyonk/svelte-mapbox';

	type OperatingAreaCollection = {
		type: 'FeatureCollection';
		features: Array<{
			type: 'Feature';
			geometry: { type: string; coordinates: unknown };
			properties: Record<string, unknown>;
		}>;
		metadata?: {
			failedLayers?: Array<{ layerId: number; name: string; error: string }>;
		};
	};

	let center: [number, number] = $state([147.8, -32.2]);
	let zoom = $state(5.4);
	let ref: any = $state(undefined);
	let state: 'loading' | 'ready' | 'partial' | 'error' = $state('loading');
	let featureCount = $state(0);

	const accessToken = env.PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';
	const { NavigationControl, ScaleControl } = controls;

	async function handleReady() {
		const map = ref?.getMap?.();
		if (!map) return;

		if (!map.isStyleLoaded?.()) {
			await new Promise<void>((resolve) => map.once('load', () => resolve()));
		}

		try {
			const response = await fetch('/api/operating-areas');
			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const collection = (await response.json()) as OperatingAreaCollection;
			featureCount = collection.features.length;

			map.addSource('admin-operating-areas', {
				type: 'geojson',
				data: collection
			});

			map.addLayer({
				id: 'admin-operating-areas-fill',
				type: 'fill',
				source: 'admin-operating-areas',
				paint: {
					'fill-color': [
						'case',
						['==', ['get', 'organisationId'], 'native-animal-trust-fund'],
						'#f2b705',
						['==', ['get', 'organisationId'], 'wires'],
						'#517da8',
						'#50a971'
					],
					'fill-opacity': [
						'case',
						['==', ['get', 'organisationId'], 'native-animal-trust-fund'],
						0.28,
						0.11
					]
				}
			});

			map.addLayer({
				id: 'admin-operating-areas-outline',
				type: 'line',
				source: 'admin-operating-areas',
				paint: {
					'line-color': [
						'case',
						['==', ['get', 'organisationId'], 'native-animal-trust-fund'],
						'#8a6200',
						['==', ['get', 'organisationId'], 'wires'],
						'#31597f',
						'#2d7148'
					],
					'line-width': [
						'case',
						['==', ['get', 'organisationId'], 'native-animal-trust-fund'],
						2.4,
						1
					],
					'line-opacity': 0.9
				}
			});

			map.addLayer({
				id: 'admin-operating-areas-labels',
				type: 'symbol',
				source: 'admin-operating-areas',
				minzoom: 6.3,
				layout: {
					'text-field': ['get', 'areaLabel'],
					'text-size': 10,
					'text-max-width': 14
				},
				paint: {
					'text-color': '#173d2c',
					'text-halo-color': 'rgba(255,255,255,0.94)',
					'text-halo-width': 1.5
				}
			});

			state = collection.metadata?.failedLayers?.length ? 'partial' : 'ready';
		} catch (error) {
			console.error('Unable to load admin operating-area map.', error);
			state = 'error';
		}
	}
</script>

<div class="map-card">
	<Map
		bind:this={ref}
		bind:center
		bind:zoom
		accessToken={accessToken}
		style="mapbox://styles/michaelcuneo/ckzzecgy7005j14qvpzd53fgn"
		onready={handleReady}
	>
		<NavigationControl />
		<ScaleControl />
	</Map>

	<div class="map-status">
		<strong>NSW wildlife rehabilitation operating areas</strong>
		{#if state === 'loading'}
			<span>Loading official DCCEEW geometry…</span>
		{:else if state === 'error'}
			<span class="error">Boundary service unavailable.</span>
		{:else}
			<span>{featureCount} boundary features loaded{state === 'partial' ? ' · partial source response' : ''}</span>
		{/if}
	</div>

	<div class="legend">
		<span><i class="hunter"></i>Hunter Wildlife Rescue</span>
		<span><i class="wires"></i>WIRES</span>
		<span><i class="other"></i>Other providers</span>
	</div>
</div>

<style>
	.map-card {
		position: relative;
		min-height: 520px;
		overflow: hidden;
		border: 1px solid #d9e1dc;
		border-radius: 16px;
		background: #dce6df;
		box-shadow: 0 12px 32px rgb(29 55 42 / 0.05);
	}

	.map-card :global(.mapboxgl-map) {
		position: absolute;
		inset: 0;
		width: 100% !important;
		height: 100% !important;
	}

	.map-status,
	.legend {
		position: absolute;
		z-index: 4;
		left: 14px;
		padding: 10px 12px;
		border: 1px solid rgb(23 61 44 / 0.12);
		border-radius: 10px;
		background: rgb(255 255 255 / 0.92);
		box-shadow: 0 8px 24px rgb(23 61 44 / 0.12);
		backdrop-filter: blur(10px);
	}

	.map-status {
		top: 14px;
		display: grid;
		gap: 2px;
	}

	.map-status strong {
		font-size: 11px;
	}

	.map-status span {
		color: #68756e;
		font-size: 9px;
	}

	.map-status span.error {
		color: #a23f35;
	}

	.legend {
		bottom: 14px;
		display: flex;
		gap: 12px;
	}

	.legend span {
		display: flex;
		align-items: center;
		gap: 5px;
		color: #4f5d55;
		font-size: 8px;
	}

	.legend i {
		width: 15px;
		height: 8px;
		border: 1px solid;
		border-radius: 2px;
	}

	.legend .hunter {
		border-color: #8a6200;
		background: rgb(242 183 5 / 0.35);
	}

	.legend .wires {
		border-color: #31597f;
		background: rgb(81 125 168 / 0.24);
	}

	.legend .other {
		border-color: #2d7148;
		background: rgb(80 169 113 / 0.24);
	}

	@media (max-width: 700px) {
		.map-card {
			min-height: 430px;
		}

		.legend {
			right: 14px;
			flex-wrap: wrap;
		}
	}
</style>
