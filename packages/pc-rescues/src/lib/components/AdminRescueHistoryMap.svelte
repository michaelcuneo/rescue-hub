<script lang="ts">
  import { onMount } from 'svelte';
  import { resolvedTheme } from '$lib/theme';
  import { pinForRescue, RESCUE_PIN_GROUPS } from '../../../../core/rescue-pin-groups';
  import type { Rescue } from '$lib/server/graphql';

  let { rescues, selectedId = null, focusedRescue = null, onSelect }: {
    rescues: Rescue[];
    selectedId?: string | null;
    focusedRescue?: Rescue | null;
    onSelect?: (id: string) => void;
  } = $props();

  type AreaCollection = {
    type: 'FeatureCollection';
    features: Array<{ type: 'Feature'; geometry: { type: string; coordinates: unknown }; properties: Record<string, unknown> }>;
    metadata?: { failedLayers?: Array<{ layerId: number }> };
  };

  const SOURCE = 'historical-rescue-pins';
  const RELEASE_SOURCE = 'historical-relocation-pins';
  const AREA_SOURCE = 'historical-operating-areas';
  // POC only: use a pinned, browser-only MapLibre module so the rest of
  // Rescue Hub and its current npm lockfile stay completely unchanged.
  const MAPLIBRE_ESM = 'https://unpkg.com/maplibre-gl@6.18.0/dist/maplibre-gl.mjs';
  const LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
  const DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark';
  let container: HTMLDivElement | undefined;
  let mapInstance: any;
  let mapReady = $state(false);
  let mapError = $state('');
  let listenersInstalled = false;
  let cachedAreaCollection: AreaCollection | null = null;
  let boundaryStatus = $state<'loading' | 'ready' | 'partial' | 'error'>('loading');
  let areaCount = $state(0);
  let surface: HTMLDivElement | undefined;
  let resizeObserver: ResizeObserver | undefined;
  const mappedRescues = $derived(focusedRescue && focusedRescue.id === selectedId && !rescues.some(item => item.id === focusedRescue.id)
    ? [focusedRescue, ...rescues] : rescues);
  const pins = $derived(mappedRescues.filter(item =>
    Number.isFinite(item.latitude) && Number.isFinite(item.longitude) &&
    item.latitude >= -90 && item.latitude <= 90 &&
    item.longitude >= -180 && item.longitude <= 180 &&
    !(item.latitude === 0 && item.longitude === 0)
  ));
  const missingCoordinates = $derived(rescues.length - pins.length);
  const selected = $derived(pins.find(item => item.id === selectedId) ?? null);
  const groups = $derived(Object.entries(RESCUE_PIN_GROUPS).filter(([name]) =>
    pins.some(item => pinForRescue(item).group === name)
  ));

  const groupColours: unknown[] = ['match', ['get', 'group']];
  for (const [key, value] of Object.entries(RESCUE_PIN_GROUPS)) {
    groupColours.push(key, value.color);
  }
  groupColours.push('#455665');

  function getMap(): any {
    return mapInstance;
  }
  function rescueGeoJSON(): any {
    return {
      type: 'FeatureCollection',
      features: pins.map(item => ({
        type: 'Feature',
        properties: {
          id: item.id,
          group: pinForRescue(item).group,
          status: item.status,
          type: item.type
        },
        geometry: { type: 'Point', coordinates: [item.longitude, item.latitude] }
      }))
    };
  }

  function relocationGeoJSON(): any {
    return {
      type: 'FeatureCollection',
      features: pins.filter(item =>
        item.historicalOutcome === 'RELEASED' &&
        item.historicalReleaseReason === 'RELOCATION' &&
        typeof item.historicalReleaseLatitude === 'number' &&
        typeof item.historicalReleaseLongitude === 'number' &&
        Number.isFinite(item.historicalReleaseLatitude) &&
        Number.isFinite(item.historicalReleaseLongitude)
      ).map(item => ({
        type: 'Feature',
        properties: { id: item.id, type: item.type, releaseSite: item.historicalReleaseLocation ?? '' },
        geometry: {
          type: 'Point',
          coordinates: [item.historicalReleaseLongitude, item.historicalReleaseLatitude]
        }
      }))
    };
  }
  function updatePins() {
    const map = getMap();
    if (!mapReady || !map?.getSource?.(SOURCE)) return;
    map.getSource(SOURCE).setData(rescueGeoJSON());
    map.getSource(RELEASE_SOURCE)?.setData(relocationGeoJSON());
  }

  function fitAll() {
    const map = getMap();
    if (!mapReady || !map || !pins.length) return;
    if (pins.length === 1) {
      map.flyTo({ center: [pins[0].longitude, pins[0].latitude], zoom: 11, duration: 450 });
      return;
    }
    let west = Number.POSITIVE_INFINITY;
    let east = Number.NEGATIVE_INFINITY;
    let south = Number.POSITIVE_INFINITY;
    let north = Number.NEGATIVE_INFINITY;
    for (const item of pins) {
      west = Math.min(west, item.longitude);
      east = Math.max(east, item.longitude);
      south = Math.min(south, item.latitude);
      north = Math.max(north, item.latitude);
    }
    map.fitBounds([[west, south], [east, north]], { padding: 66, maxZoom: 12, duration: 450 });
  }

  function installPinLayers(map: any) {
    if (!map.getSource(SOURCE)) {
      map.addSource(SOURCE, {
        type: 'geojson',
        data: rescueGeoJSON(),
        cluster: true,
        clusterRadius: 45,
        clusterMaxZoom: 13
      });
    }
    if (!map.getSource(RELEASE_SOURCE)) {
      map.addSource(RELEASE_SOURCE, { type: 'geojson', data: relocationGeoJSON() });
    }
    if (!map.getLayer('historical-rescue-clusters')) {
      map.addLayer({
        id: 'historical-rescue-clusters',
        source: SOURCE,
        type: 'circle',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#256952',
          'circle-radius': ['step', ['get', 'point_count'], 18, 20, 24, 100, 32],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2
        }
      });
      map.addLayer({
        id: 'historical-rescue-cluster-count',
        source: SOURCE,
        type: 'symbol',
        filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12 },
        paint: { 'text-color': '#ffffff' }
      });
      map.addLayer({
        id: 'historical-rescue-points',
        source: SOURCE,
        type: 'circle',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 10,
          'circle-color': groupColours,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2.5
        }
      });
      map.addLayer({
        id: 'historical-relocations', source: RELEASE_SOURCE,
        type: 'circle',
        paint: { 'circle-radius': 8, 'circle-color': '#8547a0',
          'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.5 }
      });
      map.addLayer({
        id: 'historical-rescue-status',
        source: SOURCE,
        type: 'circle',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 4.5,
          'circle-translate': [8, 8],
          'circle-color': [
            'match', ['get', 'status'],
            'PENDING', '#d92b04',
            'ASSIGNED', '#c18a12',
            'COMPLETED', '#50a971',
            '#64748b'
          ],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5
        }
      });
    }

    if (listenersInstalled) return;
    listenersInstalled = true;

    const selectFeature = (event: any) => {
      const id = event.features?.[0]?.properties?.id;
      if (typeof id === 'string') onSelect?.(id);
    };
    map.on('click', 'historical-rescue-points', selectFeature);
    map.on('click', 'historical-rescue-status', selectFeature);
    map.on('click', 'historical-relocations', selectFeature);
    map.on('click', 'historical-rescue-clusters', (event: any) => {
      const feature = event.features?.[0];
      const id = feature?.properties?.cluster_id;
      if (id == null) return;
      // Zooming in increments works across Mapbox GL versions and avoids
      // relying on differing callback/promise cluster-source APIs.
      map.easeTo({
        center: feature.geometry.coordinates,
        zoom: Math.min((map.getZoom?.() ?? 8) + 2, 16),
        duration: 400
      });
    });
    for (const layer of ['historical-rescue-points', 'historical-rescue-status', 'historical-rescue-clusters', 'historical-relocations']) {
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    }
  }

  async function loadOperatingAreas(map: any) {
    boundaryStatus = 'loading';
    areaCount = 0;
    try {
      let collection = cachedAreaCollection;
      if (!collection) {
        const response = await fetch('/api/operating-areas', { cache: 'no-store' });
        if (!response.ok) throw new Error(`Operating areas HTTP ${response.status}`);
        collection = await response.json() as AreaCollection;
        cachedAreaCollection = collection;
      }
      areaCount = collection.features.length;
      if (!areaCount) throw new Error('No operating-area features were returned');
      if (!map.getSource(AREA_SOURCE)) {
        map.addSource(AREA_SOURCE, { type: 'geojson', data: collection });
        map.addLayer({
          id: 'historical-operating-fill', source: AREA_SOURCE, type: 'fill',
          paint: {
            'fill-color': [
              'match', ['get', 'organisationId'],
              'native-animal-trust-fund', '#f2b705',
              'wires', '#517da8',
              '#50a971'
            ],
            'fill-opacity': 0.10
          }
        }, 'historical-rescue-clusters');
        map.addLayer({
          id: 'historical-operating-outline', source: AREA_SOURCE, type: 'line',
          paint: {
            'line-color': [
              'match', ['get', 'organisationId'],
              'native-animal-trust-fund', '#8a6200',
              'wires', '#31597f',
              '#2d7148'
            ],
            'line-width': 1.8, 'line-opacity': 0.85
          }
        }, 'historical-rescue-clusters');
        map.addLayer({
          id: 'historical-operating-labels', source: AREA_SOURCE, type: 'symbol',
          minzoom: 7.2,
          layout: { 'text-field': ['get', 'areaLabel'], 'text-size': 10, 'text-max-width': 14 },
          paint: { 'text-color': '#173d2c', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 }
        }, 'historical-rescue-clusters');
      } else map.getSource(AREA_SOURCE).setData(collection);
      boundaryStatus = collection.metadata?.failedLayers?.length ? 'partial' : 'ready';
    } catch (error) {
      console.error('Historical rescue map operating areas failed', error);
      boundaryStatus = 'error';
    }
  }

  onMount(() => {
    let disposed = false;
    let unsubscribeTheme: (() => void) | undefined;
    const init = async () => {
      try {
        // MapLibre 6 ships an ESM browser bundle and runs its worker from the
        // same-origin Blob URL; it does not require a Mapbox token or SDK.
        const lib = await import(/* @vite-ignore */ MAPLIBRE_ESM);
        if (disposed || !container) return;

        let activeTheme = $resolvedTheme;
        const map = new lib.Map({
          container,
          style: activeTheme === 'dark' ? DARK_STYLE : LIGHT_STYLE,
          center: [151.66, -32.95],
          zoom: 8,
          attributionControl: true
        });
        mapInstance = map;
        map.addControl(new lib.NavigationControl(), 'top-right');
        map.addControl(new lib.ScaleControl(), 'bottom-left');

        map.on('style.load', () => {
          if (disposed) return;
          try {
            installPinLayers(map);
            mapReady = true;
            mapError = '';
            updatePins();
            if (selected) focusSelected();
            else fitAll();
            void loadOperatingAreas(map);
          } catch (error) {
            console.error('Unable to configure MapLibre rescue layers', error);
            mapError = error instanceof Error ? error.message : 'Unable to configure rescue layers';
          }
        });
        map.on('error', (event: any) => {
          // Keep displaying the existing map when an individual tile fails.
          if (!mapReady) {
            console.error('MapLibre basemap error', event.error);
            mapError = event.error?.message ?? 'Map tiles could not load';
          }
        });

        if (surface && typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => map.resize());
          resizeObserver.observe(surface);
        }
        map.resize();

        unsubscribeTheme = resolvedTheme.subscribe(theme => {
          if (disposed || theme === activeTheme) return;
          activeTheme = theme;
          mapReady = false;
          listenersInstalled = true; // MapLibre preserves delegated event handlers.
          map.setStyle(theme === 'dark' ? DARK_STYLE : LIGHT_STYLE);
        });
      } catch (error) {
        if (disposed) return;
        console.error('MapLibre experiment could not start', error);
        mapError = error instanceof Error ? error.message : 'Unable to load MapLibre';
      }
    };
    void init();
    return () => {
      disposed = true;
      unsubscribeTheme?.();
      resizeObserver?.disconnect();
      mapReady = false;
      mapInstance?.remove();
      mapInstance = undefined;
    };
  });

  $effect(() => {
    pins;
    if (mapReady) {
      updatePins();
      if (!selectedId) fitAll();
    }
  });
  function focusSelected() {
    const map = getMap();
    if (!mapReady || !map || !selected) return;
    map.flyTo({
      center: [selected.longitude, selected.latitude],
      zoom: Math.max(map.getZoom?.() ?? 8, 13),
      duration: 450
    });
  }
  $effect(() => {
    if (!mapReady || !selected) return;
    focusSelected();
  });
  function formatted(value?: string | null): string {
    if (!value) return 'Not recorded';
    const time = new Date(value);
    if (!Number.isFinite(time.getTime())) return 'Not recorded';
    return new Intl.DateTimeFormat('en-AU', {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'Australia/Sydney'
    }).format(time);
  }
