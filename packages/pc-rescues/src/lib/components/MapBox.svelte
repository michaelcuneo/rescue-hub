<script lang="ts">
	import { onMount } from 'svelte';
	import { Map, Marker, controls } from '@beyonk/svelte-mapbox';
	import { coords, mapRef, data } from '$lib/stores';
	import Type from '$lib/components/Type.svelte';
	import Avatar from './Avatar.svelte';
	import Michael from '$lib/images/michael.jpg';

	let user: User = {
		id: '37c7eeca-748e-4c19-9e4a-15649b34e40e',
		name: 'Michael Cuneo',
		email: 'me@michaelcuneo.com.au',
		avatar: 'https://place-hold.it/40x40?text=M&fontsize=16'
	};

	let center: number[] = $state([151.771274, -32.927406]);
	let zoom: number = $state(12);

	let ref: Map = $state(undefined as unknown as Map);

	const { GeolocateControl, NavigationControl, ScaleControl } = controls;

	onMount(async () => {
		await getLocation();
		// Set initial Reference from ref.
		$mapRef = ref;
		$mapRef.flyTo({ center: [$coords[0], $coords[1]] });
	});

	const setCoords = async (position: GeolocationPosition) => {
		coords.set([position.coords.longitude, position.coords.latitude]);
	};

	const getLocation = async () => {
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(setCoords);
		} else {
			// Flag error and alert location not switched on.
			alert('Geolocation is not supported by this browser.');
		}
	};

	const eventHandler = (e: CustomEvent) => {
		const data = e.detail;
		// do something with `data`, it's the result returned from the mapbox event
	};
</script>

<Map
	bind:this={ref}
	bind:center
	bind:zoom
	accessToken=""
	style="mapbox://styles/michaelcuneo/ckzzecgy7005j14qvpzd53fgn"
	customStylesheetUrl
>
	<Marker lat={$coords[1]} lng={$coords[0]} label={user.name}>
		<Avatar src={Michael} initials="MC" />
	</Marker>
	{#each $data.pending as item}
		<Marker lat={item.long} lng={item.lat} label={item.type}>
			<Type color={item.color} type={item.type} />
		</Marker>
	{/each}
	{#each $data.assigned as item}
		<Marker lat={item.long} lng={item.lat} label={item.type}>
			<Type color={item.color} type={item.type} />
		</Marker>
	{/each}
	{#each $data.completed as item}
		<Marker lat={item.long} lng={item.lat} label={item.type}>
			<Type color={item.color} type={item.type} />
		</Marker>
	{/each}
	<NavigationControl />
	<GeolocateControl options={{ some: 'control-option' }} on:eventname={eventHandler} />
	<ScaleControl />
</Map>
