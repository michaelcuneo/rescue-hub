<script lang="ts">
	import { createSync, melt } from '@melt-ui/svelte';
	import { dialogRegistry, type DialogName } from '$lib/Dialog';
	import { page } from '$app/stores';

	export let name: DialogName;

	const {
		elements: { portalled, title, content, description, close, overlay },
		states: { open }
	} = dialogRegistry.get(name);

	const sync = createSync({ open });
	$: sync.open($page.state.dialogOpen === name, ($open) => {
		if ($page.state.dialogOpen !== name) {
			dialogRegistry.shallow(name, $open);
		}
	});
</script>

<div use:melt={$portalled}>
	<div use:melt={$overlay} class="overlay"></div>
	<div class="content" use:melt={$content}>
		<slot title={$title} description={$description} close={$close} />
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		left: 0;
		z-index: 50;
	}
	.content {
		position: fixed;
		z-index: 50;
		padding: 1.5rem;
		border-radius: 0.75rem;
		background-color: #ffffff;
		box-shadow:
			0 10px 15px -3px rgba(0, 0, 0, 0.1),
			0 4px 6px -2px rgba(0, 0, 0, 0.05);
		left: 50%;
		top: 50%;
		max-height: 85vh;
		width: 90vw;
		max-width: 450px;
	}
</style>
