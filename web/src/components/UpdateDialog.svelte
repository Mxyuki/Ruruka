<script lang="ts">
  import { updates } from '../state/updates.svelte';
  import Modal from './Modal.svelte';

  const update = $derived(updates.available);

  function close() {
    if (!updates.isInstalling) updates.dismiss();
  }
</script>

{#if update}
  <Modal open title="Une nouvelle édition du carnet !" width="460px" onclose={close}>
    <div class="clue">
      <img src="./ruruka.png" alt="" width="64" height="64" />
      <div>
        <p>
          Ruruka <strong>{update.version}</strong> est disponible (tu as la {update.currentVersion}).
          On met le carnet à jour ? Ruruka se fermera le temps de l'installation puis se relancera.
        </p>
        <a href={update.notesUrl} target="_blank" rel="noopener noreferrer">Voir les nouveautés</a>
      </div>
    </div>

    {#snippet footer()}
      <button class="btn btn-ghost" type="button" disabled={updates.isInstalling} onclick={close}>Plus tard</button>
      <button class="btn btn-primary" type="button" disabled={updates.isInstalling} onclick={() => updates.install()}>
        {updates.isInstalling ? 'Téléchargement…' : 'Mettre à jour'}
      </button>
    {/snippet}
  </Modal>
{/if}

<style>
  .clue {
    display: flex;
    align-items: flex-start;
    gap: var(--space4);
  }

  img {
    flex-shrink: 0;
    border: 2px solid var(--colorStar);
    border-radius: 50%;
  }

  p {
    margin-bottom: var(--space2);
    color: var(--textSoft);
  }

  a {
    color: var(--textSoft);
    font-weight: 700;
  }
</style>
