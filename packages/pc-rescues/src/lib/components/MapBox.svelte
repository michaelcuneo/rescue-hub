<script lang="ts">
	import { env } from '$env/dynamic/public';
	import { Map, Marker, controls } from '@beyonk/svelte-mapbox';
	import { coords, mapRef, data } from '$lib/stores';
	import Type from '$lib/components/Type.svelte';
	import Avatar from './Avatar.svelte';
	import Michael from '$lib/images/michael.jpg';

	type AreaSelection = {
		name: string;
		organisation: string;
		status: string;
	};

	type OperatingAreaCollection = {
		type: 'FeatureCollection';
		features: Array<{
			type: 'Feature';
			geometry: { type: string; coordinates: unknown };
			properties: Record<string, unknown>;
		}>;
		metadata?: {
			loadedLayers?: number[];
			failedLayers?: Array<{ layerId: number; name: string; error: string }>;
		};
	};

	let user: User = {
		id: '37c7eeca-748e-4c19-9e4a-15649b34e40e',
		name: 'Michael Cuneo',
		email: 'me@michaelcuneo.com.au',
		avatar: 'https://place-hold.it/40x40?text=M&fontsize=16'
	};

	let center: [number, number] = $state([151.66, -32.95]);
	let zoom = $state(9);
	let ref: any = $state(undefined);
	let areasState: 'loading' | 'ready' | 'partial' | 'error' = $state('loading');
	let areaFeatureCount = $state(0);
	let selectedArea: AreaSelection | null = $state(null);
	let secureContext = $state(false);

	const mapboxAccessToken = env.PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';
	const { GeolocateControl, NavigationControl, ScaleControl } = controls;

	function coordinateBounds(collection: OperatingAreaCollection, organisationId: string) {
		let minLng = Number.POSITIVE_INFINITY;
		let minLat = Number.POSITIVE_INFINITY;
		let maxLng = Number.NEGATIVE_INFINITY;
		let maxLat = Number.NEGATIVE_INFINITY;

		const walk = (value: unknown) => {
			if (!Array.isArray(value)) return;

			if (
				value.length >= 2 &&
				typeof value[0] === 'number' &&
				typeof value[1] === 'number'
			) {
				const lng = value[0];
				const lat = value[1];
				minLng = Math.min(minLng, lng);
				minLat = Math.min(minLat, lat);
				maxLng = Math.max(maxLng, lng);
				maxLat = Math.max(maxLat, lat);
				return;
			}

			value.forEach(walk);
		};

		for (const feature of collection.features) {
			if (feature.properties.organisationId !== organisationId) continue;
			walk(feature.geometry.coordinates);
		}

		if (!Number.isFinite(minLng)) return null;

		return [
			[minLng, minLat],
			[maxLng, maxLat]
		] as [[number, number], [number, number]];
	}

	function installAreaLayers(rawMap: any, collection: OperatingAreaCollection) {
		const sourceId = 'nsw-operating-areas';

		if (rawMap.getSource(sourceId)) {
			rawMap.getSource(sourceId).setData(collection);
			return;
		}

		rawMap.addSource(sourceId, {
			type: 'geojson',
			data: collection
		});

		rawMap.addLayer({
			id: 'nsw-operating-areas-fill',
			type: 'fill',
			source: sourceId,
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
					0.22,
					0.08
				]
			}
		});

		rawMap.addLayer({
			id: 'nsw-operating-areas-outline',
			type: 'line',
			source: sourceId,
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
					2.5,
					1
				],
				'line-opacity': 0.85
			}
		});

		rawMap.addLayer({
			id: 'nsw-operating-areas-labels',
			type: 'symbol',
			source: sourceId,
			minzoom: 7.5,
			layout: {
				'text-field': ['get', 'areaLabel'],
				'text-size': 11,
				'text-max-width': 16,
				'text-allow-overlap': false
			},
			paint: {
				'text-color': '#173d2c',
				'text-halo-color': 'rgba(255,255,255,0.92)',
				'text-halo-width': 1.5
			}
		});

		rawMap.on('mouseenter', 'nsw-operating-areas-fill', () => {
			rawMap.getCanvas().style.cursor = 'pointer';
		});

		rawMap.on('mouseleave', 'nsw-operating-areas-fill', () => {
			rawMap.getCanvas().style.cursor = '';
		});

		rawMap.on('click', 'nsw-operating-areas-fill', (event: any) => {
			const properties = event.features?.[0]?.properties ?? {};

			selectedArea = {
				name: String(properties.areaLabel ?? properties.organisationName ?? 'Operating area'),
				organisation: String(properties.organisationName ?? 'NSW wildlife rehabilitation'),
				status:
					properties.directoryStatus === 'CURRENT'
						? 'Current directory match'
						: 'GIS layer requires directory review'
			};
		});
	}

	async function loadOperatingAreas(rawMap: any) {
		areasState = 'loading';

		try {
			const response = await fetch('/api/operating-areas');
			if (!response.ok) throw new Error(`Operating-area request failed: ${response.status}`);

			const collection = (await response.json()) as OperatingAreaCollection;
			areaFeatureCount = collection.features.length;
			installAreaLayers(rawMap, collection);

			areasState = collection.metadata?.failedLayers?.length ? 'partial' : 'ready';

			const hunterBounds = coordinateBounds(collection, 'native-animal-trust-fund');
			if (hunterBounds) {
				rawMap.fitBounds(hunterBounds, {
					padding: 70,
					duration: 700,
					maxZoom: 10
				});
			}
		} catch (error) {
			areasState = 'error';
			console.error('Unable to load NSW wildlife operating areas.', error);
		}
	}

	async function handleMapReady() {
		$mapRef = ref;
		secureContext = window.isSecureContext;

		const rawMap = ref?.getMap?.();
		if (!rawMap) return;

		if (typeof rawMap.isStyleLoaded === 'function' && !rawMap.isStyleLoaded()) {
			await new Promise<void>((resolve) => rawMap.once('load', () => resolve()));
		}

		await loadOperatingAreas(rawMap);
	}
