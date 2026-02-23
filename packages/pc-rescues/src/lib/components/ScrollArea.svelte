<script lang="ts">
	import { createScrollArea, melt } from '@melt-ui/svelte';

	let flavors = [
		'Vanilla',
		'Chocolate',
		'Strawberry',
		'Mint',
		'Pistachio',
		'Rocky Road',
		'Butter Pecan',
		'Cookies and Cream',
		'Cookie Dough',
		'Neapolitan',
		'Rainbow Sherbet'
	];

	const {
		elements: { root, content, viewport, corner, scrollbarY, thumbY, thumbX, scrollbarX }
	} = createScrollArea({
		type: 'hover',
		dir: 'ltr'
	});
</script>

<div use:melt={$root} class="root">
	<div use:melt={$viewport} class="viewport">
		<div use:melt={$content}>
			<div>
				{#each flavors as flavor (flavor)}
					<div class="item">
						{flavor}
					</div>
					<div role="separator" class="separator"></div>
				{/each}
			</div>
		</div>
	</div>
	<div use:melt={$scrollbarY} class="scrollbarY">
		<div use:melt={$thumbY} class="thumbY"></div>
	</div>
	<div use:melt={$scrollbarX} class=".scrollbarX">
		<div use:melt={$thumbX} class="thumbX"></div>
	</div>
	<div use:melt={$corner}></div>
</div>

<style>
	.root {
		overflow: hidden;
		position: relative;
		border-radius: 0.375rem;
		border-width: 1px;
		width: 100%;
		height: 18rem;
		background-color: #ffffff;
		box-shadow:
			0 10px 15px -3px rgba(0, 0, 0, 0.1),
			0 4px 6px -2px rgba(0, 0, 0, 0.05);
	}
	.viewport {
		width: 100%;
		height: 100%;
	}
	.item {
		padding: 0.5rem;
	}
	.separator {
		margin-top: 0.5rem;
		margin-bottom: 0.5rem;
		width: 100%;
		height: 1px;
	}
	.scrollbarY {
		display: flex;
		padding: 1px;
		border-left-width: 1px;
		width: 0.625rem;
		height: 100%;
		transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
		transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
		transition-duration: 300ms;
		touch-action: none;
		user-select: none;
	}
	.thumbY {
		position: relative;
		flex: 1 1 0%;
		border-radius: 9999px;
	}
	.scrollbarX {
		display: flex;
		padding: 1px;
		border-top-width: 1px;
		width: 100%;
		height: 0.625rem;
		touch-action: none;
		user-select: none;
	}
	.thumbX {
		position: relative;
		border-radius: 9999px;
	}
</style>
