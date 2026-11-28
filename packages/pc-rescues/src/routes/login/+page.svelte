<script lang="ts">
	import type { ActionData, PageData } from './$types';
	let { form, data }: { form?: ActionData; data: PageData } = $props();
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
		<div class="links"><a href="/reset">Forgot password?</a></div>
        {#if data.publicDemoEnabled}
          <div class="demo-access">
            <div class="divider"><span>OR</span></div>
            <form method="POST" action="?/demo">
              <button type="submit" class="demo-button">Explore the live demo</button>
            </form>
            <p>Explore fictional rescue cases, maps and dispatch operations. No invitation or account required. Read-only access.</p>
          </div>
        {/if}
	</section>
</main>

<style>
	main{min-height:100vh;display:grid;place-items:center;padding:24px;background:var(--rh-t184, #edf1ee);font-family:Inter,system-ui,sans-serif;color:var(--rh-t185, #17211d)}
	section{width:min(410px,100%);padding:28px;border:1px solid var(--rh-t178, #d9e1dc);border-radius:16px;background:var(--rh-t186, white);box-shadow:0 18px 50px rgb(23 61 44/.1)}
	.mark{width:44px;height:44px;display:grid;place-items:center;border-radius:12px;background:#173d2c;color:#dff15d;font-size: 15px;font-weight:900}
	p{margin:14px 0 4px;color:var(--rh-t187, #648074);font-size: 13px;font-weight:900;letter-spacing:.13em}
	h1{margin:0;font-size:28px;letter-spacing:-.04em}
	form{display:grid;gap:12px;margin-top:22px}
	label{display:grid;gap:5px;color:var(--rh-t188, #66736c);font-size: 12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
	input{padding:10px 11px;border:1px solid var(--rh-t189, #d4ddd7);border-radius:9px;font:inherit;font-size: 14px}
	button{min-height:40px;border:0;border-radius:9px;background:#173d2c;color:white;font-weight:800;cursor:pointer}
	.error{padding:9px;border-radius:8px;background:var(--rh-t190, #fff0ed);color:var(--rh-t191, #9d3c34);font-size: 13px}
	.links{display:flex;justify-content:space-between;margin-top:16px;font-size: 13px}
	a{color:var(--rh-t192, #24583f)}
    .demo-access { margin-top:20px; }
    .divider { display:flex;align-items:center;gap:10px;color:var(--rh-t188,#66736c);font-size:12px;font-weight:750; }
    .divider::before,.divider::after { content:'';height:1px;flex:1;background:var(--rh-t178,#d9e1dc); }
    .demo-access form { margin-top:16px; }
    .demo-button { background:#dff15d;color:#173d2c;border:2px solid #173d2c;min-height:48px; }
    .demo-button:hover { background:#eaf798; }
    .demo-button:focus-visible { outline:3px solid #173d2c;outline-offset:3px; }
    .demo-access p { margin-top:10px;font-size:13px;font-weight:500;line-height:1.5;letter-spacing:0;color:var(--rh-t188,#66736c); }
</style>
