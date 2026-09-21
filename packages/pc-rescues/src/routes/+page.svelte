<script lang="ts">
	import { onMount } from 'svelte';
	import MapBox from '$lib/components/MapBox.svelte';
	import DispatcherShell from '$lib/components/DispatcherShell.svelte';
	import { data as rescueData, people } from '$lib/stores';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	onMount(() => {
		people.set(data.people ?? []);
		if (!data.rescues.length) return;

		const colourForStatus = (status: string) => {
			if (status === 'ASSIGNED') return 'ffbf00';
			if (status === 'COMPLETED') return '238823';
			return 'd2222d';
		};

		const mapped = data.rescues.map((rescue) => ({
			...rescue,
			breed: rescue.breed ?? '',
			location: rescue.location ?? '',
			injury: rescue.injury ?? '',
			assignedUserId: rescue.assignedUserId ?? undefined,
			color: colourForStatus(rescue.status),
			disabled: false
		}));

		rescueData.set({
			pending: mapped.filter((rescue) => rescue.status === 'PENDING'),
			assigned: mapped.filter((rescue) => rescue.status === 'ASSIGNED'),
			completed: mapped.filter((rescue) => rescue.status === 'COMPLETED')
		});
	});
</script>

<MapBox />
<DispatcherShell backendOnline={data.backendOnline} user={data.user} demoMode={data.demoMode} />
