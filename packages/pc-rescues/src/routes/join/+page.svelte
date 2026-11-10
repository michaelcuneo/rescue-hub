<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  let name = $state('');
  let email = $state('');
  let password = $state('');
  let code = $state('');
  let stage = $state<'signup' | 'verify'>('signup');
  let submitting = $state(false);
  let error = $state('');
  let notice = $state('');

  async function send(path: string, payload: unknown) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json() as { ok?: boolean; error?: string };
    if (!response.ok || !data.ok) throw new Error(data.error ?? 'Could not complete request.');
  }

  async function register(event: SubmitEvent) {
    event.preventDefault();
    submitting = true; error = '';
    try {
      await send('/api/public/signup', { name, email, password });
      stage = 'verify';
      password = '';
      notice = 'Enter the six-digit code sent to your email address.';
    } catch (e) { error = e instanceof Error ? e.message : 'Registration failed.'; }
    finally { submitting = false; }
  }
  async function verify(event: SubmitEvent) {
    event.preventDefault();
    submitting = true; error = '';
    try {
      await send('/api/public/verify', { email, code });
      await goto('/report', { invalidateAll: true });
    } catch (e) { error = e instanceof Error ? e.message : 'Verification failed.'; }
    finally { submitting = false; }
  }
</script>

<svelte:head><title>Report wildlife — Create account — Rescue Hub</title></svelte:head>
<main>
  <section>
    <a class="brand" href="/login">RESCUE HUB</a>
    <h1>Help injured wildlife</h1>
    <p>Anyone can report an injured animal. No organisation, rescue experience or qualifications are required.</p>
    {#if stage === 'signup'}
      <form onsubmit={register}>
        <label for="full-name">Your name</label>
        <input id="full-name" bind:value={name} autocomplete="name" maxlength="100" required />
        <label for="email">Email address</label>
        <input id="email" type="email" bind:value={email} autocomplete="email" required />
        <label for="password">Password</label>
        <input id="password" type="password" bind:value={password} autocomplete="new-password" minlength="10" required />
        <small>At least 10 characters.</small>
        <button disabled={submitting}>{submitting ? 'Creating account…' : 'Create reporter account'}</button>
      </form>
    {:else}
      <p role="status">{notice}</p>
      <form onsubmit={verify}>
        <label for="verification-code">Email verification code</label>
        <input id="verification-code" bind:value={code} inputmode="numeric" pattern="[0-9]{6}"
          autocomplete="one-time-code" maxlength="6" required />
        <button disabled={submitting}>{submitting ? 'Verifying…' : 'Verify and start reporting'}</button>
      </form>
    {/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <div class="signin">Already have an account? <a href="/login?next=/report">Sign in</a></div>
    {#if page.url.searchParams.get('social_error')}
      <p class="error" role="alert">Social sign-in could not be completed. Please try again or use email.</p>
    {/if}
    {#if data.providers.length}
      <div class="providers">
        <p>Or continue with</p>
        {#each data.providers as provider}
          <a href="/auth/social/{provider}">{provider === 'google' ? 'Google' : provider === 'apple' ? 'Apple' : 'Facebook'}</a>
        {/each}
      </div>
    {/if}
    <p class="safety">Your reporter account lets you submit sightings, not claim or handle animals.</p>
  </section>
</main>
<style>
  main{min-height:100dvh;display:grid;place-items:center;padding:24px;background:#edf1ee;font-family:Inter,system-ui,sans-serif;color:#17211d}
  section{width:min(450px,100%);padding:30px;background:white;border:1px solid #d9e1dc;border-radius:18px;box-shadow:0 16px 60px #173d2c12}
  .brand{font-size:13px;letter-spacing:.15em;font-weight:900;color:#173d2c;text-decoration:none}
  h1{font-size:29px;letter-spacing:-.04em;margin:16px 0 6px}p{color:#5b7163;line-height:1.5}
  form{margin-top:20px;display:grid;gap:9px}
  label{font-size:13px;font-weight:800;color:#294533}
  input{box-sizing:border-box;width:100%;min-height:45px;border:1px solid #c9d8ce;border-radius:9px;padding:10px;font:inherit}
  button{background:#173d2c;color:white;min-height:46px;border:0;border-radius:10px;font:inherit;font-weight:800;margin-top:10px}
  button:disabled{opacity:.6}small{color:#66736c}
  .signin{margin-top:22px;color:#4d6454;font-size:14px}
  a{color:#24583f}.error{color:#a23f35;font-weight:700}
  .providers{border-top:1px solid #e6eee8;margin-top:22px;padding-top:12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
  .providers p{width:100%;font-size:12px;margin:2px 0}
  .providers a{padding:9px 15px;background:#f3f6f3;border:1px solid #cfddd2;border-radius:9px;text-decoration:none;font-weight:800;font-size:13px}
  .safety{font-size:12px}
</style>
