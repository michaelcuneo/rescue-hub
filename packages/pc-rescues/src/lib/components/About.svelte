<script>
	import { createDialog, createSync, melt } from '@melt-ui/svelte';
	import { fly } from 'svelte/transition';
	import { X } from 'lucide-svelte';

	let open = $props();

	const {
		elements: { portalled, overlay, content, title, description, close },
		states
	} = createDialog();

	const sync = createSync(states);
	$effect(() => {
		sync.open(open, (v) => (open = v));
	});
</script>

{#if open}
	<div use:melt={$portalled}>
		<div use:melt={$overlay} class="overlay"></div>
		<div
			class="content"
			transition:fly={{
				duration: 150,
				y: 8
			}}
			use:melt={$content}
		>
			<h2 use:melt={$title} class="title">About</h2>
			<p use:melt={$description} class="description">
				NATF RESCUE HUB was designed to allow rescue organisation to report and track rescues in
				real-time easily without having to spend thousands of dollars to do so.
			</p>
			<p>
				NATF RESCUE HUB is a not-for-profit application which only uses any funding, to pay for
				itself.
			</p>
			<div class="actions">
				<button use:melt={$close} class="button"> O.K. </button>
			</div>
			<button use:melt={$close} aria-label="close" class="close">
				<X class="size-4" />
			</button>
		</div>
	</div>
{/if}

<style lang="postcss">
	.user {
		display: flex;
		position: fixed;
		top: 10px;
		right: 50px;
		align-items: center;
		background-color: #fafbfc;
		border-radius: 6px;
		border: 1px outset rgba(0, 0, 0, 0.2);
		-webkit-box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
		-moz-box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
		box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
		color: #24292e;
		cursor: pointer;
		font-family: -apple-system, system-ui, 'Segoe UI', Helvetica, Arial, sans-serif,
			'Apple Color Emoji', 'Segoe UI Emoji';
		font-size: 14px;
		font-weight: 500;
		line-height: 20px;
		list-style: none;
		padding: 6px 10px;
		user-select: none;
		-webkit-user-select: none;
		touch-action: manipulation;
		vertical-align: middle;
		white-space: nowrap;
		word-wrap: break-word;
		transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
		transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
		transition-duration: 300ms;
	}
	.menu {
		z-index: 9999;
		display: flex;
		padding: 0.25rem;
		flex-direction: column;
		border-radius: 0.375rem;
		border: 1px outset rgba(0, 0, 0, 0.2);
		-webkit-box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
		-moz-box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
		box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
		background-color: #ffffff;
		max-height: 300px;
	}
	.subMenu {
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -1px rgba(0, 0, 0, 0.06);
	}
	.item {
		display: flex;
		position: relative;
		z-index: 40;
		padding-left: 1rem;
		padding-right: 1rem;
		align-items: center;
		width: 140px;
		justify-content: space-between;
		border-radius: 0.125rem;
		box-shadow: 2 0 0 0 4 #000000;
		height: 1.8rem;
		font-size: 0.875rem;
		line-height: 1.25rem;
		user-select: none;
	}
	.item:hover {
		background-color: #f3f4f6;
	}
	.check {
		position: absolute;
		left: 0.5rem;
		top: 50%;
		translate: 0 calc(-50% + 1px);
	}
	.dot {
		border-radius: 9999px;
		height: 4.75px;
		width: 4.75px;
	}
	.separator {
		margin: 5px;
		height: 1px;
	}
	.icon {
		height: 13px;
		width: 13px;
	}
	.check {
		display: inline-flex;
		position: absolute;
		left: 0;
		align-items: center;
		width: 1.5rem;
	}
	.text {
		padding-left: 1.5rem;
		font-size: 0.75rem;
		line-height: 1rem;
		line-height: 1.5rem;
	}
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		background-color: rgb(var(--color-black) / 0.5);
	}
	.content {
		position: fixed;
		left: 50%;
		top: 50%;
		z-index: 99999;
		max-height: 85vh;
		width: 90vw;
		max-width: 450px;
		transform: translate(-50%, -50%);
		border-radius: 0.375rem;
		background-color: rgb(var(--color-white) / 1);
		padding: 1.5rem;
		box-shadow:
			0 10px 15px -3px rgb(var(--color-black) / 0.1),
			0 4px 6px -4px rgb(var(--color-black) / 0.1);
	}
	.content:focus {
		outline: 2px solid transparent;
		outline-offset: 2px;
	}
	.close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		position: absolute;
		right: 10px;
		top: 10px;
		height: 1.5rem;
		width: 1.5rem;
		border-radius: 0.75rem;
		-webkit-box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
		-moz-box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
		box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
		border: 0px solid rgb(var(--color-black) / 1);
		color: rgb(var(--color-magnum-800) / 1);
	}
	.close:hover {
		background-color: rgb(var(--color-magnum-100) / 1);
	}
	.close:focus {
		outline: 2px solid transparent;
		outline-offset: 2px;
		box-shadow: 0px 0px 0px 3px rgb(var(--color-magnum-400) / 1);
	}
	.title {
		margin: 0;
		font-size: 1.125rem;
		line-height: 1.75rem;
		font-weight: 700;
		color: rgb(var(--color-black) / 1);
	}
	.description {
		margin-bottom: 1.25rem;
		margin-top: 0.5rem;
		line-height: 1.5;
		color: rgb(var(--color-zinc-600) / 1);
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
		margin-top: 1.5rem;
	}
	.actions button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 2rem;
		border-radius: 0.25rem;
		padding: 0 1rem;
		font-weight: 500;
		line-height: 1;
	}
	.actions button.secondary {
		background-color: rgb(var(--color-zinc-100) / 1);
		color: rgb(var(--color-zinc-600) / 1);
	}
	.actions button.primary {
		background-color: rgb(var(--color-magnum-100) / 1);
		color: rgb(var(--color-magnum-900) / 1);
	}
	.button {
		appearance: none;
		background-color: #fafbfc;
		border: 1px solid rgba(27, 31, 35, 0.15);
		border-radius: 6px;
		box-shadow:
			rgba(27, 31, 35, 0.04) 0 1px 0,
			rgba(255, 255, 255, 0.25) 0 1px 0 inset;
		box-sizing: border-box;
		color: #24292e;
		cursor: pointer;
		display: inline-block;
		font-family: -apple-system, system-ui, 'Segoe UI', Helvetica, Arial, sans-serif,
			'Apple Color Emoji', 'Segoe UI Emoji';
		font-size: 14px;
		font-weight: 500;
		line-height: 20px;
		list-style: none;
		padding: 6px 16px;
		position: relative;
		transition: background-color 0.2s cubic-bezier(0.3, 0, 0.5, 1);
		user-select: none;
		-webkit-user-select: none;
		touch-action: manipulation;
		vertical-align: middle;
		white-space: nowrap;
		word-wrap: break-word;
	}
	.button:hover {
		background-color: #f3f4f6;
		text-decoration: none;
		transition-duration: 0.1s;
	}
	.button:disabled {
		background-color: #fafbfc;
		border-color: rgba(27, 31, 35, 0.15);
		color: #959da5;
		cursor: default;
	}
	.button:active {
		background-color: #edeff2;
		box-shadow: rgba(225, 228, 232, 0.2) 0 1px 0 inset;
		transition: none 0s;
	}
	.button:focus {
		outline: 1px transparent;
	}
	.button:before {
		display: none;
	}
	.button:-webkit-details-marker {
		display: none;
	}
</style>
