<script lang="ts">
  import { onMount } from 'svelte';
  import { AlertCircle, AlertTriangle, CheckCircle2, X } from '@lucide/svelte';

  type Kind = 'success' | 'warning' | 'error';
  let { kind, title, message, detail, onDismiss }: {
    kind: Kind; title: string; message: string; detail?: string;
    onDismiss: () => void;
  } = $props();
  let dialog: HTMLDialogElement;

  // Native modal dialog provides focus containment, an accessible announcement,
  // and prevents interaction with underlying forms until acknowledged.
  onMount(() => {
    dialog?.showModal();
    dialog?.querySelector<HTMLButtonElement>('.acknowledge')?.focus();
  });
  function dismiss() {
    dialog?.close();
    onDismiss();
  }
</script>

<dialog bind:this={dialog} class="feedback-dialog" data-kind={kind}
  aria-labelledby="feedback-title" aria-describedby="feedback-description"
  oncancel={(event) => event.preventDefault()}>
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
      <button type="button" class="acknowledge" onclick={dismiss}>
        <X size={16} aria-hidden="true" /> Close
      </button>
    </div>
  </div>
</dialog>

<style>
  .feedback-dialog {
    width:min(440px,calc(100vw - 32px));
    max-height:min(80dvh,680px);
    overflow-y:auto;
    border:1px solid var(--rh-border);
    border-radius:16px;
    padding:0;
    background:var(--rh-surface);
    color:var(--rh-text);
    box-shadow:0 22px 70px rgba(0,0,0,.3);
  }
  .feedback-dialog::backdrop{background:rgba(9,22,17,.7);backdrop-filter:blur(3px)}
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
  button{display:flex;align-items:center;gap:8px;min-height:44px;padding:10px 18px;border:0;border-radius:9px;
    background:var(--rh-primary);color:var(--rh-on-primary);font:inherit;font-weight:750;cursor:pointer}
  button:focus-visible{outline:3px solid var(--rh-focus);outline-offset:3px}
  @media(max-width:480px){.feedback-body{padding:18px}}
</style>
