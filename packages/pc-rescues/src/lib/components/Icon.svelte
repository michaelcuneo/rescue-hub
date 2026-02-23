<script>
	let { icon } = $props();
</script>

<span class="material-icons">{icon}</span>

<style>
	span {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 32px;
		width: 32px;
	}
	span:hover {
		background: rgba(0, 0, 0, 0.1);
		border-radius: 50%;
	}
</style>
