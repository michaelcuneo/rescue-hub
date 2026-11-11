<script lang="ts">
	import { onDestroy } from 'svelte';
	import { resolvedTheme } from '$lib/theme';
	import { env } from '$env/dynamic/public';
	import { get } from 'svelte/store';
	import { Map, Marker, controls } from '@beyonk/svelte-mapbox';
	import { coords, mapRef, data, selectedRescue, intakeOpen, draftLocation } from '$lib/stores';
	import Type from '$lib/components/Type.svelte';
	import Avatar from './Avatar.svelte';
	import Michael from '$lib/images/michael.jpg';
	import { shouldShowRescuePin } from '../../../../core/case-map-visibility';

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
	let mapSurface: HTMLDivElement | undefined;
	let resizeObserver: ResizeObserver | undefined;

	onDestroy(() => resizeObserver?.disconnect());

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

		// Mapbox must recalculate its canvas when the dispatch workspace changes size.
		if (mapSurface && typeof ResizeObserver !== 'undefined') {
			resizeObserver?.disconnect();
			resizeObserver = new ResizeObserver(() => rawMap.resize?.());
			resizeObserver.observe(mapSurface);
		}
		rawMap.resize?.();

		if (typeof rawMap.isStyleLoaded === 'function' && !rawMap.isStyleLoaded()) {
			await new Promise<void>((resolve) => rawMap.once('load', () => resolve()));
		}

		await loadOperatingAreas(rawMap);

		rawMap.on('click', (event: any) => {
			if (!get(intakeOpen)) return;

			draftLocation.set({
				longitude: event.lngLat.lng,
				latitude: event.lngLat.lat,
				label: 'Dropped map pin'
			});
		});
	}
</script>

