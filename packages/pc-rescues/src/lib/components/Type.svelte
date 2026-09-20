<script lang="ts">
	let {
		color,
		type,
		selected = false,
		onclick
	}: {
		color: string;
		type: string;
		selected?: boolean;
		onclick?: () => void;
	} = $props();

	const initials = type
		.split(' ')
		.map((value: string) => value.substring(0, 1))
		.join('')
		.substring(0, 2)
		.toUpperCase();
</script>

<button
	type="button"
	class:selected
	style:--marker-color={`#${color}`}
	aria-label={`${type} rescue`}
	{onclick}
>
	<span>{initials}</span>
</button>

<style>
	button {
		position: relative;
		display: grid;
		place-items: center;
		width: 42px;
		height: 42px;
		padding: 0;
		border: 3px solid white;
		border-radius: 50%;
		background: var(--marker-color);
		color: white;
		box-shadow:
			0 2px 8px rgb(0 0 0 / 0.24),
			0 0 0 1px rgb(0 0 0 / 0.08);
		cursor: pointer;
		transition:
			transform 120ms ease,
			box-shadow 120ms ease;
	}

	button:hover,
	button.selected {
		transform: scale(1.12);
		box-shadow:
			0 3px 11px rgb(0 0 0 / 0.3),
			0 0 0 3px rgb(255 255 255 / 0.65);
	}

	span {
		font-size: 11px;
		font-weight: 900;
		letter-spacing: -0.03em;
	}
</style>