</script>

<svelte:head>
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@6.18.0/dist/maplibre-gl.css" />
</svelte:head>

<div class="historical-map-layout">
  <div class="historical-map-surface" bind:this={surface}>
    <div class="maplibre-container" bind:this={container}
      role="region" aria-label="Historical rescue locations on MapLibre"></div>
    {#if mapError}
      <p class="map-unavailable" role="alert">MapLibre: {mapError}</p>
    {:else if !mapReady}
      <p class="map-loading" role="status">Loading MapLibre and the basemap…</p>
    {/if}
    {#if pins.length > 0}
      <button type="button" class="fit-pins" onclick={fitAll}>Show all pins</button>
    {/if}
  </div>
  <aside class="historical-map-panel" aria-label="Historical rescue map details">
    <div class="historical-map-count">
      <strong>{rescues.length} rescue{rescues.length === 1 ? '' : 's'} loaded</strong>
      <span>MapLibre proof of concept · OpenFreeMap basemap</span>
      <span>{pins.length} plotted on the map</span>
      {#if missingCoordinates}<small>{missingCoordinates} without usable coordinates</small>{/if}
      <span class="boundary-status">
        {#if boundaryStatus === 'loading'}Loading NSW operating areas…
        {:else if boundaryStatus === 'error'}Operating-area boundaries unavailable
        {:else}{areaCount} NSW operating-area features{boundaryStatus === 'partial' ? ' (partial)' : ''}{/if}
      </span>
    </div>
    {#if selected}
      <div class="historical-selection" aria-live="polite">
        <span class="detail-eyebrow">Selected rescue</span>
        <h3>{selected.type}</h3>
        {#if selected.breed}<p>{selected.breed}</p>{/if}
        <dl>
          <div><dt>Status</dt><dd>{selected.status}</dd></div>
          <div><dt>Reported</dt><dd>{formatted(selected.createdAt)}</dd></div>
          <div><dt>Last updated</dt><dd>{formatted(selected.updatedAt)}</dd></div>
          <div><dt>Location</dt><dd>{selected.location || 'Coordinates only'}</dd></div>
          <div><dt>Condition</dt><dd>{selected.injury || 'Not recorded'}</dd></div>
          {#if selected.historicalOutcome}
            <div><dt>Animal outcome · Synthetic fixture</dt><dd>{selected.historicalOutcome === 'RELEASED' ? selected.historicalReleaseReason === 'RELOCATION' ? 'Relocated into the wild' : 'Returned to original site' : selected.historicalOutcome === 'EUTHANISED' ? 'Euthanised following veterinary assessment' : 'Deceased in care'}</dd></div>
            {#if selected.historicalReleaseLocation}
              <div><dt>Release site</dt><dd>{selected.historicalReleaseLocation}</dd></div>
            {/if}
            {#if typeof selected.historicalReleaseLatitude === 'number' && typeof selected.historicalReleaseLongitude === 'number'}
              <div><dt>Release GPS</dt><dd>{selected.historicalReleaseLatitude.toFixed(6)}, {selected.historicalReleaseLongitude.toFixed(6)}</dd></div>
            {/if}
          {/if}
          <div><dt>Case ID</dt><dd class="case-id">{selected.id}</dd></div>
        </dl>
      </div>
    {:else}
      <p class="selection-prompt">Select a rescue pin to inspect its report and current recorded status. Clusters can be clicked to zoom in.</p>
    {/if}
    {#if groups.length}
      <div class="historical-map-legend">
        <strong>Animal groups</strong>
        {#each groups as [key, group] (key)}
          <span><i style:background-color={group.color}></i>{group.label}</span>
        {/each}
        <small>Marker colour identifies the animal group. The smaller dot shows rescue status. Purple pins mark synthetic relocation destinations; click either pin to inspect the case.</small>
      </div>
    {/if}
  </aside>
</div>

<style>
  .historical-map-layout { display:grid; grid-template-columns:minmax(0,1fr) minmax(230px,290px); gap:14px; min-height:580px; margin-top:18px; }
  .historical-map-surface { position:relative; min-width:0; height:620px; min-height:480px; overflow:hidden; border:1px solid var(--rh-border); border-radius:13px; background:var(--rh-map-background); }
  .maplibre-container { position:absolute; inset:0; width:100%; height:100%; }
  .maplibre-container :global(.maplibregl-map) { height:100%; width:100%; }
  .map-loading, .map-unavailable { position:absolute; z-index:3; left:14px; top:14px; max-width:calc(100% - 28px); margin:0; padding:10px 12px; border:1px solid var(--rh-border); border-radius:9px; background:var(--rh-surface); color:var(--rh-text); font-size:12px; box-shadow:var(--rh-shadow); }
  .fit-pins { position:absolute; z-index:2; left:12px; top:12px; padding:8px 12px; border:1px solid var(--rh-border); border-radius:8px; background:var(--rh-surface); color:var(--rh-text); font:inherit; font-size:12px; cursor:pointer; }
  .map-unavailable { color:var(--rh-danger-text); }
  .historical-map-panel { display:grid; align-content:start; gap:16px; min-width:0; padding:17px; border:1px solid var(--rh-border); border-radius:13px; background:var(--rh-surface-soft); color:var(--rh-text); }
  .historical-map-count { display:grid; gap:5px; padding-bottom:15px; border-bottom:1px solid var(--rh-border); }
  .historical-map-count strong { font-size:20px; }
  .historical-map-count span, .historical-map-count small { font-size:12px; color:var(--rh-muted); }
  .boundary-status { margin-top:7px; }
  .detail-eyebrow { font-size:11px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:var(--rh-muted); }
  .historical-selection h3 { margin:6px 0 2px; font-size:18px; }
  .historical-selection p, .selection-prompt { margin:4px 0 0; font-size:13px; line-height:1.5; color:var(--rh-muted); }
  .historical-selection dl { display:grid; gap:10px; margin:16px 0 0; }
  .historical-selection dl div { display:grid; gap:3px; }
  .historical-selection dt { font-size:11px; color:var(--rh-muted); }
  .historical-selection dd { margin:0; font-size:13px; overflow-wrap:anywhere; }
  .case-id { font-family:ui-monospace,monospace; font-size:11px !important; }
  .historical-map-legend { display:grid; gap:9px; border-top:1px solid var(--rh-border); padding-top:16px; }
  .historical-map-legend strong { font-size:12px; }
  .historical-map-legend span { display:flex; align-items:center; gap:7px; font-size:12px; }
  .historical-map-legend i { width:10px; height:10px; border-radius:50%; }
  .historical-map-legend small { color:var(--rh-muted); line-height:1.5; }
  @media(max-width:920px) {
    .historical-map-layout { grid-template-columns:1fr; }
    .historical-map-surface { height:480px; }
  }
</style>
