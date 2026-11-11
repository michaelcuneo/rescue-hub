<script lang="ts">
  import {
    addressPrecisionLabel, formatRescueCoordinates, locationFallback,
    rescueDirectionsUrl, type AddressPrecision
  } from '../../../../core/rescue-location';

  let { id, latitude, longitude, fallback = null, compact = false, directions = false }:
    { id: string; latitude: number; longitude: number; fallback?: string | null;
      compact?: boolean; directions?: boolean } = $props();

  type Lookup = {
    address: string | null; precision: AddressPrecision;
    location: string; coordinates: string; directionsUrl: string | null;
  };
  const resolved = new Map<string, Lookup>();
  const inflight = new Map<string, Promise<Lookup | null>>();
  let address = $state<Lookup | null>(null);
  let loading = $state(true);
  const key = $derived(`${id}:${latitude}:${longitude}`);
  const link = $derived(rescueDirectionsUrl({ latitude, longitude }));
  const gps = $derived(formatRescueCoordinates({ latitude, longitude }));

  async function lookup(id: string, key: string): Promise<Lookup | null> {
    if (resolved.has(key)) return resolved.get(key)!;
    if (inflight.has(key)) return inflight.get(key)!;
    const request = fetch(`/api/mobile/rescues/${encodeURIComponent(id)}/address`, {
      cache: 'no-store'
    }).then(async response => {
      if (!response.ok) return null;
      const result = await response.json() as Lookup;
      resolved.set(key, result);
      return result;
    }).catch(() => null).finally(() => inflight.delete(key));
    inflight.set(key, request);
    return request;
  }

  $effect(() => {
    let disposed = false;
    const lookupKey = key, lookupId = id;
    address = resolved.get(lookupKey) ?? null;
    loading = !address;
    void lookup(lookupId, lookupKey).then(result => {
      if (disposed) return;
      address = result;
      loading = false;
    });
    return () => { disposed = true; };
  });
</script>

<span class="rescue-address" class:compact>
  <span class="address-text">
    {#if address?.address}{address.address}{:else}{locationFallback(fallback)}{/if}
  </span>
  {#if !compact}
    <small>{address?.address ? addressPrecisionLabel(address.precision) :
      loading ? 'Looking up nearest mapped address…' :
      'No reliable mapped address — follow the GPS pin'}</small>
    <small class="coordinates">GPS {gps}</small>
    {#if directions && link}
      <a class="directions" href={link} target="_blank" rel="noopener noreferrer"
        aria-label="Directions to exact rescue GPS location">Directions</a>
    {/if}
  {/if}
</span>

<style>
  .rescue-address { display: grid; gap: 5px; min-width: 0; color: var(--rh-text); }
  .address-text { overflow-wrap: anywhere; font: inherit; }
  small { font-size: 11px; line-height: 1.45; color: var(--rh-muted); }
  .compact .address-text { font-size: inherit; }
  .directions { width: fit-content; display: inline-flex; justify-content: center; align-items: center;
    padding: 9px 13px; min-height: 35px; border-radius: 8px;
    background: var(--rh-primary); color: var(--rh-on-primary);
    font-weight: 800; text-decoration: none; text-transform: uppercase; font-size: 12px; }
  .directions:hover { background: var(--rh-primary-hover); }
</style>
