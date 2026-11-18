<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { X } from '@lucide/svelte';
  import { resolvedTheme } from '$lib/theme';
  import { pinForRescue, RESCUE_PIN_GROUPS } from '../../../../core/rescue-pin-groups';
  import type { Rescue } from '$lib/server/graphql';

  let { rescues, selectedId = null, focusedRescue = null, onSelect }: {
    rescues: Rescue[];
    selectedId?: string | null;
    focusedRescue?: Rescue | null;
    onSelect?: (id: string | null) => void;
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
  let detailsDialog: HTMLDialogElement | undefined;
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

  function closeDetails() {
    onSelect?.(null);
  }
  function handleBackdropPointer(event: PointerEvent) {
    const dialog = event.currentTarget as HTMLDialogElement;
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  }
  // Works when View Pin selects a rescue before the archive request finishes.
  // Native showModal provides focus management, Escape and a true backdrop.
  $effect(() => {
    const record = selected;
    if (!record) return;
    void tick().then(() => {
      if (selectedId === record.id && detailsDialog?.isConnected && !detailsDialog.open) detailsDialog.showModal();
    });
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
      <div class="area-panel-heading">
        <span class="area-dot" aria-hidden="true"></span>
        <div>
          <strong>NSW operating areas</strong>
          <small>DCCEEW boundary data</small>
        </div>
      </div>
      <span class="boundary-status" role="status">
        {#if boundaryStatus === 'loading'}Loading official boundaries…
        {:else if boundaryStatus === 'error'}Operating-area boundaries unavailable
        {:else}{areaCount} mapped boundary features loaded{boundaryStatus === 'partial' ? ' (partial)' : ''}{/if}
      </span>
      <div class="boundary-legend" aria-label="Operating area colours">
        <span><i class="area-swatch hunter"></i>Hunter Wildlife Rescue</span>
        <span><i class="area-swatch wires"></i>WIRES branches</span>
        <span><i class="area-swatch other"></i>Other rehabilitation groups</span>
      </div>
    </div>
    <div class="map-pin-summary">
      <strong>{rescues.length} rescue{rescues.length === 1 ? '' : 's'} loaded</strong>
      <span>{pins.length} plotted on the map</span>
      {#if missingCoordinates}<small>{missingCoordinates} without usable coordinates</small>{/if}
    </div>
    <div class="historical-map-legend" aria-label="Rescue pin legend">
      <strong>Rescue status</strong>
      <span><i style:background-color="#d92b04"></i>Pending</span>
      <span><i style:background-color="#c18a12"></i>Assigned</span>
      <span><i style:background-color="#50a971"></i>Completed</span>
      <span><i style:background-color="#8547a0"></i>Relocation destination</span>
      {#if groups.length}
        <strong class="animal-legend-heading">Animal groups</strong>
        {#each groups as [key, group] (key)}
          <span><i style:background-color={group.color}></i>{group.label}</span>
        {/each}
      {/if}
      <small>The smaller dot shows rescue status. Purple marks a synthetic relocation destination.</small>
    </div>

  </aside>
</div>

{#if selected}
  <dialog class="rescue-detail-modal" bind:this={detailsDialog}
    aria-labelledby="historical-rescue-modal-title"
    onclose={closeDetails}
    onpointerdown={handleBackdropPointer}>
    <div class="modal-body">
      <button type="button" class="modal-close" aria-label="Close rescue details" onclick={() => detailsDialog?.close()}>
        <X size={19} aria-hidden="true" />
      </button>
      <h2 id="historical-rescue-modal-title" class="sr-only">Historical rescue details</h2>
      <section class="historical-selection" aria-label="Selected historical rescue details">
        <span class="detail-eyebrow">Selected rescue · Historical record</span>
        <h3 style:--species-color={pinForRescue(selected).color}>{selected.type}</h3>
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
      </section>
      <div class="modal-actions">
        <button type="button" onclick={() => detailsDialog?.close()}>Close details</button>
      </div>
    </div>
  </dialog>
{/if}

<style>
  .historical-map-layout {
    display:grid;
    grid-template-columns:minmax(0,1fr) clamp(240px,23%,290px);
    gap:var(--rh-gutter,16px);
    width:100%;
    height:100%;
    min-width:0;
    min-height:0;
    container-type:inline-size;
  }
  .historical-map-surface {
    position:relative;
    min-width:0;
    min-height:460px;
    height:100%;
    overflow:hidden;
    border:1px solid var(--rh-border);
    border-radius:16px;
    background:var(--rh-map-background);
    box-shadow:var(--rh-shadow);
  }
  .maplibre-container { position:absolute; inset:0; width:100%; height:100%; }
  .maplibre-container :global(.maplibregl-map) { height:100%; width:100%; }
  .map-loading, .map-unavailable { position:absolute; z-index:3; left:14px; top:14px; max-width:calc(100% - 28px); margin:0; padding:10px 12px; border:1px solid var(--rh-border); border-radius:9px; background:var(--rh-surface); color:var(--rh-text); font-size:12px; box-shadow:var(--rh-shadow); }
  .fit-pins { position:absolute; z-index:2; left:12px; top:12px; padding:8px 12px; border:1px solid var(--rh-border); border-radius:8px; background:var(--rh-surface); color:var(--rh-text); font:inherit; font-size:12px; cursor:pointer; }
  .map-unavailable { color:var(--rh-danger-text); }
  .historical-map-panel {
    display:flex;
    flex-direction:column;
    gap:16px;
    min-width:0;
    min-height:0;
    height:100%;
    overflow-y:auto;
    padding:16px;
    border:1px solid var(--rh-border);
    border-radius:16px;
    background:var(--rh-surface);
    box-shadow:var(--rh-shadow);
    color:var(--rh-text);
  }
  .historical-map-count, .map-pin-summary { display:grid; gap:8px; padding-bottom:15px; border-bottom:1px solid var(--rh-border); }
  .area-panel-heading { display:flex; align-items:center; gap:9px; }
  .area-panel-heading > div { display:grid; gap:3px; }
  .area-panel-heading strong { font-size:13px; }
  .area-panel-heading small { font-size:11px; color:var(--rh-muted); }
  .area-dot { width:9px; height:9px; flex:0 0 9px; border-radius:50%; background:#50a971; box-shadow:0 0 0 4px rgb(80 169 113 / 13%); }
  .historical-map-count span, .historical-map-count small, .map-pin-summary span, .map-pin-summary small { font-size:12px; color:var(--rh-muted); }
  .map-pin-summary strong { font-size:18px; }
  .boundary-status { margin-top:2px; line-height:1.5; }
  .boundary-legend { display:grid; gap:8px; padding-top:10px; border-top:1px solid var(--rh-border); }
  .boundary-legend span { display:flex; align-items:center; gap:8px; font-size:11px; color:var(--rh-muted); }
  .area-swatch { width:18px; height:9px; flex:0 0 18px; border-radius:2px; border:1px solid; }
  .area-swatch.hunter { border-color:#8a6200; background:rgb(242 183 5 / 35%); }
  .area-swatch.wires { border-color:#31597f; background:rgb(81 125 168 / 25%); }
  .area-swatch.other { border-color:#2d7148; background:rgb(80 169 113 / 24%); }
  .rescue-detail-modal {
    width:min(480px,calc(100vw - 24px));
    max-width:100%;
    max-height:min(85dvh,760px);
    margin:auto;
    padding:0;
    overflow-y:auto;
    border:1px solid var(--rh-border);
    border-radius:16px;
    color:var(--rh-text);
    background:var(--rh-surface);
    box-shadow:0 22px 70px rgba(0,0,0,.3);
  }
  .rescue-detail-modal::backdrop { background:rgba(9,21,17,.6); }
  .modal-body { position:relative; padding:22px; }
  .modal-close {
    position:absolute; top:12px; right:12px;
    display:grid; place-items:center;
    width:36px; height:36px;
    border:1px solid var(--rh-border); border-radius:9px;
    background:var(--rh-surface-soft); color:var(--rh-text);
    cursor:pointer;
  }
  .modal-close:hover, .modal-actions button:hover { background:var(--rh-raised); }
  .historical-selection { padding-right:12px; }
  .detail-eyebrow { font-size:11px; font-weight:800; letter-spacing:.07em; text-transform:uppercase; color:var(--rh-muted); }
  .historical-selection h3 {
    margin:10px 0 4px; padding-left:12px; border-left:4px solid var(--species-color);
    font-size:21px; line-height:1.3;
  }
  .historical-selection p { margin:4px 0 0; font-size:13px; line-height:1.5; color:var(--rh-muted); }
  .sr-only {
    position:absolute; width:1px; height:1px; overflow:hidden;
    clip:rect(0,0,0,0); white-space:nowrap;
  }
  .modal-actions { display:flex; justify-content:flex-end; margin-top:20px; }
  .modal-actions button {
    min-height:40px; padding:8px 16px;
    border:1px solid var(--rh-border); border-radius:9px;
    background:var(--rh-surface-soft); color:var(--rh-text);
    font:inherit; font-size:13px; font-weight:700; cursor:pointer;
  }
  .historical-selection dl { display:grid; gap:10px; margin:16px 0 0; }
  .historical-selection dl div { display:grid; gap:3px; }
  .historical-selection dt { font-size:11px; color:var(--rh-muted); }
  .historical-selection dd { margin:0; font-size:13px; overflow-wrap:anywhere; }
  .case-id { font-family:ui-monospace,monospace; font-size:11px !important; }
  .historical-map-legend { display:grid; gap:9px; padding-bottom:16px; border-bottom:1px solid var(--rh-border); }
  .historical-map-legend strong { font-size:12px; }
  .historical-map-legend .animal-legend-heading { margin-top:8px; padding-top:14px; border-top:1px solid var(--rh-border); }
  .historical-map-legend span { display:flex; align-items:center; gap:7px; font-size:12px; color:var(--rh-muted); }
  .historical-map-legend i { width:10px; height:10px; flex:0 0 10px; border-radius:50%; border:1px solid rgb(255 255 255 / 75%); }
  .historical-map-legend small { color:var(--rh-muted); line-height:1.5; }
  @container (max-width:720px) {
    .historical-map-layout { grid-template-columns:1fr; height:auto; }
    .historical-map-surface { height:clamp(360px,58vh,560px); min-height:360px; }
    .historical-map-panel { height:auto; max-height:none; overflow:visible; }
  }
  @media(max-width:780px) {
    .historical-map-layout { grid-template-columns:1fr; height:auto; }
    .historical-map-surface { height:clamp(360px,58vh,560px); }
    .historical-map-panel { height:auto; overflow:visible; }
  }
</style>
