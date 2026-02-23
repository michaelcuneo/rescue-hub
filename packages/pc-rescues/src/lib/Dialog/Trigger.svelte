<script lang="ts">
	import { melt } from '@melt-ui/svelte';
	import { dialogRegistry, type DialogName } from '$lib/Dialog';

	export let name: DialogName;

	const {
		elements: { trigger }
	} = dialogRegistry.get(name);
</script>

<button class="btn" use:melt={$trigger}>
	<slot>
		Open {name} Dialog
	</slot>
</button>
