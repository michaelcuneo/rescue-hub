<script lang="ts">
	import type { ActionData } from './$types';
	let { form }: { form?: ActionData } = $props();
</script>

<svelte:head><title>Set up Rescue Hub</title></svelte:head>
<main>
	<section>
		<p>FIRST RUN</p>
		<h1>Create the platform administrator</h1>
		<span>This can only be completed once for this Rescue Hub deployment.</span>
		<form method="POST">
			<label>Name<input name="name" required autocomplete="name" /></label>
			<label>Email<input name="email" type="email" required autocomplete="email" /></label>
			<label>Password<input name="password" type="password" minlength="10" required autocomplete="new-password" /></label>
			{#if form?.error}<div class="error">{form.error}</div>{/if}
			<button type="submit">Initialise Rescue Hub</button>
		</form>
	</section>
</main>

<style>
	main{min-height:100vh;display:grid;place-items:center;padding:24px;background:#edf1ee;font-family:Inter,system-ui,sans-serif;color:#17211d}
	section{width:min(430px,100%);padding:28px;border:1px solid #d9e1dc;border-radius:16px;background:white;box-shadow:0 18px 50px rgb(23 61 44/.1)}
	p{margin:0 0 6px;color:#648074;font-size:10px;font-weight:900;letter-spacing:.13em}
	h1{margin:0;font-size:27px;letter-spacing:-.04em}
	span{display:block;margin-top:8px;color:#66736c;font-size:11px;line-height:1.5}
	form{display:grid;gap:12px;margin-top:22px}
	label{display:grid;gap:5px;color:#66736c;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
	input{padding:10px 11px;border:1px solid #d4ddd7;border-radius:9px;font:inherit;font-size:11px}
	button{min-height:40px;border:0;border-radius:9px;background:#173d2c;color:white;font-weight:800;cursor:pointer}
	.error{padding:9px;border-radius:8px;background:#fff0ed;color:#9d3c34;font-size:10px}
</style>
