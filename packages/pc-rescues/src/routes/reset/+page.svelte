<script lang="ts">
	import type { ActionData } from './$types';
	let { form }: { form?: ActionData } = $props();
</script>

<svelte:head><title>Reset password — Rescue Hub</title></svelte:head>
<main><section>
	<p>ACCOUNT ACCESS</p><h1>Reset password</h1>
	{#if form?.mode === 'confirm'}
		<span>Enter the code sent to {form.email} and choose a new password.</span>
		{#if form.devCode}<code>Development code: {form.devCode}</code>{/if}
		<form method="POST" action="?/confirm">
			<input type="hidden" name="email" value={form.email} />
			<label>Reset code<input name="code" maxlength="6" required /></label>
			<label>New password<input name="password" type="password" minlength="10" required /></label>
			{#if form?.error}<div class="error">{form.error}</div>{/if}
			<button type="submit">Set new password</button>
		</form>
	{:else}
		<span>We’ll send a short-lived reset code if the account exists.</span>
		<form method="POST" action="?/request">
			<label>Email<input name="email" type="email" required /></label>
			{#if form?.error}<div class="error">{form.error}</div>{/if}
			<button type="submit">Send reset code</button>
		</form>
	{/if}
</section></main>

<style>
	main{min-height:100vh;display:grid;place-items:center;padding:24px;background:#edf1ee;font-family:Inter,system-ui,sans-serif;color:#17211d}
	section{width:min(430px,100%);padding:28px;border:1px solid #d9e1dc;border-radius:16px;background:white}
	p{margin:0 0 6px;color:#648074;font-size:10px;font-weight:900;letter-spacing:.13em}h1{margin:0;font-size:27px}span,code{display:block;margin-top:8px;color:#66736c;font-size:11px}
	form{display:grid;gap:12px;margin-top:22px}label{display:grid;gap:5px;color:#66736c;font-size:9px;font-weight:800;text-transform:uppercase}input{padding:10px;border:1px solid #d4ddd7;border-radius:9px;font:inherit}button{min-height:40px;border:0;border-radius:9px;background:#173d2c;color:white;font-weight:800}.error{padding:9px;border-radius:8px;background:#fff0ed;color:#9d3c34;font-size:10px}
</style>
