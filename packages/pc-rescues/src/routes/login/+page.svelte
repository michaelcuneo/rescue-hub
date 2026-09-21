<script lang="ts">
	import type { ActionData } from './$types';
	let { form }: { form?: ActionData } = $props();
</script>

<svelte:head><title>Sign in — Rescue Hub</title></svelte:head>
<main>
	<section>
		<div class="mark">RH</div>
		<p>RESCUE HUB</p>
		<h1>Sign in</h1>
		<form method="POST">
			<label>Email<input name="email" type="email" value={form?.email ?? ''} required autocomplete="email" /></label>
			<label>Password<input name="password" type="password" required autocomplete="current-password" /></label>
			{#if form?.error}<div class="error">{form.error}</div>{/if}
			<button type="submit">Sign in</button>
		</form>
		<div class="links"><a href="/activate">Activate invitation</a><a href="/reset">Forgot password?</a></div>
	</section>
</main>

<style>
	main{min-height:100vh;display:grid;place-items:center;padding:24px;background:#edf1ee;font-family:Inter,system-ui,sans-serif;color:#17211d}
	section{width:min(410px,100%);padding:28px;border:1px solid #d9e1dc;border-radius:16px;background:white;box-shadow:0 18px 50px rgb(23 61 44/.1)}
	.mark{width:44px;height:44px;display:grid;place-items:center;border-radius:12px;background:#173d2c;color:#dff15d;font-size:12px;font-weight:900}
	p{margin:14px 0 4px;color:#648074;font-size:10px;font-weight:900;letter-spacing:.13em}
	h1{margin:0;font-size:28px;letter-spacing:-.04em}
	form{display:grid;gap:12px;margin-top:22px}
	label{display:grid;gap:5px;color:#66736c;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
	input{padding:10px 11px;border:1px solid #d4ddd7;border-radius:9px;font:inherit;font-size:11px}
	button{min-height:40px;border:0;border-radius:9px;background:#173d2c;color:white;font-weight:800;cursor:pointer}
	.error{padding:9px;border-radius:8px;background:#fff0ed;color:#9d3c34;font-size:10px}
	.links{display:flex;justify-content:space-between;margin-top:16px;font-size:10px}
	a{color:#24583f}
</style>