<div class="map-shell">
	<div class="map-surface" bind:this={mapSurface}>
	{#key $resolvedTheme}
	<Map
		bind:this={ref}
		bind:center
		bind:zoom
		accessToken={mapboxAccessToken}
		style={$resolvedTheme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/michaelcuneo/ckzzecgy7005j14qvpzd53fgn'}
		onready={handleMapReady}
	>
		<Marker lat={$coords[1]} lng={$coords[0]} label={user.name}>
			<Avatar src={Michael} initials="MC" />
		</Marker>

		{#each $data.pending.filter(shouldShowRescuePin) as item}
			<Marker lat={item.latitude} lng={item.longitude} label={item.type}>
				<Type
				color={item.color}
				type={item.type}
				selected={$selectedRescue?.id === item.id}
				onclick={() => ($selectedRescue = item)}
			/>
			</Marker>
		{/each}

		{#each $data.assigned.filter(shouldShowRescuePin) as item}
			<Marker lat={item.latitude} lng={item.longitude} label={item.type}>
				<Type
				color={item.color}
				type={item.type}
				selected={$selectedRescue?.id === item.id}
				onclick={() => ($selectedRescue = item)}
			/>
			</Marker>
		{/each}


		<NavigationControl />
		{#if secureContext}
			<GeolocateControl />
		{/if}
		<ScaleControl />

		{#if $draftLocation}
			<Marker lat={$draftLocation.latitude} lng={$draftLocation.longitude} label="New rescue">
				<div class="draft-marker" aria-label="New rescue location">
					<span>+</span>
				</div>
			</Marker>
		{/if}
	</Map>
	{/key}
	</div>

	<aside class="area-panel" aria-label="NSW operating areas">
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
	</aside>
</div>

<style>
	.draft-marker {
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		border:4px solid var(--rh-surface);
		border-radius: 50% 50% 50% 8px;
		background:#173d2c;
		color:white;
		box-shadow: 0 4px 14px rgb(0 0 0 / 0.3);
		transform: rotate(-45deg);
	}

	.draft-marker span {
		font-size: 19px;
		font-weight: 400;
		transform: rotate(45deg);
	}

	.map-shell {
		position: fixed;
		z-index: 1;
		top: var(--dispatch-content-top, 84px);
		right: var(--dispatch-gutter, 16px);
		bottom: var(--dispatch-gutter, 16px);
		left: calc(var(--dispatch-queue-width, 365px) + var(--dispatch-gutter, 16px) * 2);
		display: grid;
		grid-template-columns: minmax(0, 1fr) var(--dispatch-areas-width, 285px);
		gap: var(--dispatch-gutter, 16px);
		min-width: 0;
		min-height: 0;
		pointer-events: none;
	}

	.map-surface {
		position: relative;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		border:1px solid rgb(27 62 45 / 12%);
		border-radius: 16px;
		background:var(--rh-map-background);
		box-shadow: 0 16px 42px rgb(26 54 41 / 14%);
		pointer-events: auto;
	}

	.map-surface :global(.mapboxgl-map) {
		width: 100% !important;
		height: 100% !important;
	}

	.map-surface :global(.mapboxgl-ctrl-top-right) {
		top: 10px;
		right: 10px;
	}

	.area-panel {
		position: relative;
		z-index: 2;
		min-width: 0;
		min-height: 0;
		overflow-y: auto;
		padding: 16px;
		border:1px solid rgb(27 62 45 / 12%);
		border-radius: 16px;
		background:var(--rh-surface);
		box-shadow: 0 16px 42px rgb(26 54 41 / 14%);
		backdrop-filter: blur(14px);
		pointer-events: auto;
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
		color:var(--rh-t3, #173d2c);
		font-size: 12px;
	}

	.area-panel-heading small,
	.area-panel p,
	.area-panel .warning {
		color:var(--rh-t68, #6b766f);
		font-size: 9px;
	}

	.area-panel p {
		margin: 8px 0 0;
	}

	.area-panel p.error {
		color:var(--rh-t69, #a23f35);
	}

	.area-dot {
		width: 9px;
		height: 9px;
		border-radius: 999px;
		background:#50a971;
		box-shadow: 0 0 0 4px rgb(80 169 113 / 13%);
	}

	.legend {
		display: grid;
		gap: 5px;
		margin-top: 10px;
		padding-top: 9px;
		border-top:1px solid rgb(23 61 44 / 9%);
	}

	.legend span {
		display: flex;
		align-items: center;
		gap: 7px;
		color:var(--rh-t70, #445249);
		font-size: 9px;
	}

	.swatch {
		width: 17px;
		height: 8px;
		border-radius: 2px;
		border:1px solid;
	}

	.swatch.hunter {
		border-color:#8a6200;
		background:rgb(242 183 5 / 35%);
	}

	.swatch.wires {
		border-color:#31597f;
		background:rgb(81 125 168 / 25%);
	}

	.swatch.other {
		border-color:#2d7148;
		background:rgb(80 169 113 / 24%);
	}

	.selected-area {
		display: grid;
		gap: 2px;
		margin-top: 10px;
		padding: 9px 10px;
		border-radius: 8px;
		background:var(--rh-t71, #f4f7f5);
	}

	.selected-area small,
	.selected-area span {
		color:var(--rh-t68, #6b766f);
		font-size: 8px;
	}

	.selected-area strong {
		color:var(--rh-t3, #173d2c);
		font-size: 10px;
	}

	/* On narrower desktops, preserve map usability by putting boundaries below it. */
	@media (max-width: 1120px) {
		.map-shell {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: minmax(200px, 1fr) auto;
		}

		.area-panel {
			max-height: min(31vh, 250px);
		}

		.legend {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.legend span {
			align-items: flex-start;
		}
	}

	/* The dispatch queue occupies the lower half of the compact layout. */
	@media (max-width: 700px) {
		.map-shell {
			top: 78px;
			right: var(--dispatch-gutter, 10px);
			bottom: calc(45vh + var(--dispatch-gutter, 10px) * 2);
			left: var(--dispatch-gutter, 10px);
			display: block;
		}

		.map-surface {
			width: 100%;
			height: 100%;
		}

		.area-panel {
			position: absolute;
			z-index: 8;
			right: 10px;
			bottom: 10px;
			left: 10px;
			max-height: min(33%, 120px);
			padding: 8px 10px;
			border-radius: 10px;
		}

		.legend span {
			font-size: 8px;
		}
	}

	/* A legible, neutral rail and properly themed Mapbox control surfaces. */
	.area-panel, .map-surface { border: 1px solid var(--rh-border); box-shadow: var(--rh-shadow); }
	.area-panel { background: var(--rh-surface); color: var(--rh-text); backdrop-filter: none; }
	.area-panel-heading strong, .selected-area strong { color: var(--rh-text); font-size: 13px; }
	.area-panel-heading small, .area-panel p, .area-panel .warning,
	.legend span, .selected-area small, .selected-area span {
		color: var(--rh-muted); font-size: 12px; line-height: 1.55;
	}
	.legend { gap: 10px; margin-top: 16px; padding-top: 14px; border-color: var(--rh-border); }
	.selected-area { padding: 12px; margin-top: 16px; background: var(--rh-surface-soft); }
	.map-surface :global(.mapboxgl-ctrl-group) {
		background: var(--rh-surface); border: 1px solid var(--rh-border);
	}
	.map-surface :global(.mapboxgl-ctrl-group button) { border-color: var(--rh-border); }
	.map-surface :global(.mapboxgl-ctrl-group button:hover) { background: var(--rh-raised); }
</style>
