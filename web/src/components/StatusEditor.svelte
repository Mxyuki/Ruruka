<script lang="ts">
  import { onMount } from 'svelte';
  import { editStatus, fetchStatusMarkdown } from '../api/queries/activity';
  import { toasts } from '../state/toasts.svelte';

  interface Props {
    activityId: number;
    /** Receives AniList's HTML for the saved text. */
    onsaved: (html: string) => void;
    oncancel: () => void;
  }

  let { activityId, onsaved, oncancel }: Props = $props();

  let text = $state('');
  let isLoading = $state(true);
  let isSaving = $state(false);
  const canSave = $derived(text.trim().length > 0 && !isSaving && !isLoading);

  onMount(async () => {
    try {
      text = await fetchStatusMarkdown(activityId);
      isLoading = false;
    } catch (error) {
      toasts.error(error, 'Impossible de rouvrir ce message');
      oncancel();
    }
  });

  async function save() {
    if (!canSave) return;
    isSaving = true;
    try {
      onsaved(await editStatus(activityId, text.trim()));
    } catch (error) {
      toasts.error(error, 'Impossible d’enregistrer la modification');
    } finally {
      isSaving = false;
    }
  }

  // <-- Ctrl+Entrée enregistre, Échap abandonne : un statut peut faire plusieurs lignes -->
  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') oncancel();
    if (event.key !== 'Enter' || !event.ctrlKey) return;
    event.preventDefault();
    void save();
  }
</script>

<div class="editor">
  <textarea class="input" rows="4" aria-label="Modifier le message" placeholder={isLoading ? 'On retrouve ta note…' : ''} disabled={isLoading} bind:value={text} {onkeydown}></textarea>
  <div class="buttons">
    <button class="btn btn-ghost btn-sm" type="button" onclick={oncancel}>Annuler</button>
    <button class="btn btn-primary btn-sm" type="button" disabled={!canSave} onclick={save}>{isSaving ? 'Enregistrement…' : 'Enregistrer'}</button>
  </div>
</div>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    gap: var(--space2);
  }

  textarea {
    resize: vertical;
  }

  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: var(--space2);
  }
</style>
