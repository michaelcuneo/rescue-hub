<script lang="ts">
	let { color, type } = $props();
</script>

<div
	style="background-image: url(https://place-hold.it/40x40/{color}?text={type
		.split(' ')
		.map((val: string) => val.substring(0, 1))
		.join('')}&fontsize=16);"
></div>

<style>
	div {
		position: relative;
		display: block;
		width: 50px;
		height: 50px;
		border-radius: 25px;
		background-size: contain;
		background-repeat: no-repeat;
	}
</style>
