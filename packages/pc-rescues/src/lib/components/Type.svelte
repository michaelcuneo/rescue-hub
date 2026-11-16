<script lang="ts">
	let {
		color,
		type,
		selected = false,
		status = 'PENDING',
		onclick
	}: {
		color: string;
		type: string;
		selected?: boolean;
		status?: string;
		onclick?: () => void;
	} = $props();

	const initials = $derived(
		type
			.split(' ')
			.map((value: string) => value.substring(0, 1))
			.join('')
			.substring(0, 2)
			.toUpperCase()
	);
</script>

<button
	type="button"
	class:selected
	style:--marker-color={`#${color.replace(/^#/, '')}`}
	aria-label={`${type} rescue, ${status.toLowerCase()}`}
	{onclick}
>
	<span>{initials}</span>
	<i class="workflow-indicator" class:pending={status === 'PENDING'} class:assigned={status === 'ASSIGNED'} class:completed={status === 'COMPLETED'} aria-hidden="true"></i>
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

	.workflow-indicator {
		position: absolute;
		right: -3px;
		bottom: -3px;
		width: 13px;
		height: 13px;
		border: 2px solid white;
		border-radius: 50%;
		background: #64748b;
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.18);
	}

	.workflow-indicator.pending { background: #d92b04; }
	.workflow-indicator.assigned { background: #c18a12; }
	.workflow-indicator.completed { background: #50a971; }

	span {
		font-size: 11px;
		font-weight: 900;
		letter-spacing: -0.03em;
	}
</style>
