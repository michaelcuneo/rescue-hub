<script>
	import MapBox from '$lib/components/MapBox.svelte';
	import Header from '$lib/components/Header.svelte';
	import User from '$lib/components/User.svelte';
	import Rescues from '$lib/components/Rescues.svelte';
	import Footer from '$lib/components/Footer.svelte';
</script>

<MapBox />
<Header />
<User />
<Rescues />
<Footer />

<!--
<Dialog.Trigger name="settings">
	<button class="btn">Open Settings Dialog</button>
</Dialog.Trigger>

<Dialog.Content name="settings" let:title let:description let:close>
	<h2 class="font-bold" use:melt={title}>Settings</h2>
	<p use:melt={description}>Placeholder description</p>

	<div class="flex">
		<button class="btn mt-4 ml-auto" use:melt={close}> Close </button>
	</div>
</Dialog.Content>
-->
