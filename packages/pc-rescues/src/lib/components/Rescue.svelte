<script lang="ts">
	import { createScrollArea, melt } from '@melt-ui/svelte';
	import { coords, mapRef } from '$lib/stores';

	let { data } = $props();
	let selection = $state('');
	// This value is updated when the component is initialized, based on the
	// selected Item's `selected` prop.
	let selectionIndex: Number = $state(0);
</script>

<!--
<List class="demo-list" twoLine avatarList singleSelection bind:selectedIndex={selectionIndex}>
	{#each data as item}
		<Item
			on:SMUI:action={() => {
				selection = item.id;
				coords.set([item.longitude, item.latitude]);
				$mapRef.flyTo({ center: [item.longitude, item.latitude] });
			}}
			disabled={item.disabled}
			selected={selection === item.id}
		>
			<Graphic
				style="background-image: url(https://place-hold.it/40x40?text={item.type
					.split(' ')
					.map((val) => val.substring(0, 1))
					.join('')}&fontsize=16);"
			/>
			<Text>
				<PrimaryText>{item.type} {item.breed}</PrimaryText>
				<SecondaryText>{item.injury} {item.location}</SecondaryText>
			</Text>
			<Meta class="material-icons">info</Meta>
		</Item>
	{/each}
</List>
-->
