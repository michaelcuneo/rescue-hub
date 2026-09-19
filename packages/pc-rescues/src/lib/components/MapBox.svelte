<script lang="ts">
	import { onMount } from 'svelte';
	import { PUBLIC_MAPBOX_ACCESS_TOKEN } from '$env/static/public';
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

	onMount(() => {
		if (!PUBLIC_MAPBOX_ACCESS_TOKEN) {
			console.warn(
				'PUBLIC_MAPBOX_ACCESS_TOKEN is not configured. Copy .env.example to .env.local and add a public Mapbox token.'
			);
		}

		void getLocation();
		$mapRef = ref;
	});

	const setCoords = (position: GeolocationPosition) => {
		const nextCoords = [position.coords.longitude, position.coords.latitude];
		coords.set(nextCoords);
		ref?.flyTo({ center: nextCoords });
	};

	const getLocation = async () => {
		if (!navigator.geolocation) {
			console.warn('Geolocation is not supported by this browser.');
			return;
		}

		navigator.geolocation.getCurrentPosition(setCoords, (error) => {
			console.warn('Unable to determine the current location.', error);
		});
	};
</script>

<Map
	bind:this={ref}
	bind:center
	bind:zoom
	accessToken={PUBLIC_MAPBOX_ACCESS_TOKEN}
	style="mapbox://styles/michaelcuneo/ckzzecgy7005j14qvpzd53fgn"
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
	<GeolocateControl />
	<ScaleControl />
</Map>
