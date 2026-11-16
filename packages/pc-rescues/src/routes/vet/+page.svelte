<script lang="ts">
  import type { PageData } from './$types';
  import { enhance } from '$app/forms';
  import type { SubmitFunction } from '@sveltejs/kit';
  import FeedbackModal from '$lib/components/FeedbackModal.svelte';
  import type { FeedbackNotice } from '../../../../core/admin-feedback';
  let { data }: { data: PageData } = $props();
  let feedback = $state<FeedbackNotice | null>(null);
  let saving = $state(false);
  const handleClinicSubmit: SubmitFunction = ({ cancel }) => {
    if (saving) { cancel(); return; }
    saving = true;
    return async ({ result, update }) => {
      saving = false;
      if (result.type === 'error') {
        feedback = { kind: 'error', title: 'Veterinary update failed',
          message: 'The server could not confirm this update. Refresh the animal record before trying again to avoid a duplicate.' };
        return;
      }
      if (result.type === 'redirect') { await update(); return; }
      const response = result.data as { success?: boolean; message?: string } | undefined;
      await update({ reset: result.type === 'success', invalidateAll: result.type === 'success' });
      feedback = {
        kind: result.type === 'success' ? 'success' : 'error',
        title: result.type === 'success' ? 'Veterinary update saved' : 'Veterinary update not saved',
        message: response?.message ?? 'The outcome could not be confirmed. Review the animal record before trying again.'
      };
    };
  };
</script>

<svelte:head><title>Veterinary workspace · Rescue Hub</title></svelte:head>

