<script lang="ts">
	import { createAccordion, melt } from '@melt-ui/svelte';
	import { ChevronDown } from '@lucide/svelte';
	import { slide } from 'svelte/transition';
	import RescueCategories from './RescueCategories.svelte';

	const header = [
		{
			id: 'header-1',
			title: 'RESCUES'
		}
	];

	const {
		elements: { root, item, content, trigger },
		helpers: { isSelected }
	} = createAccordion();
</script>

<div class="root" use:melt={$root}>
	{#each header as { id, title }}
		<div use:melt={$item(id)} class="item">
			<h2>
				<button use:melt={$trigger(id)} class="trigger">
					{title}
					{#if isSelected}<ChevronDown size="16" />{/if}
				</button>
			</h2>
			{#if $isSelected(id)}
				<div class="content" use:melt={$content(id)} transition:slide>
					<RescueCategories />
				</div>
			{/if}
		</div>
	{/each}
</div>

<style>
	.root {
		position: fixed;
		display: flex;
		flex-direction: column;
		align-items: left;
		background: white;
		top: 10px;
		width: 320px;
		max-width: 600px;
		left: 50px;
		z-index: 999;
		border: 1px outset rgba(0, 0, 0, 0.2);
		-webkit-box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
		-moz-box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
		box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
		border-radius: 6px;
	}

	.item {
		margin-top: 1px;
		overflow: hidden;
		transition-property:
			color,
			background-color,
			border-color,
			text-decoration-color,
			fill,
			stroke,
			-webkit-text-decoration-color;
		transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
		transition-duration: 150ms;
	}

	.item:first-child {
		margin-top: 0px;
		border-radius: 0.25rem 0.25rem 0 0;
	}

	.item:last-child {
		border-radius: 0 0 0.25rem 0.25rem;
	}

	.item:focus-within {
		position: relative;
		z-index: 10;
		box-shadow: 0 0 0 3px rgb(var(--color-magnum-400) / 1);
	}

	.item > h2 {
		display: flex;
	}

	h2 {
		font-family: 'Montserrat', sans-serif;
		font-size: 11pt;
		font-weight: 700;
	}

	.trigger {
		display: flex;
		height: 3rem;
		flex: 1 1 0%;
		cursor: pointer;
		align-items: center;
		justify-content: space-between;
		background-color: rgb(var(--color-white) / 1);
		padding: 6px 10px;
		font-size: 1rem;
		font-weight: 700;
		line-height: 1;
		box-shadow: none;
		transition-property:
			color,
			background-color,
			border-color,
			text-decoration-color,
			fill,
			stroke,
			-webkit-text-decoration-color;
		transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
		transition-duration: 150ms;
		border: 0px;
	}

	.content {
		overflow: hidden;
		background-color: rgb(var(--color-neutral-100) / 1);
		font-size: 0.875rem;
		line-height: 1.25rem;
		color: rgb(var(--color-neutral-900) / 1);
	}

	.content > div {
		padding: 1rem 1.25rem;
	}

	.assigned {
		padding: 10px;
		font-family: 'Montserrat', sans-serif;
		font-size: 11pt;
		font-weight: 700;
		color: var(--main-amber);
		background-color: var(--color-white);
	}

	.pending {
		padding: 10px;
		font-family: 'Montserrat', sans-serif;
		font-size: 11pt;
		font-weight: 700;
		color: var(--main-red);
		background-color: var(--color-white);
	}

	.completed {
		padding: 10px;
		font-family: 'Montserrat', sans-serif;
		font-weight: 700;
		color: var(--main-green);
		background-color: var(--color-white);
	}
</style>
