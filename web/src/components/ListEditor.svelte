<script lang="ts">
  import { listStatuses, type FuzzyDate, type ListEntryChanges, type MediaSummary } from '../api/types';
  import { formatListStatus } from '../lib/format';
  import { mediaList, totalUnits } from '../state/mediaList.svelte';
  import { session } from '../state/session.svelte';
  import { toasts } from '../state/toasts.svelte';
  import CustomListPicker from './CustomListPicker.svelte';
  import Modal from './Modal.svelte';
  import NumberStepper from './NumberStepper.svelte';
  import ScoreInput from './ScoreInput.svelte';
  import Toggle from './Toggle.svelte';

  interface Props {
    media: MediaSummary;
    open: boolean;
    onclose: () => void;
  }

  let { media, open, onclose }: Props = $props();

  const entry = $derived(mediaList.entryFor(media.id));
  const scoreFormat = $derived(session.viewer?.mediaListOptions.scoreFormat ?? 'POINT_100');

  let draft = $state<Required<Omit<ListEntryChanges, 'progressVolumes' | 'customLists' | 'hiddenFromStatusLists'>>>(emptyDraft());
  let isSaving = $state(false);

  $effect(() => {
    if (open) draft = draftFromEntry();
  });

  function emptyDraft() {
    return {
      status: 'PLANNING' as const,
      progress: 0,
      score: 0,
      repeat: 0,
      private: false,
      notes: '',
      startedAt: { year: null, month: null, day: null },
      completedAt: { year: null, month: null, day: null },
    };
  }

  function draftFromEntry() {
    if (!entry) return emptyDraft();
    const { status, progress, score, repeat, notes, startedAt, completedAt } = entry;
    return { status, progress, score, repeat, private: entry.private, notes: notes ?? '', startedAt, completedAt };
  }

  const toInputDate = (date: FuzzyDate) =>
    date.year && date.month && date.day
      ? `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
      : '';

  function fromInputDate(value: string): FuzzyDate {
    const [year, month, day] = value.split('-').map(Number);
    return value ? { year: year ?? null, month: month ?? null, day: day ?? null } : { year: null, month: null, day: null };
  }

  async function save() {
    isSaving = true;
    try {
      await mediaList.save(media, draft);
      toasts.success('C’est noté dans ta liste !');
      onclose();
    } catch (error) {
      toasts.error(error, 'Impossible d’enregistrer');
    } finally {
      isSaving = false;
    }
  }

  async function remove() {
    if (!entry) return;
    isSaving = true;
    try {
      await mediaList.remove(entry);
      toasts.success('Retiré de ta liste');
      onclose();
    } catch (error) {
      toasts.error(error, 'Impossible de retirer');
    } finally {
      isSaving = false;
    }
  }
</script>

<Modal {open} title={media.title.userPreferred} width="600px" {onclose}>
  <div class="grid">
    <label class="field">
      <span class="field-label">Statut</span>
      <select class="select" bind:value={draft.status}>
        {#each listStatuses as status (status)}
          <option value={status}>{formatListStatus(status, media.type)}</option>
        {/each}
      </select>
    </label>

    <div class="field">
      <span class="field-label">Progression</span>
      <NumberStepper label="progression" value={draft.progress} max={totalUnits(media)} onchange={(value) => (draft.progress = value)} />
    </div>

    <div class="field">
      <span class="field-label">Ma note</span>
      <ScoreInput value={draft.score} format={scoreFormat} onchange={(value) => (draft.score = value)} />
    </div>

    <div class="field">
      <span class="field-label">Revisionnages</span>
      <NumberStepper label="revisionnages" value={draft.repeat} onchange={(value) => (draft.repeat = value)} />
    </div>

    <label class="field">
      <span class="field-label">Commencé le</span>
      <input class="input" type="date" value={toInputDate(draft.startedAt)} onchange={(event) => (draft.startedAt = fromInputDate(event.currentTarget.value))} />
    </label>

    <label class="field">
      <span class="field-label">Terminé le</span>
      <input class="input" type="date" value={toInputDate(draft.completedAt)} onchange={(event) => (draft.completedAt = fromInputDate(event.currentTarget.value))} />
    </label>

    <div class="field wide">
      <span class="field-label">Listes perso</span>
      <CustomListPicker {media} />
    </div>

    <label class="field wide">
      <span class="field-label">Notes</span>
      <textarea class="input" rows="3" bind:value={draft.notes}></textarea>
    </label>

    <div class="wide">
      <Toggle checked={draft.private} label="Privé : cacher ce dossier aux autres" onchange={(isPrivate) => (draft.private = isPrivate)} />
    </div>
  </div>

  {#snippet footer()}
    {#if entry}
      <button class="btn btn-danger" type="button" disabled={isSaving} onclick={remove}>Retirer</button>
    {/if}
    <span class="spacer"></span>
    <button class="btn btn-ghost" type="button" onclick={onclose}>Annuler</button>
    <button class="btn btn-primary" type="button" disabled={isSaving} onclick={save}>Enregistrer</button>
  {/snippet}
</Modal>

<style>
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space4) var(--space5);
  }

  .wide {
    grid-column: 1 / -1;
  }

  textarea {
    resize: vertical;
  }

  .spacer {
    flex: 1;
  }
</style>
