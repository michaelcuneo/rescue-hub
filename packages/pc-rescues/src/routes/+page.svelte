<script lang="ts">
  import { onMount } from 'svelte';
  import MapBox from '$lib/components/MapBox.svelte';
  import DispatcherShell from '$lib/components/DispatcherShell.svelte';
  import { data as rescueData, people, selectedRescue } from '$lib/stores';
  import { subscribeRescueChanges, type RealtimeConfig } from '../../../core/realtime-client';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  type RescueRecord = PageData['rescues'][number];
  const colourForStatus = (status: string) => {
    if (status === 'ASSIGNED') return 'ffbf00';
    if (status === 'COMPLETED') return '238823';
    return 'd2222d';
  };
  function showRescues(rescues: RescueRecord[]) {
    const mapped = rescues.map(rescue => ({
      ...rescue,
      breed: rescue.breed ?? '',
      location: rescue.location ?? '',
      injury: rescue.injury ?? '',
      assignedUserId: rescue.assignedUserId ?? undefined,
      color: colourForStatus(rescue.status),
      disabled: false
    }));
    rescueData.set({
      pending: mapped.filter(rescue => rescue.status === 'PENDING'),
      assigned: mapped.filter(rescue => rescue.status === 'ASSIGNED'),
      completed: mapped.filter(rescue => rescue.status === 'COMPLETED')
    });
    selectedRescue.update(selected => selected
      ? mapped.find(rescue => rescue.id === selected.id) ?? null
      : null
    );
  }

  onMount(() => {
    people.set(data.people ?? []);
    selectedRescue.set(null);
    showRescues(data.rescues);
    let disposed = false;
    let connected = false;
    let stop: (() => void) | null = null;
    let inFlight = false;
    let pending = false;

    const reload = async () => {
      if (disposed) return;
      if (inFlight) { pending = true; return; }
      inFlight = true;
      try {
        const response = await fetch('/api/rescues/feed', { cache: 'no-store' });
        if (!response.ok) throw new Error(`Rescue snapshot HTTP ${response.status}`);
        const snapshot = await response.json() as { items: RescueRecord[] };
        if (!disposed) showRescues(snapshot.items);
      } catch (error) {
        if (!disposed) console.error('Desktop realtime rescue refresh failed:', error);
      } finally {
        inFlight = false;
        if (pending && !disposed) { pending = false; void reload(); }
      }
    };

    const start = async () => {
      try {
        const response = await fetch('/api/realtime', { cache: 'no-store' });
        if (!response.ok) throw new Error(`Realtime configuration HTTP ${response.status}`);
        const config = await response.json() as RealtimeConfig;
        if (disposed) return;
        stop = subscribeRescueChanges(config, {
          onChange: () => void reload(),
          onConnected: () => void reload(),
          onStatus: online => { connected = online; }
        });
      } catch (error) {
        console.error('Desktop realtime connection unavailable:', error);
      }
    };
    void start();
    // Safety net only while disconnected; normal updates are subscriptions.
    const fallback = setInterval(() => {
      if (!connected) void reload();
    }, 30_000);
    return () => {
      disposed = true;
      clearInterval(fallback);
      stop?.();
    };
  });
</script>

<MapBox />
<DispatcherShell backendOnline={data.backendOnline} user={data.user} demoMode={data.demoMode} membershipConfig={data.membershipConfig} />
