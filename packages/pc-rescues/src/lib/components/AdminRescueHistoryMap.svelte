<script lang="ts">
  import { env } from '$env/dynamic/public';
  import { Map, Marker, controls } from '@beyonk/svelte-mapbox';
  import { resolvedTheme } from '$lib/theme';
  import Type from '$lib/components/Type.svelte';
  import { pinForRescue, RESCUE_PIN_GROUPS } from '../../../../core/rescue-pin-groups';
  import type { Rescue } from '$lib/server/graphql';

  let { rescues, selectedId = null, onSelect }: {
    rescues: Rescue[];
    selectedId?: string | null;
    onSelect?: (id: string) => void;
  } = $props();

  let mapRef: any = $state(undefined);
  let ready = $state(false);
  let center: [number, number] = $state([147.8, -32.2]);
  let zoom = $state(5.5);
  const accessToken = env.PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';
  const { NavigationControl, ScaleControl } = controls;
  const validPins = $derived(rescues.filter(rescue =>
    Number.isFinite(rescue.latitude) && Number.isFinite(rescue.longitude)
    && rescue.latitude >= -90 && rescue.latitude <= 90
    && rescue.longitude >= -180 && rescue.longitude <= 180
  ));
  const excludedCount = $derived(rescues.length - validPins.length);
  const selected = $derived(validPins.find(rescue => rescue.id === selectedId) ?? null);
  const groups = $derived(Object.entries(RESCUE_PIN_GROUPS).filter(([key]) =>
    validPins.some(rescue => pinForRescue(rescue).group === key)
  ));

  function fitAll() {
    const map = mapRef?.getMap?.();
    if (!map || !ready || !validPins.length) return;
    if (validPins.length === 1) {
      map.flyTo({ center: [validPins[0].longitude, validPins[0].latitude], zoom: 11, duration: 500 });
      return;
    }
    const west = Math.min(...validPins.map(item => item.longitude));
    const east = Math.max(...validPins.map(item => item.longitude));
    const south = Math.min(...validPins.map(item => item.latitude));
    const north = Math.max(...validPins.map(item => item.latitude));
    map.fitBounds([[west, south], [east, north]], {
      padding: 72, maxZoom: 12, duration: 500
    });
  }
  function handleReady() {
    ready = true;
    fitAll();
  }
  $effect(() => {
    validPins;
    if (ready) fitAll();
  });
  function selectPin(id: string) {
    onSelect?.(id);
    const item = validPins.find(rescue => rescue.id === id);
    if (item) mapRef?.getMap?.()?.flyTo?.({
      center: [item.longitude, item.latitude],
      zoom: Math.max(mapRef?.getMap?.()?.getZoom?.() ?? 8, 10),
      duration: 450
    });
  }
  function formatted(value?: string | null): string {
    if (!value) return 'Not recorded';
    return new Intl.DateTimeFormat('en-AU', {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'Australia/Sydney'
    }).format(new Date(value));
  }
</script>

<div class="historical-map-layout">
  <div class="historical-map-surface">
    {#if !accessToken}
      <p class="map-unavailable" role="alert">Mapbox access token is not configured.</p>
    {:else}
      {#key $resolvedTheme}
        <Map
          bind:this={mapRef}
          bind:center
          bind:zoom
          accessToken={accessToken}
          style={$resolvedTheme === 'dark'
            ? 'mapbox://styles/mapbox/dark-v11'
            : 'mapbox://styles/michaelcuneo/ckzzecgy7005j14qvpzd53fgn'}
          onready={handleReady}
        >
          {#each validPins as rescue (rescue.id)}
            <Marker lat={rescue.latitude} lng={rescue.longitude} label={rescue.type}>
              <Type color={pinForRescue(rescue).color} type={rescue.type}
                status={rescue.status}
                selected={rescue.id === selectedId}
                onclick={() => selectPin(rescue.id)} />
            </Marker>
          {/each}
          <NavigationControl />
          <ScaleControl />
        </Map>
      {/key}
    {/if}
    {#if validPins.length > 0}
      <button type="button" class="fit-pins" onclick={fitAll}>Show all pins</button>
    {/if}
  </div>
  <aside class="historical-map-panel" aria-label="Historical rescue map details">
    <div class="historical-map-count">
      <strong>{rescues.length} rescue{rescues.length === 1 ? '' : 's'}</strong>
      <span>{validPins.length} plotted on the map</span>
      {#if excludedCount}<small>{excludedCount} without usable coordinates</small>{/if}
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
          <div><dt>Case ID</dt><dd class="case-id">{selected.id}</dd></div>
        </dl>
      </div>
    {:else}
      <p class="selection-prompt">Select a rescue pin to inspect its report and current recorded status.</p>
    {/if}
    {#if groups.length}
      <div class="historical-map-legend">
        <strong>Animal groups</strong>
        {#each groups as [key, group] (key)}
          <span><i style:background-color={group.color}></i>{group.label}</span>
        {/each}
        <small>Marker colour represents the animal group. The smaller status dot indicates Pending, Assigned or Completed.</small>
      </div>
    {/if}
  </aside>
</div>

<style>
  .historical-map-layout { display:grid; grid-template-columns:minmax(0,1fr) minmax(230px,290px); gap:14px; min-height:580px; margin-top:18px; }
  .historical-map-surface { position:relative; min-width:0; height:620px; min-height:480px; overflow:hidden; border:1px solid var(--rh-border); border-radius:13px; background:var(--rh-map-background); }
  .historical-map-surface :global(.mapboxgl-map) { height:100% !important; width:100% !important; }
  .fit-pins { position:absolute; z-index:2; left:12px; top:12px; padding:8px 12px; border:1px solid var(--rh-border); border-radius:8px; background:var(--rh-surface); color:var(--rh-text); font:inherit; font-size:12px; cursor:pointer; }
  .map-unavailable { margin:20px; color:var(--rh-danger-text); }
  .historical-map-panel { display:grid; align-content:start; gap:16px; min-width:0; padding:17px; border:1px solid var(--rh-border); border-radius:13px; background:var(--rh-surface-soft); color:var(--rh-text); }
  .historical-map-count { display:grid; gap:5px; padding-bottom:15px; border-bottom:1px solid var(--rh-border); }
  .historical-map-count strong { font-size:20px; }
  .historical-map-count span, .historical-map-count small { font-size:12px; color:var(--rh-muted); }
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
