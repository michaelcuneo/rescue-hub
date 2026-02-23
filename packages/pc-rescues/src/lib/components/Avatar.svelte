<script lang="ts">
	import { melt } from '@melt-ui/svelte';
	import { createAvatar } from '@melt-ui/svelte';

	export let src;
	export let initials = 'MC';

	export const {
		elements: { image, fallback }
	} = createAvatar({ src });
</script>

<div class="root">
	<div class="item">
		<img use:melt={$image} alt="Avatar" class="avatar" />
		<span use:melt={$fallback} class="fallback">{initials}</span>
	</div>
</div>

<style>
	.root {
		display: flex;
		padding: 0 0.5rem 0 0;
	}

	.item {
		display: flex;
		height: 32px;
		width: 32px;
		border-radius: 16px;
	}

	.item > .avatar {
		height: 100%;
		width: 100%;
		border-radius: inherit;
	}

	.item > .fallback {
		font-size: 1.675rem;
		line-height: 1.675rem;
		font-weight: 500;
	}
</style>
