<script>
	import { createDropdownMenu, melt } from '@melt-ui/svelte';
	import { fly } from 'svelte/transition';
	import Avatar from './Avatar.svelte';
	import Michael from '$lib/images/michael.jpg';
	import { ChevronDown, CircleHelp, Settings, LogOut, X } from '@lucide/svelte';
	import About from './About.svelte';

	let aboutOpen = $state(false);

	const {
		elements: { trigger: dropTrigger, menu, item, separator, arrow },
		states: { open }
	} = createDropdownMenu({
		forceVisible: true,
		loop: true
	});
</script>

<div class="user" type="button" use:melt={$dropTrigger} aria-label="Update dimensions">
	<Avatar src={Michael} initials="MC" />
	<ChevronDown size="16" />
</div>

{#if $open}
	<div class="menu" use:melt={$menu} transition:fly={{ duration: 150, y: -10 }}>
		<div
			class="item"
			use:melt={$item}
			role="button"
			tabindex="0"
			onclick={() => (aboutOpen = !aboutOpen)}
		>
			About
			<span style="padding-left: 10px;"><CircleHelp size="1rem" /></span>
		</div>
		<div class="item" use:melt={$item}>
			Settings
			<span style="padding-left: 10px;"><Settings size="1rem" /></span>
		</div>
		<div class="separator" use:melt={$separator}></div>
		<div use:melt={$separator} class="separator"></div>
		<div class="item" use:melt={$item}>
			Log Out
			<span style="padding-left: 10px;"><LogOut size="1rem" /></span>
		</div>
		<div use:melt={$arrow}></div>
	</div>
{/if}

{#if aboutOpen}
	<About />
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
		width: 120px;
		justify-content: flex-end;
		border-radius: 0.125rem;
		box-shadow: 2 0 0 0 4 #000000;
		height: 1.8rem;
		font-size: 0.875rem;
		font-weight: 700;
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
</style>
