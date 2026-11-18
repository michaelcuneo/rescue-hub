<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { resolvedTheme } from '$lib/theme';
  import { mapRef, data, selectedRescue, intakeOpen, draftLocation, coords, type RescueItem, type DraftLocation } from '$lib/stores';
  import { rescueTodayNSW, completedOnNSWDay } from '$lib/rescue-list';
  import { currentAnimalPin } from '../../../../core/current-animal-pin';
   import { shouldShowOperationsMapPin } from '../../../../core/case-map-visibility';
  import { RESCUE_PIN_GROUPS, pinForRescue } from '../../../../core/rescue-pin-groups';

  // Same pinned, browser-only proof of concept as Administration → Rescues → Map.
  // Keep the npm lockfile and Mapbox-based Expo application untouched for now.
  const MAPLIBRE_ESM = 'https://unpkg.com/maplibre-gl@6.18.0/dist/maplibre-gl.mjs';
  const LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
  const DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark';
  const PIN_SOURCE = 'rescue-operations-pins';
  const ANIMAL_SOURCE = 'live-animal-gps-checkpoints';
  const AREA_SOURCE = 'nsw-operating-areas';

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

  let container: HTMLDivElement | undefined;
  let mapSurface: HTMLDivElement | undefined;
  let mapInstance: any;
  let draftMarker: any;
  let resizeObserver: ResizeObserver | undefined;
  let mapReady = $state(false);
  let mapError = $state('');
  let areasState: 'loading' | 'ready' | 'partial' | 'error' = $state('loading');
  let areaFeatureCount = $state(0);
  let selectedArea: AreaSelection | null = $state(null);
  let cachedAreas: OperatingAreaCollection | null = null;
  let fittedInitialArea = false;
  let currentNSWDay = $state(rescueTodayNSW());

  const colourExpression: unknown[] = ['match', ['get', 'group']];
  for (const [group, definition] of Object.entries(RESCUE_PIN_GROUPS)) {
    colourExpression.push(group, definition.color);
  }
  colourExpression.push('#455665');

  function validPin(item: RescueItem): boolean {
    return shouldShowOperationsMapPin(item, completedOnNSWDay(item, currentNSWDay)) &&
      Number.isFinite(item.latitude) && Number.isFinite(item.longitude) &&
      Math.abs(item.latitude) <= 90 && Math.abs(item.longitude) <= 180 &&
      !(item.latitude === 0 && item.longitude === 0);
  }

  function pinCollection(items: RescueItem[]) {
    return {
      type: 'FeatureCollection' as const,
      features: items.filter(validPin).map(item => ({
        type: 'Feature' as const,
        properties: {
          id: item.id,
          type: item.type,
          status: item.status ?? 'PENDING',
          group: pinForRescue(item).group,
          initials: pinForRescue(item).initials
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [currentAnimalPin(item).longitude, currentAnimalPin(item).latitude]
        }
      }))
    };
  }

  function currentAnimalLocations(_items: RescueItem[]) {
    return { type: 'FeatureCollection', features: [] };
  }
  function updateRescueSource(items: RescueItem[]) {
    const map = mapInstance;
    if (!mapReady || !map?.getSource?.(PIN_SOURCE)) return;
    map.getSource(PIN_SOURCE).setData(pinCollection(items));
    map.getSource(ANIMAL_SOURCE)?.setData(currentAnimalLocations(items));
  }

  function updateSelectedPin(id: string) {
    const map = mapInstance;
    if (mapReady && map?.getLayer?.('rescue-operations-selected')) {
      map.setFilter('rescue-operations-selected', ['==', ['get', 'id'], id]);
    }
  }

  // Map clicks, mouse dragging and keyboard nudges all update the same
  // draft coordinates. The selected address is not retained after moving.
  function setMapDraftPin(latitude: number, longitude: number) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return;
    draftLocation.set({
      latitude,
      longitude,
      label: `Map pin at ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      source: 'MAP'
    });
  }

  function setDraftMarker(location: DraftLocation | null) {
    if (!mapReady || !mapInstance || !mapLibreModule) return;
    if (!get(intakeOpen) || !location ||
        !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
      draftMarker?.remove();
      draftMarker = undefined;
      return;
    }

    // Reuse one draggable marker. Rebuilding it on every dragend would
    // interrupt the gesture and reset focus for keyboard users.
    if (draftMarker) {
      if (!draftMarker.isDragging?.()) {
        draftMarker.setLngLat([location.longitude, location.latitude]);
      }
      return;
    }

    const element = document.createElement('div');
    element.className = 'rescue-draft-map-marker';
    element.textContent = '+';
    element.tabIndex = 0;
    element.setAttribute('role', 'button');
    element.setAttribute('aria-label', 'Move rescue pin: drag or use arrow keys');
    element.title = 'Drag this pin to adjust the rescue location';
    element.addEventListener('keydown', (event: KeyboardEvent) => {
      const direction: Record<string, [number, number]> = {
        ArrowUp: [1, 0], ArrowDown: [-1, 0],
        ArrowRight: [0, 1], ArrowLeft: [0, -1]
      };
      const delta = direction[event.key];
      if (!delta || !draftMarker) return;
      event.preventDefault();
      event.stopPropagation();
      const coordinate = draftMarker.getLngLat();
      const step = event.shiftKey ? 0.001 : 0.0001;
      setMapDraftPin(
        Math.max(-90, Math.min(90, coordinate.lat + delta[0] * step)),
        Math.max(-180, Math.min(180, coordinate.lng + delta[1] * step))
      );
    });
    draftMarker = new mapLibreModule.Marker({
      element, anchor: 'center', draggable: true
    }).setLngLat([location.longitude, location.latitude]).addTo(mapInstance);
    draftMarker.on('dragend', () => {
      const coordinate = draftMarker?.getLngLat();
      if (coordinate) setMapDraftPin(coordinate.lat, coordinate.lng);
    });
  }

  let mapLibreModule: any;

  function coordinateBounds(collection: OperatingAreaCollection, organisationId: string) {
    let minLng = Number.POSITIVE_INFINITY;
    let minLat = Number.POSITIVE_INFINITY;
    let maxLng = Number.NEGATIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;

    const walk = (value: unknown) => {
      if (!Array.isArray(value)) return;
      if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
        const lng = value[0], lat = value[1];
        minLng = Math.min(minLng, lng);
        minLat = Math.min(minLat, lat);
        maxLng = Math.max(maxLng, lng);
        maxLat = Math.max(maxLat, lat);
      } else value.forEach(walk);
    };

    for (const feature of collection.features) {
      if (feature.properties.organisationId === organisationId) walk(feature.geometry.coordinates);
    }
    if (!Number.isFinite(minLng)) return null;
    return [[minLng, minLat], [maxLng, maxLat]] as [[number, number], [number, number]];
  }

  function installRescueLayers(map: any) {
    if (!map.getSource(PIN_SOURCE)) {
      const snapshot = get(data);
      map.addSource(PIN_SOURCE, {
        type: 'geojson',
        data: pinCollection([...snapshot.pending, ...snapshot.assigned, ...snapshot.completed])
      });
    }
    if (!map.getSource(ANIMAL_SOURCE)) {
      const snapshot = get(data);
      map.addSource(ANIMAL_SOURCE, { type: 'geojson', data: currentAnimalLocations([...snapshot.pending, ...snapshot.assigned, ...snapshot.completed]) });
    }
    if (map.getLayer('rescue-operations-main')) return;
    // Native GPU layers stay attached to geographic coordinates across
    // pan/zoom/rotation. The ring, initials and small status dot match the
    // previous rescue marker semantics without one DOM button per animal.
    map.addLayer({
      id: 'rescue-operations-selected', type: 'circle', source: PIN_SOURCE,
      filter: ['==', ['get', 'id'], get(selectedRescue)?.id ?? ''],
      paint: {
        'circle-radius': 25,
        'circle-color': '#ffffff',
        'circle-opacity': 0.85,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#173d2c'
      }
    });
    map.addLayer({
      id: 'rescue-operations-main', type: 'circle', source: PIN_SOURCE,
      paint: {
        'circle-radius': 19,
        'circle-color': colourExpression,
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff'
      }
    });
    map.addLayer({
      id: 'rescue-operations-initials', type: 'symbol', source: PIN_SOURCE,
      layout: {
        'text-field': ['get', 'initials'],
        'text-size': 11,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'text-font': ['Noto Sans Regular']
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-width': 0.2,
        'text-halo-color': '#173d2c'
      }
    });
    map.addLayer({
      id: 'rescue-operations-animal-gps', type: 'circle', source: ANIMAL_SOURCE,
      paint: { 'circle-radius': 9, 'circle-color': '#1d72ba',
        'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.5 }
    });
    map.addLayer({
      id: 'rescue-operations-status', type: 'circle', source: PIN_SOURCE,
      paint: {
        'circle-radius': 6.5,
        'circle-translate': [15, 15],
        'circle-color': [
          'match', ['get', 'status'],
          'PENDING', '#d92b04',
          'ASSIGNED', '#c18a12',
          'COMPLETED', '#50a971',
          '#64748b'
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });
  }

  function installAreaLayers(map: any, collection: OperatingAreaCollection) {
    if (map.getSource(AREA_SOURCE)) {
      map.getSource(AREA_SOURCE).setData(collection);
      return;
    }
    map.addSource(AREA_SOURCE, { type: 'geojson', data: collection });
    // Insert the regions underneath rescue pins and text labels, never over
    // the incident markers.
    const before = map.getLayer('rescue-operations-selected')
      ? 'rescue-operations-selected' : undefined;
    map.addLayer({
      id: 'nsw-operating-areas-fill',
      type: 'fill',
      source: AREA_SOURCE,
      paint: {
        'fill-color': [
          'match', ['get', 'organisationId'],
          'native-animal-trust-fund', '#f2b705',
          'wires', '#517da8',
          '#50a971'
        ],
        'fill-opacity': [
          'case',
          ['==', ['get', 'organisationId'], 'native-animal-trust-fund'],
          0.22, 0.08
        ]
      }
    }, before);
    map.addLayer({
      id: 'nsw-operating-areas-outline',
      type: 'line',
      source: AREA_SOURCE,
      paint: {
        'line-color': [
          'match', ['get', 'organisationId'],
          'native-animal-trust-fund', '#8a6200',
          'wires', '#31597f',
          '#2d7148'
        ],
        'line-width': [
          'case',
          ['==', ['get', 'organisationId'], 'native-animal-trust-fund'],
          2.5, 1
        ],
        'line-opacity': 0.85
      }
    }, before);
    map.addLayer({
      id: 'nsw-operating-areas-labels',
      type: 'symbol',
      source: AREA_SOURCE,
      minzoom: 7.5,
      layout: {
        'text-field': ['get', 'areaLabel'],
        'text-size': 11,
        'text-max-width': 16,
        'text-allow-overlap': false
      },
      paint: {
        'text-color': '#173d2c',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5
      }
    }, before);
  }

  async function loadOperatingAreas(map: any) {
    areasState = 'loading';
    try {
      let collection = cachedAreas;
      if (!collection) {
        const response = await fetch('/api/operating-areas', { cache: 'no-store' });
        if (!response.ok) throw new Error('Operating-area request failed: ' + response.status);
        collection = await response.json() as OperatingAreaCollection;
        cachedAreas = collection;
      }
      if (map !== mapInstance || !mapReady) return;
      areaFeatureCount = collection.features.length;
      installAreaLayers(map, collection);
      areasState = collection.metadata?.failedLayers?.length ? 'partial' : 'ready';
      if (!fittedInitialArea) {
        fittedInitialArea = true;
        const hunterBounds = coordinateBounds(collection, 'native-animal-trust-fund');
        if (hunterBounds) map.fitBounds(hunterBounds, { padding: 70, duration: 700, maxZoom: 10 });
      }
    } catch (error) {
      if (map !== mapInstance) return;
      areasState = 'error';
      console.error('Unable to load NSW operating areas on MapLibre.', error);
    }
  }

  function hit(map: any, point: unknown, layers: string[]) {
    const availableLayers = layers.filter(id => Boolean(map.getLayer(id)));
    return availableLayers.length
      ? map.queryRenderedFeatures(point, { layers: availableLayers })[0]
      : undefined;
  }

  function registerInteractions(map: any) {
    map.on('click', (event: any) => {
      // While dispatch intake is open, every map click positions its draft
      // pin, even when clicking over an existing rescue or NSW area.
      if (get(intakeOpen)) {
        setMapDraftPin(event.lngLat.lat, event.lngLat.lng);
        return;
      }
      const rescueHit = hit(map, event.point, [
        'rescue-operations-animal-gps', 'rescue-operations-status', 'rescue-operations-initials', 'rescue-operations-main'
      ]);
      const id = rescueHit?.properties?.id;
      if (typeof id === 'string') {
        const snapshot = get(data);
        const item = [...snapshot.pending, ...snapshot.assigned, ...snapshot.completed].find(rescue => rescue.id === id);
        if (item) selectedRescue.set(item);
        return;
      }

      const areaHit = hit(map, event.point, ['nsw-operating-areas-fill']);
      if (areaHit) {
        const properties = areaHit.properties ?? {};
        selectedArea = {
          name: String(properties.areaLabel ?? properties.organisationName ?? 'Operating area'),
          organisation: String(properties.organisationName ?? 'NSW wildlife rehabilitation'),
          status: properties.directoryStatus === 'CURRENT'
            ? 'Current directory match' : 'GIS layer requires directory review'
        };
      }

    });

    map.on('mousemove', (event: any) => {
      const feature = hit(map, event.point, [
        'rescue-operations-animal-gps', 'rescue-operations-main', 'rescue-operations-status', 'nsw-operating-areas-fill'
      ]);
      map.getCanvas().style.cursor = get(intakeOpen) ? 'crosshair' : feature ? 'pointer' : '';
    });
  }

  onMount(() => {
    const dayTimer = setInterval(() => {
      const next = rescueTodayNSW();
      if (next !== currentNSWDay) currentNSWDay = next;
    }, 30_000);
    let disposed = false;
    let unsubscribeTheme: (() => void) | undefined;
    const init = async () => {
      try {
        const lib = await import(/* @vite-ignore */ MAPLIBRE_ESM);
        if (disposed || !container) return;
        mapLibreModule = lib;
        let activeTheme = get(resolvedTheme);
        const map = new lib.Map({
          container,
          style: activeTheme === 'dark' ? DARK_STYLE : LIGHT_STYLE,
          center: [151.66, -32.95],
          zoom: 9,
          attributionControl: true
        });
        mapInstance = map;
        // Keep the existing public mapRef.getMap() API used by DispatcherShell.
        const publicRef = { getMap: () => map };
        mapRef.set(publicRef);
        map.addControl(new lib.NavigationControl(), 'top-right');
        map.addControl(new lib.ScaleControl(), 'bottom-left');
        if (window.isSecureContext) {
          const geolocate = new lib.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: true,
            showUserHeading: true
          });
          geolocate.on('geolocate', (event: GeolocationPosition) => {
            coords.set([event.coords.longitude, event.coords.latitude]);
          });
          map.addControl(geolocate, 'top-right');
        }
        registerInteractions(map);

        map.on('style.load', () => {
          if (disposed) return;
          try {
            installRescueLayers(map);
            mapReady = true;
            mapError = '';
            const snapshot = get(data);
            updateRescueSource([...snapshot.pending, ...snapshot.assigned, ...snapshot.completed]);
            updateSelectedPin(get(selectedRescue)?.id ?? '');
            setDraftMarker(get(draftLocation));
            void loadOperatingAreas(map);
          } catch (error) {
            console.error('Unable to configure MapLibre Operations layers', error);
            mapError = error instanceof Error ? error.message : 'Map layers unavailable';
          }
        });
        map.on('error', (event: any) => {
          if (!mapReady) mapError = event.error?.message ?? 'Map tiles could not load';
        });

        if (mapSurface && typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => map.resize());
          resizeObserver.observe(mapSurface);
        }
        map.resize();
        unsubscribeTheme = resolvedTheme.subscribe(theme => {
          if (disposed || theme === activeTheme) return;
          activeTheme = theme;
          mapReady = false;
          map.setStyle(theme === 'dark' ? DARK_STYLE : LIGHT_STYLE);
        });
      } catch (error) {
        if (!disposed) {
          console.error('MapLibre Operations map failed', error);
          mapError = error instanceof Error ? error.message : 'MapLibre failed to load';
        }
      }
    };
    void init();
    return () => {
      disposed = true;
      clearInterval(dayTimer);
      unsubscribeTheme?.();
      resizeObserver?.disconnect();
      draftMarker?.remove();
      draftMarker = undefined;
      mapReady = false;
      mapRef.set(undefined);
      mapInstance?.remove();
      mapInstance = undefined;
    };
  });

  $effect(() => {
    const pending = $data.pending;
    const assigned = $data.assigned;
    const completed = $data.completed;
    currentNSWDay;
    if (mapReady) updateRescueSource([...pending, ...assigned, ...completed]);
  });
  $effect(() => {
    const selected = $selectedRescue?.id ?? '';
    if (mapReady) updateSelectedPin(selected);
  });
  $effect(() => {
    const location = $draftLocation;
    const isIntakeOpen = $intakeOpen;
    if (mapReady) setDraftMarker(isIntakeOpen ? location : null);
  });
</script>

<svelte:head>
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@6.18.0/dist/maplibre-gl.css" />
</svelte:head>

<div class="map-shell">
  <div class="map-surface" bind:this={mapSurface}>
    <div class="maplibre-surface" bind:this={container}
      role="region" aria-label="Live rescue operations locations"></div>
    {#if mapError}
      <p class="maplibre-error" role="alert">MapLibre: {mapError}</p>
    {:else if !mapReady}
      <p class="maplibre-loading" role="status">Loading rescue map…</p>
    {/if}
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
    <div class="species-legend" aria-label="Rescue marker animal groups">
      <small>One map pin per case: latest recorded animal position, or the original report when no later position is available.</small>
      <strong>Animal groups</strong>
      <div class="species-legend-items">
        {#each Object.entries(RESCUE_PIN_GROUPS) as [group, pinGroup]}
          {#if [...$data.pending, ...$data.assigned].some((item) => pinForRescue(item).group === group)}
            <span><i style:background-color={pinGroup.color}></i>{pinGroup.label}</span>
          {/if}
        {/each}
      </div>
      <small>Marker colour identifies the animal group. The smaller dot shows dispatch status.</small>
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
  .maplibre-surface {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .maplibre-surface :global(.maplibregl-map) {
    width: 100%;
    height: 100%;
  }
  .maplibre-error, .maplibre-loading {
    position: absolute;
    z-index: 5;
    top: 14px;
    left: 14px;
    max-width: calc(100% - 28px);
    margin: 0;
    padding: 10px 12px;
    border: 1px solid var(--rh-border);
    border-radius: 9px;
    background: var(--rh-surface);
    color: var(--rh-text);
    font-size: 12px;
    box-shadow: var(--rh-shadow);
  }
  .maplibre-error { color: var(--rh-danger-text); }
  .map-surface :global(.rescue-draft-map-marker) {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border: 4px solid var(--rh-surface);
    border-radius: 50% 50% 50% 8px;
    background: #173d2c;
    color: white;
    font-size: 19px;
    box-shadow: 0 4px 14px rgb(0 0 0 / 0.3);
    cursor: grab;
    touch-action: none;
  }
  .map-surface :global(.rescue-draft-map-marker:active) { cursor: grabbing; }
  .map-surface :global(.rescue-draft-map-marker:focus-visible) {
    outline: 3px solid var(--rh-focus);
    outline-offset: 4px;
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

	.map-surface :global(.maplibregl-map) {
		width: 100% !important;
		height: 100% !important;
	}

	.map-surface :global(.maplibregl-ctrl-top-right) {
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

	.species-legend { display: grid; gap: 8px; margin-top: 15px; padding-top: 12px; border-top: 1px solid var(--rh-border); }
	.species-legend > strong { font-size: 12px; color: var(--rh-text); }
	.species-legend-items { display: flex; flex-wrap: wrap; gap: 6px 10px; }
	.species-legend-items span { display: inline-flex; align-items: center; gap: 6px; color: var(--rh-muted); font-size: 11px; }
	.species-legend-items i { width: 10px; height: 10px; border: 1px solid rgb(255 255 255 / 0.75); border-radius: 50%; flex: 0 0 10px; }
	.species-legend small { color: var(--rh-muted); font-size: 11px; line-height: 1.45; }

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
			top: var(--rh-content-top, 106px);
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

	/* A legible, neutral rail and properly themed MapLibre control surfaces. */
	.area-panel, .map-surface { border: 1px solid var(--rh-border); box-shadow: var(--rh-shadow); }
	.area-panel { background: var(--rh-surface); color: var(--rh-text); backdrop-filter: none; }
	.area-panel-heading strong, .selected-area strong { color: var(--rh-text); font-size: 13px; }
	.area-panel-heading small, .area-panel p, .area-panel .warning,
	.legend span, .selected-area small, .selected-area span {
		color: var(--rh-muted); font-size: 12px; line-height: 1.55;
	}
	.legend { gap: 10px; margin-top: 16px; padding-top: 14px; border-color: var(--rh-border); }
	.selected-area { padding: 12px; margin-top: 16px; background: var(--rh-surface-soft); }
	.map-surface :global(.maplibregl-ctrl-group) {
		background: var(--rh-surface); border: 1px solid var(--rh-border);
	}
	.map-surface :global(.maplibregl-ctrl-group button) { border-color: var(--rh-border); }
	.map-surface :global(.maplibregl-ctrl-group button:hover) { background: var(--rh-raised); }
</style>
