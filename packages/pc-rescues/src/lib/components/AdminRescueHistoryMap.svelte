<script lang="ts">
  import {
    OPERATING_AREA_FILL_OPACITY,
    OPERATING_AREA_LINE_OPACITY,
    OPERATING_AREA_LINE_WIDTH,
    OPERATING_AREA_LABEL_PAINT
  } from '../../../../core/operating-area-visual';
  import { onMount } from 'svelte';
  import { X } from '@lucide/svelte';
  import { resolvedTheme } from '$lib/theme';
  import { currentAnimalPin } from '../../../../core/current-animal-pin';
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
  const SELECTED_RELEASE_SOURCE = 'historical-selected-release-point';
  const JOURNEY_SOURCE = 'historical-selected-gps-journey';
  const LAST_GPS_SOURCE = 'historical-last-known-animal-gps';
  const AREA_SOURCE = 'historical-operating-areas';
  // POC only: use a pinned, browser-only MapLibre module so the rest of
  // Rescue Hub and its current npm lockfile stay completely unchanged.
// No network resources: keeps accurate wildlife GPS pins interactive if the
  // OpenFreeMap basemap is unavailable, rather than showing a blank map.
  function emergencyStyle(theme: string) {
    return {
      version: 8 as const,
      sources: {},
      layers: [{ id: 'offline-background', type: 'background' as const,
        paint: { 'background-color': theme === 'dark' ? '#111820' : '#edf1f4' } }]
    };
  }
  const LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/positron';
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
  type JourneyEvent = {
    id: string; type: string; at: string; animalId: string | null;
    actorName: string | null; fromName: string | null; toName: string | null;
    destination: string | null; outcome: string | null;
  };
  type JourneyAnimal = {
    id: string; species: string; status: string;
    currentLocation: string | null; custodianName: string | null;
    physicalCustodianName: string | null; releasedAt: string | null;
    releaseLocation: string | null; releaseReason: string | null;
    releasePoint: { latitude: number; longitude: number } | null;
  };
  type Journey = {
    rescueId: string;
    assignedResponderName: string | null; pickupAt: string | null;
    pickedUpByName: string | null; pickupGpsRecorded: boolean;
    animals: JourneyAnimal[]; history: JourneyEvent[];
    gpsPoints: Array<{ id: string; animalId: string; phase: string; latitude: number; longitude: number; at: string; location: string | null }>;
  };
  let journey = $state<Journey | null>(null);
  let journeyLoading = $state(false);
  let journeyError = $state('');
  let focusedJourneyCase = $state<string | null>(null);
  let mapFocus = $state<'reported' | 'release' | 'both'>('reported');
  let focusedReleaseAnimalId = $state<string | null>(null);
  const milestoneLocations = $derived.by(() => {
    const rescue = selected;
    if (!rescue) return [] as Array<{ id: string; phase: string; label: string; latitude: number; longitude: number; at: string }>;
    const points = [{
      id: 'injury', phase: 'INJURY_LOCATION', label: rescue.location || 'Original injury location',
      latitude: rescue.latitude, longitude: rescue.longitude, at: rescue.createdAt
    }];
    if (journey?.rescueId !== rescue.id) return points;
    for (const point of journey.gpsPoints) {
      if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) ||
        Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180) continue;
      points.push({ id: point.id, phase: point.phase,
        label: point.location || point.phase.replaceAll('_', ' ').toLowerCase(),
        latitude: point.latitude, longitude: point.longitude, at: point.at });
    }
    for (const animal of journey.animals) {
      const release = animal.releasePoint;
      if (!release || points.some(point => point.phase === 'RELEASE_SITE' &&
        point.latitude === release.latitude && point.longitude === release.longitude)) continue;
      points.push({ id: 'release-' + animal.id, phase: 'RELEASE_SITE',
        label: animal.releaseLocation || 'Final release site',
        latitude: release.latitude, longitude: release.longitude,
        at: animal.releasedAt || rescue.updatedAt });
    }
    return points.sort((x, y) => x.at.localeCompare(y.at));
  });
  const statusCounts = $derived({
    pending: rescues.filter(item => item.status === 'PENDING').length,
    assigned: rescues.filter(item => item.status === 'ASSIGNED').length,
    completed: rescues.filter(item => item.status === 'COMPLETED').length
  });
  const releaseChoices = $derived.by(() => {
    if (!selected) return [] as Array<{ animalId: string; point: { latitude: number; longitude: number }; name: string }>;
    const choices: Array<{ animalId: string; point: { latitude: number; longitude: number }; name: string }> = [];
    const seen = new Set<string>();
    const add = (id: string, latitude: number, longitude: number, name: string) => {
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 ||
        Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) return;
      const key = id + ':' + latitude + ':' + longitude;
      if (seen.has(key)) return;
      seen.add(key);
      choices.push({ animalId: id, point: { latitude, longitude }, name });
    };
    for (const site of selected.releaseSites ?? []) {
      add(site.animalId, site.latitude, site.longitude, site.location || 'Wildlife release site');
    }
    if (typeof selected.historicalReleaseLatitude === 'number' &&
      typeof selected.historicalReleaseLongitude === 'number') {
      add('historical', selected.historicalReleaseLatitude, selected.historicalReleaseLongitude,
        selected.historicalReleaseLocation ?? 'Synthetic release site');
    }
    if (journey?.rescueId === selected.id) {
      for (const animal of journey.animals) if (animal.releasePoint) {
        add(animal.id, animal.releasePoint.latitude, animal.releasePoint.longitude,
          animal.releaseLocation ?? animal.species + ' release site');
      }
    }
    return choices;
  });
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
        geometry: { type: 'Point', coordinates: [currentAnimalPin(item).longitude, currentAnimalPin(item).latitude] }
      }))
    };
  }

  function selectedReleaseGeoJSON(): any {
    const featureCollection: { type: 'FeatureCollection'; features: Array<{
      type: 'Feature'; geometry: { type: 'Point'; coordinates: number[] };
      properties: { id: string; species: string }
    }> } = { type: 'FeatureCollection', features: [] };
    if (!selected || !journey || journey.rescueId !== selected.id) return featureCollection;
    for (const animal of journey.animals) {
      const point = animal.releasePoint;
      // A release destination is not the original rescue marker. It is drawn
      // only when an authorised admin has opened the corresponding case.
      if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) ||
        (point.latitude === selected.latitude && point.longitude === selected.longitude)) continue;
      featureCollection.features.push({
        type: 'Feature', properties: { id: selected.id, species: animal.species },
        geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] }
      });
    }
    return featureCollection;
  }
  function relocationGeoJSON(): any {
    // Avoid a second visible pin for a completed case: its single archive
    // marker is already projected to the latest animal/release position.
    return { type: 'FeatureCollection', features: [] };
  }
  function lastRecordedGpsGeoJSON(): any {
    // The main archive marker represents this position. Additional
    // historical checkpoint pins belong to the selected case only.
    return { type: 'FeatureCollection', features: [] };
  }
  function journeyGeoJSON(): any {
    if (!selected || journey?.rescueId !== selected.id)
      return { type: 'FeatureCollection', features: [] };
    return { type: 'FeatureCollection',
      features: milestoneLocations.filter(point => point.phase !== 'INJURY_LOCATION').map(point => ({
        type: 'Feature', properties: { id: selected.id, phase: point.phase },
        geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] }
      }))
    };
  }
  function focusMilestone(point: { latitude: number; longitude: number }) {
    const map = getMap();
    if (!mapReady || !map) return;
    map.flyTo({ center: [point.longitude, point.latitude],
      zoom: Math.max(map.getZoom?.() ?? 8, 13), duration: 450 });
  }
  function updatePins() {
    const map = getMap();
    if (!mapReady || !map?.getSource?.(SOURCE)) return;
    map.getSource(SOURCE).setData(rescueGeoJSON());
    map.getSource(RELEASE_SOURCE)?.setData(relocationGeoJSON());
    map.getSource(SELECTED_RELEASE_SOURCE)?.setData(selectedReleaseGeoJSON());
    map.getSource(JOURNEY_SOURCE)?.setData(journeyGeoJSON());
    map.getSource(LAST_GPS_SOURCE)?.setData(lastRecordedGpsGeoJSON());
  }

  function fitAll() {
    const map = getMap();
    if (!mapReady || !map || !pins.length) return;
    if (pins.length === 1) {
      const point = currentAnimalPin(pins[0]);
       map.flyTo({ center: [point.longitude, point.latitude], zoom: 11, duration: 450 });
      return;
    }
    let west = Number.POSITIVE_INFINITY;
    let east = Number.NEGATIVE_INFINITY;
    let south = Number.POSITIVE_INFINITY;
    let north = Number.NEGATIVE_INFINITY;
    for (const item of pins) {
      west = Math.min(west, currentAnimalPin(item).longitude);
      east = Math.max(east, currentAnimalPin(item).longitude);
      south = Math.min(south, currentAnimalPin(item).latitude);
      north = Math.max(north, currentAnimalPin(item).latitude);
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
    if (!map.getSource(SELECTED_RELEASE_SOURCE)) {
      map.addSource(SELECTED_RELEASE_SOURCE, { type: 'geojson', data: selectedReleaseGeoJSON() });
    }
    if (!map.getSource(JOURNEY_SOURCE)) map.addSource(JOURNEY_SOURCE, { type: 'geojson', data: journeyGeoJSON() });
    if (!map.getSource(LAST_GPS_SOURCE)) map.addSource(LAST_GPS_SOURCE, { type: 'geojson', data: lastRecordedGpsGeoJSON() });
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
        id: 'historical-selected-release', source: SELECTED_RELEASE_SOURCE, type: 'circle',
        paint: { 'circle-radius': 11, 'circle-color': '#8547a0',
          'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 }
      });
      map.addLayer({
        id: 'historical-animal-waypoints', source: JOURNEY_SOURCE, type: 'circle',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: { 'circle-radius': 5.5, 'circle-color': '#1d72ba', 'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff' }
      });
      map.addLayer({
        id: 'historical-last-known-gps', source: LAST_GPS_SOURCE, type: 'circle',
        paint: { 'circle-radius': 8, 'circle-color': '#1d72ba',
          'circle-stroke-color': '#fff', 'circle-stroke-width': 2 }
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
    map.on('click', 'historical-selected-release', selectFeature);
    map.on('click', 'historical-last-known-gps', selectFeature);
    map.on('click', 'historical-animal-waypoints', (event: any) => {
      const coords = event.features?.[0]?.geometry?.coordinates;
      if (Array.isArray(coords) && Number.isFinite(coords[0]) && Number.isFinite(coords[1]))
        focusMilestone({ longitude: coords[0], latitude: coords[1] });
    });
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
    for (const layer of ['historical-rescue-points', 'historical-rescue-status', 'historical-rescue-clusters', 'historical-relocations', 'historical-selected-release', 'historical-last-known-gps']) {
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
            'fill-opacity': OPERATING_AREA_FILL_OPACITY
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
            'line-width': OPERATING_AREA_LINE_WIDTH,
            'line-opacity': OPERATING_AREA_LINE_OPACITY
          }
        }, 'historical-rescue-clusters');
        map.addLayer({
          id: 'historical-operating-labels', source: AREA_SOURCE, type: 'symbol',
          minzoom: 7.2,
          layout: { 'text-field': ['get', 'areaLabel'], 'text-size': 10, 'text-max-width': 14 },
          // Preserve the existing light-map styling; soften labels only on dark.
          paint: $resolvedTheme === 'dark' ? OPERATING_AREA_LABEL_PAINT : {
            'text-color': '#173d2c', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5
          }
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
    let tileTimeout: ReturnType<typeof setTimeout> | undefined;
    let degraded = false;
    function fallback(map: any, theme: string) {
      if (degraded || disposed) return;
      degraded = true;
      if (tileTimeout) clearTimeout(tileTimeout);
      console.warn('Historical basemap unavailable; switching to GPS-only map.');
      map.setStyle(emergencyStyle(theme));
    }
    function watchTiles(map: any, theme: string) {
      if (tileTimeout) clearTimeout(tileTimeout);
      tileTimeout = setTimeout(() => {
        if (!mapReady && !disposed) fallback(map, theme);
      }, 12_000);
    }
    const init = async () => {
      try {
        // MapLibre 6 ships an ESM browser bundle and runs its worker from the
        // same-origin Blob URL; it does not require a Mapbox token or SDK.
        const lib = await import('maplibre-gl');
        if (disposed || !container) return;

        let activeTheme = $resolvedTheme;
        const map = new lib.Map({
          container,
          style: activeTheme === 'dark' ? DARK_STYLE : LIGHT_STYLE,
          center: [151.66, -32.95],
          zoom: 8,
          attributionControl: {}
        });
        mapInstance = map;
        map.addControl(new lib.NavigationControl(), 'top-right');
        map.addControl(new lib.ScaleControl(), 'bottom-left');

        map.on('style.load', () => {
          if (disposed) return;
          try {
            installPinLayers(map);
            mapReady = true;
            if (tileTimeout) clearTimeout(tileTimeout);
            mapError = degraded
              ? 'Basemap unavailable. Historical GPS locations remain interactive.'
              : '';
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
          // A failed basemap must not remove rescue GPS and journey markers.
          if (!mapReady && !degraded) fallback(map, activeTheme);
          else if (mapReady) console.warn('Historical map tile failed:', event.error?.name ?? 'TileError');
        });

        if (surface && typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => map.resize());
          resizeObserver.observe(surface);
        }
        map.resize();
        watchTiles(map, activeTheme);

        unsubscribeTheme = resolvedTheme.subscribe(theme => {
          if (disposed || theme === activeTheme) return;
          activeTheme = theme;
          mapReady = false;
          degraded = false;
          watchTiles(map, theme);
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
      if (tileTimeout) clearTimeout(tileTimeout);
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
  function focusLocation(mode: 'reported' | 'release' | 'both', animalId?: string) {
    mapFocus = mode;
    if (animalId) focusedReleaseAnimalId = animalId;
    const map = getMap();
    const rescue = selected;
    if (!mapReady || !map || !rescue) return;
    const release = releaseChoices.find(point => point.animalId === focusedReleaseAnimalId) ?? releaseChoices[0];
    if (mode === 'reported' || !release) {
      map.flyTo({ center: [rescue.longitude, rescue.latitude], zoom: Math.max(map.getZoom?.() ?? 8, 13), duration: 450 });
    } else if (mode === 'release') {
      map.flyTo({ center: [release.point.longitude, release.point.latitude], zoom: Math.max(map.getZoom?.() ?? 8, 13), duration: 450 });
    } else {
      const west = Math.min(rescue.longitude, release.point.longitude);
      const east = Math.max(rescue.longitude, release.point.longitude);
      const south = Math.min(rescue.latitude, release.point.latitude);
      const north = Math.max(rescue.latitude, release.point.latitude);
      if (west === east && south === north) {
        map.flyTo({ center: [rescue.longitude, rescue.latitude], zoom: 13, duration: 450 });
      } else {
        map.fitBounds([[west, south], [east, north]], { padding: 95, maxZoom: 13, duration: 450 });
      }
    }
  }
  function focusSelected() {
    const map = getMap();
    if (!mapReady || !map || !selected) return;
    focusLocation(mapFocus);
  }
  $effect(() => {
    if (!mapReady || !selected) return;
    focusSelected();
  });

  $effect(() => {
    const id = selected?.id;
    mapFocus = 'reported';
    focusedReleaseAnimalId = null;
    focusedJourneyCase = null;
    if (!id) {
      journey = null;
      journeyError = '';
      journeyLoading = false;
      return;
    }
    const controller = new AbortController();
    let fetching = false;
    journey = null;
    journeyError = '';
    journeyLoading = true;
    const refresh = async () => {
      if (fetching || controller.signal.aborted ||
        (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
      fetching = true;
      try {
        const response = await fetch(`/api/admin/rescues/${encodeURIComponent(id)}/journey`, {
          signal: controller.signal, cache: 'no-store'
        });
        const payload = await response.json() as Journey & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? 'Unable to load care journey');
        if (!controller.signal.aborted) {
          journey = payload;
          journeyError = '';
        }
      } catch (error) {
        if (!controller.signal.aborted)
          journeyError = error instanceof Error ? error.message : 'Unable to load journey';
      } finally {
        fetching = false;
        if (!controller.signal.aborted) journeyLoading = false;
      }
    };
    void refresh();
    // Lightweight selected-case refresh: GPS updates can arrive while a
    // dispatcher watches the map, but no per-animal polling runs for all pins.
    const timer = setInterval(() => void refresh(), 20_000);
    return () => { clearInterval(timer); controller.abort(); };
  });
  $effect(() => {
    journey;
    if (mapReady) updatePins();
  });
  $effect(() => {
    const rescue = selected;
    const points = journey?.gpsPoints ?? [];
    const map = getMap();
    if (!rescue || !mapReady || !map || !points.length || journey?.rescueId !== rescue.id ||
      focusedJourneyCase === rescue.id) return;
    focusedJourneyCase = rescue.id;
    const valid = points.filter(point => Number.isFinite(point.latitude) && Number.isFinite(point.longitude) &&
      Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180);
    if (!valid.length) return;
    const longitudes = [rescue.longitude, ...valid.map(point => point.longitude)];
    const latitudes = [rescue.latitude, ...valid.map(point => point.latitude)];
    const west = Math.min(...longitudes), east = Math.max(...longitudes);
    const south = Math.min(...latitudes), north = Math.max(...latitudes);
    if (west !== east || south !== north)
      map.fitBounds([[west, south], [east, north]], {
        padding: { top: 70, bottom: 85, left: 70, right: 100 }, maxZoom: 13, duration: 450
      });
  });

  function closeDetails() {
    onSelect?.(null);
  }
  function formatted(value?: string | null): string {
    if (!value) return 'Not recorded';
    const time = new Date(value);
    if (!Number.isFinite(time.getTime())) return 'Not recorded';
    return new Intl.DateTimeFormat('en-AU', {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'Australia/Sydney'
    }).format(time);
  }
</script>

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
    {#if selected}
      <section class="map-selected-card" aria-label="Selected rescue summary">
        <button type="button" class="map-card-close" aria-label="Close rescue summary"
          onclick={() => onSelect?.(null)}><X size={17} aria-hidden="true" /></button>
        <p class="map-card-kicker">Selected rescue · {selected.status.toLowerCase()}</p>
        <div class="map-card-title" style:--species-color={pinForRescue(selected).color}>
          <div><h2>{selected.type}</h2>
            <small>{selected.breed ?? 'Species details pending'}</small></div>
          <span class="map-card-status">{selected.status}</span>
        </div>
        <p class="map-card-location">{currentAnimalPin(selected).kind === 'reported' ? 'Original injury location (current position unrecorded)' : 'Latest recorded animal location'} · {currentAnimalPin(selected).label}</p>
        <p class="map-card-progress">{selected.pickedUpAt ? 'Collected · ' : 'Awaiting pickup · '}
          {journey?.assignedResponderName ?? (selected.assignedUserId ? 'Assigned responder' : 'Unassigned')}</p>
        {#if journeyLoading}<p class="map-card-progress">Loading GPS journey…</p>{/if}
        <div class="map-card-milestones" aria-label="Animal location history">
           {#each milestoneLocations as point (point.id)}
             <button class="milestone-button" type="button" onclick={() => focusMilestone(point)}>
               <strong>{point.phase.replaceAll('_', ' ')}</strong>
               <small>{point.label} · {formatted(point.at)}</small>
             </button>
           {/each}
         </div>
        {#if journeyError}<p class="map-card-progress">Detailed journey unavailable</p>{/if}
        <a class="map-card-record-link" href="/rescues/{selected.id}/care">Animal Records &amp; Phone Updates</a>
      </section>
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
      <span>Pending: {statusCounts.pending} · Assigned: {statusCounts.assigned} · Completed: {statusCounts.completed}</span>
      <span>{pins.length} plotted on the map</span>
      {#if missingCoordinates}<small>{missingCoordinates} without usable coordinates</small>{/if}
      {#if rescues.length === 0}<small>No rescues returned for the selected archive date and organisation filters.</small>{/if}
    </div>
    <div class="historical-map-legend" aria-label="Rescue pin legend">
      <strong>Rescue status</strong>
      <span><i style:background-color="#d92b04"></i>Pending</span>
      <span><i style:background-color="#c18a12"></i>Assigned</span>
      <span><i style:background-color="#50a971"></i>Completed</span>
      <span><i style:background-color="#8547a0"></i>Relocation destination</span>
      <span><i style:background-color="#1d72ba"></i>Last recorded animal location</span>
      {#if groups.length}
        <strong class="animal-legend-heading">Animal groups</strong>
        {#each groups as [key, group] (key)}
          <span><i style:background-color={group.color}></i>{group.label}</span>
        {/each}
      {/if}
      <small>Selected rescues show recorded injury, vet, care and release milestones. Checkpoints are not travel routes.</small>
    </div>

  </aside>
</div>

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
  .map-selected-card {
    position:absolute; right:16px; bottom:16px; z-index:4;
    width:min(320px,calc(100% - 32px));
    padding:16px; border:1px solid var(--rh-border); border-radius:15px;
    background:var(--rh-surface); color:var(--rh-text);
    box-shadow:0 16px 42px rgb(20 45 32 / .20);
    backdrop-filter:blur(12px);
  }
  .map-card-close { position:absolute; top:10px; right:10px; display:grid; place-items:center;
    width:30px; height:30px; border:0; border-radius:8px; background:var(--rh-surface-soft); color:var(--rh-text); cursor:pointer; }
  .map-card-kicker { font-size:11px; letter-spacing:.055em; font-weight:800;
    text-transform:uppercase; color:var(--rh-muted); margin:0 32px 8px 0; }
  .map-card-title { display:flex; justify-content:space-between; align-items:flex-start; gap:9px; }
  .map-card-title h2 { margin:0; border-left:4px solid var(--species-color); padding-left:9px; font-size:19px; }
  .map-card-title small { display:block; margin:3px 0 0 13px; font-size:12px; color:var(--rh-muted); }
  .map-card-status { font-size:10px; font-weight:900; padding:5px 7px; border-radius:20px; background:var(--rh-surface-soft); }
  .map-card-location { font-size:13px; margin:14px 0 8px; }
  .map-card-progress { font-size:12px; color:var(--rh-muted); line-height:1.5; margin:5px 0; }
  .map-card-milestones { display:grid; gap:5px; max-height:210px; overflow-y:auto; margin-top:10px; }
   .milestone-button { display:grid; gap:3px; width:100%; padding:7px 9px; text-align:left; border:1px solid var(--rh-border); border-radius:8px; background:var(--rh-surface-soft); color:var(--rh-text); cursor:pointer; font:inherit; }
   .milestone-button strong { font-size:11px; }
   .milestone-button small { font-size:11px; line-height:1.3; color:var(--rh-muted); }
   .milestone-button:focus-visible { outline:2px solid var(--rh-primary); outline-offset:2px; }
   .map-card-record-link { display:block; margin-top:15px; padding:10px; text-align:center;
    border-radius:9px; background:var(--rh-primary); color:var(--rh-on-primary);
    font-size:13px; font-weight:800; text-decoration:none; }
  .map-card-record-link:hover { background:var(--rh-primary-hover); }
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
