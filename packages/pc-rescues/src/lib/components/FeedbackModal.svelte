<script lang="ts">
  import { tick } from 'svelte';
  import { onMount } from 'svelte';
  import { AlertCircle, AlertTriangle, CheckCircle2, X } from '@lucide/svelte';

  type Kind = 'success' | 'warning' | 'error';
  let { kind, title, message, detail, onDismiss }: {
    kind: Kind; title: string; message: string; detail?: string;
    onDismiss: () => void;
  } = $props();
  let closeButton: HTMLButtonElement;
  let closed = false;

  // Use an ordinary fixed overlay rather than native <dialog>: a nested
  // browser top layer can get stuck above an admin drawer after enhancement.
  // All three dismissal paths update the same owner-controlled state.
  function dismiss() {
    if (closed) return;
    closed = true;
    onDismiss();
  }
  onMount(() => {
    void tick().then(() => closeButton?.focus());
  });
  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    }
  }
</script>

<svelte:window onkeydown={keydown} />

<div class="feedback-overlay" role="presentation">
  <button class="feedback-backdrop" aria-label="Dismiss notification" type="button" onclick={dismiss}></button>
  <section class="feedback-dialog" data-kind={kind}
    role="dialog" aria-modal="true" aria-labelledby="feedback-title"
    aria-describedby="feedback-description" tabindex="-1">
    <div class="feedback-body">
      <div class="feedback-heading">
        <span class="feedback-icon" aria-hidden="true">
          {#if kind === 'success'}<CheckCircle2 size={25} />
          {:else if kind === 'warning'}<AlertTriangle size={25} />
          {:else}<AlertCircle size={25} />{/if}
        </span>
        <h2 id="feedback-title">{title}</h2>
      </div>
      <p id="feedback-description">{message}</p>
      {#if detail}<p class="detail">{detail}</p>{/if}
      <div class="feedback-actions">
        <button bind:this={closeButton} class="acknowledge" type="button" onclick={dismiss}>
          <X size={16} aria-hidden="true" /> Close
        </button>
      </div>
    </div>
  </section>
</div>

<style>
  .feedback-overlay {position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:16px;isolation:isolate}
  .feedback-backdrop {position:absolute;inset:0;width:100%;height:100%;border:0;background:rgba(9,22,17,.78);cursor:pointer}
  .feedback-dialog {position:relative;z-index:1;width:min(440px,100%);max-height:calc(100dvh - 32px);
    overflow-y:auto;border:1px solid var(--rh-border);border-radius:16px;background:var(--rh-surface);
    color:var(--rh-text);box-shadow:0 22px 70px rgba(0,0,0,.3)}
  .feedback-body{padding:24px;display:grid;gap:17px}
  .feedback-heading{display:flex;align-items:center;gap:12px}
  .feedback-heading h2{margin:0;font-size:21px;line-height:1.3}
  .feedback-icon{display:grid;place-items:center;color:var(--rh-muted)}
  .feedback-dialog[data-kind='success'] .feedback-icon{color:#238352}
  .feedback-dialog[data-kind='warning'] .feedback-icon{color:#ba7a18}
  .feedback-dialog[data-kind='error'] .feedback-icon{color:#b34242}
  p{margin:0;font-size:14px;line-height:1.65;overflow-wrap:anywhere}
  .detail{font-size:12px;color:var(--rh-muted)}
  .feedback-actions{display:flex;justify-content:flex-end;border-top:1px solid var(--rh-border);padding-top:17px}
  .acknowledge{display:flex;align-items:center;gap:8px;min-height:44px;padding:10px 18px;border:0;border-radius:9px;
    background:var(--rh-primary);color:var(--rh-on-primary);font:inherit;font-weight:750;cursor:pointer}
  .acknowledge:focus-visible{outline:3px solid var(--rh-focus);outline-offset:3px}
  @media(max-width:480px){.feedback-body{padding:18px}}
</style>
