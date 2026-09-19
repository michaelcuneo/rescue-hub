<script lang="ts">
	import { createTooltip, melt } from '@melt-ui/svelte';
	import { fade } from 'svelte/transition';
	import { Plus } from '@lucide/svelte';

	const {
		elements: { trigger, content, arrow },
		states: { open }
	} = createTooltip({
		positioning: {
			placement: 'top'
		},
		openDelay: 0,
		closeDelay: 0,
		closeOnPointerDown: false,
		forceVisible: true
	});
</script>

<button type="button" class="trigger" use:melt={$trigger} aria-label="Add item">
	<Plus size={16} aria-hidden="true" />
</button>

{#if $open}
	<div use:melt={$content} transition:fade={{ duration: 100 }} class="tooltip-content">
		<div use:melt={$arrow}></div>
		<p>Add item to library</p>
	</div>
{/if}

<style>
	.trigger {
		display: inline-flex;
		height: 2.25rem;
		width: 2.25rem;
		align-items: center;
		justify-content: center;
		border: 0;
		border-radius: 9999px;
		background: rgb(var(--color-white));
		color: rgb(var(--color-magnum-900));
		padding: 0;
		font: inherit;
		cursor: pointer;
		transition:
			background-color 150ms ease,
			box-shadow 150ms ease;
	}

	.trigger:hover {
		background: rgb(var(--color-magnum-50));
	}

	.trigger:focus-visible {
		outline: 2px solid rgb(var(--color-magnum-400));
		outline-offset: 2px;
	}

	.tooltip-content {
		z-index: 10;
		border-radius: 0.5rem;
		background: rgb(var(--color-white));
		box-shadow: 0 4px 12px rgb(var(--color-black) / 0.12);
	}

	.tooltip-content p {
		padding: 0.25rem 1rem;
		color: rgb(var(--color-magnum-700));
	}
</style>