</script>

<div class="map-shell">
	<Map
		bind:this={ref}
		bind:center
		bind:zoom
		accessToken={mapboxAccessToken}
		style="mapbox://styles/michaelcuneo/ckzzecgy7005j14qvpzd53fgn"
		onready={handleMapReady}
	>
		<Marker lat={$coords[1]} lng={$coords[0]} label={user.name}>
			<Avatar src={Michael} initials="MC" />
		</Marker>

		{#each $data.pending as item}
			<Marker lat={item.latitude} lng={item.longitude} label={item.type}>
				<Type color={item.color} type={item.type} />
			</Marker>
		{/each}

		{#each $data.assigned as item}
			<Marker lat={item.latitude} lng={item.longitude} label={item.type}>
				<Type color={item.color} type={item.type} />
			</Marker>
		{/each}

		{#each $data.completed as item}
			<Marker lat={item.latitude} lng={item.longitude} label={item.type}>
				<Type color={item.color} type={item.type} />
			</Marker>
		{/each}

		<NavigationControl />
		{#if secureContext}
			<GeolocateControl />
		{/if}
		<ScaleControl />
	</Map>

	<div class="area-panel">
		<div class="area-panel-heading">
			<span class="area-dot"></span>
			<div>
				<strong>NSW operating areas</strong>
				<small>DCCEEW boundary data</small>
			</div>
		</div>

		{#if areasState === 'loading'}
			<p>Loading official boundaries…</p>
		{:else if areasState === 'error'}
			<p class="error">Boundary service unavailable.</p>
		{:else}
			<p>{areaFeatureCount} mapped boundary features loaded.</p>
			{#if areasState === 'partial'}
				<small class="warning">Some DCCEEW layers did not respond.</small>
			{/if}
		{/if}

		<div class="legend">
			<span><i class="swatch hunter"></i>Hunter Wildlife Rescue</span>
			<span><i class="swatch wires"></i>WIRES branches</span>
			<span><i class="swatch other"></i>Other rehabilitation groups</span>
		</div>

		{#if selectedArea}
			<div class="selected-area">
				<small>Selected operating area</small>
				<strong>{selectedArea.name}</strong>
				<span>{selectedArea.status}</span>
			</div>
		{/if}
	</div>
</div>

<style>
	.map-shell {
		position: fixed;
		inset: 0;
		overflow: hidden;
		background: #dce6df;
	}

	:global(.mapboxgl-map) {
		width: 100% !important;
		height: 100% !important;
	}

	.area-panel {
		position: absolute;
		z-index: 8;
		top: 78px;
		right: 18px;
		width: min(285px, calc(100vw - 36px));
		padding: 13px 14px;
		border: 1px solid rgb(23 61 44 / 12%);
		border-radius: 12px;
		background: rgb(255 255 255 / 92%);
		box-shadow: 0 12px 30px rgb(23 61 44 / 14%);
		backdrop-filter: blur(10px);
		pointer-events: none;
	}

	.area-panel-heading {
		display: flex;
		align-items: center;
		gap: 9px;
	}

	.area-panel-heading strong,
	.area-panel-heading small {
		display: block;
	}

	.area-panel-heading strong {
		color: #173d2c;
		font-size: 12px;
	}

	.area-panel-heading small,
	.area-panel p,
	.area-panel .warning {
		color: #6b766f;
		font-size: 9px;
	}

	.area-panel p {
		margin: 8px 0 0;
	}

	.area-panel p.error {
		color: #a23f35;
	}

	.area-dot {
		width: 9px;
		height: 9px;
		border-radius: 999px;
		background: #50a971;
		box-shadow: 0 0 0 4px rgb(80 169 113 / 13%);
	}

	.legend {
		display: grid;
		gap: 5px;
		margin-top: 10px;
		padding-top: 9px;
		border-top: 1px solid rgb(23 61 44 / 9%);
	}

	.legend span {
		display: flex;
		align-items: center;
		gap: 7px;
		color: #445249;
		font-size: 9px;
	}

	.swatch {
		width: 17px;
		height: 8px;
		border-radius: 2px;
		border: 1px solid;
	}

	.swatch.hunter {
		border-color: #8a6200;
		background: rgb(242 183 5 / 35%);
	}

	.swatch.wires {
		border-color: #31597f;
		background: rgb(81 125 168 / 25%);
	}

	.swatch.other {
		border-color: #2d7148;
		background: rgb(80 169 113 / 24%);
	}

	.selected-area {
		display: grid;
		gap: 2px;
		margin-top: 10px;
		padding: 9px 10px;
		border-radius: 8px;
		background: #f4f7f5;
	}

	.selected-area small,
	.selected-area span {
		color: #6b766f;
		font-size: 8px;
	}

	.selected-area strong {
		color: #173d2c;
		font-size: 10px;
	}

	@media (max-width: 760px) {
		.area-panel {
			top: auto;
			right: 12px;
			bottom: 64px;
			left: 12px;
			width: auto;
		}

		.legend {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.legend span {
			align-items: flex-start;
		}
	}
</style>