<main class="vet-workspace">
  <header>
    <p class="eyebrow">Veterinary clinic workspace</p>
    <h1>{data.clinic.name}</h1>
    <p>Animals formally handed over to your clinic appear here. Veterinary updates are attached to the permanent rescue record and shared with the responsible rescue organisation.</p>
    <p class="address">{data.clinic.address}</p>
  </header>

  {#if feedback}
    <FeedbackModal kind={feedback.kind} title={feedback.title}
      message={feedback.message} onDismiss={() => (feedback = null)} />
  {/if}
  {#if saving}<p class="save-progress" role="status" aria-live="polite">Saving veterinary update…</p>{/if}

  <section aria-labelledby="current-animals">
    <h2 id="current-animals">Animals in your care <span>({data.animals.length})</span></h2>
    {#each data.animals as animal (animal.id)}
      <article>
        <div class="animal-heading">
          <div><h3>{animal.species}</h3><p>{animal.description || 'No additional description supplied.'}</p></div>
          <strong class="state">{animal.ready ? 'Collection requested' :
            animal.vetStage === 'ASSESSED_AWAITING_TRANSPORT' ? 'Assessed' : 'Awaiting assessment'}</strong>
        </div>
        <p class="meta">Animal ID: {animal.id} · Updated {new Date(animal.updatedAt).toLocaleString('en-AU')}</p>

        <details>
          <summary>Record veterinary assessment or treatment</summary>
          <form method="POST" use:enhance={handleClinicSubmit} action="?/assessment">
            <input type="hidden" name="animalId" value={animal.id} />
            <label for={'assessment-' + animal.id}>Clinical observations and treatment notes</label>
            <textarea id={'assessment-' + animal.id} name="notes" minlength="3" maxlength="4000" required rows="3" placeholder="Document findings and assessment…"></textarea>
            <button type="submit">Save assessment to animal history</button>
          </form>
        </details>

        {#if !animal.ready}
          <details>
            <summary>Mark ready for care and collection</summary>
            <form method="POST" use:enhance={handleClinicSubmit} action="?/ready">
              <input type="hidden" name="animalId" value={animal.id} />
              <label for={'ready-' + animal.id}>Assessment, care instructions and collection notes</label>
              <textarea id={'ready-' + animal.id} name="notes" minlength="3" maxlength="4000" required rows="3" placeholder="Fit for transfer, medication needs, handling precautions…"></textarea>
              <p class="helper">This creates a care offer and a pending transport pickup at your approved clinic. A carer must accept responsibility before a volunteer collects the animal.</p>
              <button type="submit">Confirm ready for care</button>
            </form>
          </details>
        {/if}

        <details>
          <summary>Record confirmed death or euthanasia</summary>
          <form method="POST" use:enhance={handleClinicSubmit} action="?/outcome">
            <input type="hidden" name="animalId" value={animal.id} />
            <label for={'outcome-' + animal.id}>Confirmed outcome</label>
            <select id={'outcome-' + animal.id} name="outcome" required>
              <option value="">Select an outcome</option>
              <option value="EUTHANISED">Euthanised</option>
              <option value="DECEASED">Deceased</option>
            </select>
            <label for={'outcome-notes-' + animal.id}>Clinical confirmation and notes</label>
            <textarea id={'outcome-notes-' + animal.id} name="notes" minlength="3" maxlength="4000" required rows="3" placeholder="Record why and by whom the outcome was confirmed…"></textarea>
            <p class="helper">This is a final animal outcome. Any outstanding collection offer is cancelled and the permanent history remains.</p>
            <label class="confirmation"><input type="checkbox" name="confirmed" required /> I confirm that the veterinarian has verified this final outcome.</label>
            <button class="danger" type="submit">Record final veterinary outcome</button>
          </form>
        </details>
      </article>
    {:else}
      <div class="empty-state">
        <h3>No animals currently assigned</h3>
        <p>Animals appear here when a wildlife rescuer confirms handover to your registered clinic. You cannot search or browse other organisations' animals.</p>
      </div>
    {/each}
  </section>
  <p class="footnote">For urgent wildlife emergencies, use your existing phone escalation procedures. This workspace does not replace clinical records or emergency telephone contact.</p>
</main>

<style>
  .vet-workspace{padding:calc(var(--rh-content-top) + 20px) var(--rh-gutter) 50px;max-width:1030px;margin:auto;color:var(--rh-text)}
  header{margin-bottom:28px}
  .eyebrow{font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:800;color:var(--rh-muted)}
  h1{margin:6px 0 12px;font-size:clamp(26px,4vw,42px)}
  header p{line-height:1.65;max-width:760px;color:var(--rh-muted)}
  .address{font-size:13px;font-weight:700;color:var(--rh-text)}
  h2{font-size:21px;margin:0 0 18px}
  h2 span{color:var(--rh-muted)}
  article,.empty-state{padding:22px;border:1px solid var(--rh-border);background:var(--rh-surface);border-radius:15px;margin-bottom:15px}
  .animal-heading{display:flex;gap:12px;justify-content:space-between;align-items:start}
  .animal-heading h3{font-size:21px;margin:0}
  .animal-heading p{color:var(--rh-muted);font-size:13px;line-height:1.5}
  .state{font-size:12px;background:var(--rh-surface-soft);padding:8px 11px;border-radius:9px;white-space:nowrap}
  .meta{font-size:12px;color:var(--rh-muted);overflow-wrap:anywhere}
  details{margin-top:12px;border:1px solid var(--rh-border);border-radius:10px;overflow:hidden}
  summary{padding:14px;cursor:pointer;font-weight:700;background:var(--rh-surface-soft)}
  summary:focus-visible,button:focus-visible,textarea:focus-visible,select:focus-visible{outline:3px solid var(--rh-focus);outline-offset:2px}
  form{display:grid;gap:12px;padding:16px}
  label{font-size:13px;font-weight:750}
  textarea,select{width:100%;border:1px solid var(--rh-border);border-radius:9px;padding:12px;font:inherit;background:var(--rh-field);color:var(--rh-text)}
  button{justify-self:start;min-height:44px;border:0;border-radius:9px;padding:11px 17px;background:var(--rh-primary);color:var(--rh-on-primary);font:inherit;font-weight:800;cursor:pointer}
  .danger{background:var(--rh-danger-bg);color:var(--rh-danger-text);border:1px solid var(--rh-border)}
  .confirmation{display:flex;align-items:start;gap:10px;line-height:1.5}
  .confirmation input{width:18px;height:18px;flex:0 0 18px}
  .helper,.footnote{font-size:12px;color:var(--rh-muted);line-height:1.6}
  .empty-state h3{margin-top:0}
  .empty-state p{color:var(--rh-muted);line-height:1.5}
  .save-progress{padding:12px 16px;border-radius:9px;border:1px solid var(--rh-border);background:var(--rh-surface-soft);font-weight:750}
  @media(max-width:600px){.animal-heading{flex-direction:column}.state{white-space:normal}article,.empty-state{padding:15px}}
</style>
