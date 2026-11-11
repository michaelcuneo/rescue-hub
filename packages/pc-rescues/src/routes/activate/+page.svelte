<script lang="ts">
  import type { ActionData, PageData } from './$types';
  let { data, form }: { data: PageData; form?: ActionData } = $props();
  let visible = $state(false);
</script>

<svelte:head>
  <title>Welcome to Rescue Hub — Set your password</title>
  <meta name="robots" content="noindex,nofollow,noarchive" />
  <meta name="referrer" content="no-referrer" />
</svelte:head>

<main>
  <section aria-labelledby="welcome-heading">
    <div class="brand"><span aria-hidden="true" class="mark">RH</span> Rescue Hub</div>
    {#if data.invitation}
      <p class="eyebrow">YOUR INVITATION</p>
      <h1 id="welcome-heading">Welcome, {data.invitation.name}.</h1>
      <p class="intro">You've been invited to join <strong>{data.invitation.organisationName}</strong> on Rescue Hub.</p>
      <div class="account">
        <span>YOUR ACCOUNT</span>
        <strong>{data.invitation.email}</strong>
        <span>ORGANISATION</span>
        <strong>{data.invitation.organisationName}</strong>
      </div>
      <form method="POST">
        <label for="password">Make your new password</label>
        <div class="password-row">
          <input id="password" name="password" type={visible ? 'text' : 'password'}
            autocomplete="new-password" minlength="10" maxlength="256" required
            aria-describedby="password-hint" />
          <button class="visibility" type="button" onclick={() => visible = !visible}
            aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? 'Hide' : 'Show'}</button>
        </div>
        <p id="password-hint" class="hint">At least 10 characters. You can use a password manager.</p>
        {#if form?.error}<p role="alert" class="error">{form.error}</p>{/if}
        <button class="primary" type="submit">Set password and enter {data.invitation.organisationName}</button>
      </form>
    {:else}
      <p class="eyebrow">INVITATION UNAVAILABLE</p>
      <h1 id="welcome-heading">This invitation link is no longer valid.</h1>
      <p class="intro">It may have expired, been used already or been replaced by a new invitation. Ask your organisation administrator to resend your invitation email.</p>
      <a class="primary link" href="/login">Go to sign in</a>
    {/if}
  </section>
</main>

<style>
  :global(body){margin:0}
  main{min-height:100vh;display:grid;place-items:center;box-sizing:border-box;padding:24px;background:#edf3ef;color:#1b3024;font-family:system-ui,-apple-system,sans-serif}
  section{width:min(520px,100%);box-sizing:border-box;background:white;border:1px solid #dce7df;border-radius:20px;padding:clamp(24px,5vw,40px);box-shadow:0 18px 50px #132d1e0a}
  .brand{display:flex;align-items:center;gap:10px;font-size:16px;font-weight:800}
  .mark{display:grid;place-items:center;width:36px;height:36px;border-radius:10px;background:#173d2c;color:white;font-size:14px}
  .eyebrow{color:#587666;letter-spacing:.13em;font-size:11px;font-weight:800;margin:32px 0 8px}
  h1{font-size:clamp(27px,5vw,36px);letter-spacing:-.035em;line-height:1.15;margin:0 0 14px}
  .intro{font-size:15px;line-height:1.6;color:#536b5a}
  .intro strong{color:#173d2c}
  .account{margin:25px 0;border:1px solid #dfebe2;border-radius:13px;padding:18px;display:grid;gap:5px;background:#f6faf7}
  .account span{font-size:10px;letter-spacing:.09em;color:#617a6b;font-weight:800;margin-top:7px}
  .account strong{font-size:14px;overflow-wrap:anywhere}
  form{display:grid;gap:11px;margin-top:22px}
  label{font-weight:800;font-size:14px}
  .password-row{display:flex;gap:8px}
  input{min-width:0;flex:1;border:1px solid #b7cfc0;border-radius:9px;padding:13px;font:inherit}
  input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #f2ac45;outline-offset:2px}
  button{font:inherit;cursor:pointer}
  .visibility{border:1px solid #bdcec3;background:white;border-radius:9px;padding:0 14px;font-weight:750}
  .hint{font-size:12px;color:#5e7265;margin:0}
  .primary{display:block;margin-top:12px;width:100%;box-sizing:border-box;border:0;border-radius:10px;background:#173d2c;color:#fff;padding:15px 17px;font-size:14px;font-weight:800;text-align:center}
  .link{text-decoration:none}
  .error{margin:0;color:#982e2e;background:#fff0ed;padding:12px;border-radius:9px;font-size:13px;line-height:1.5}
</style>
