<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '../../lib/bridge';
  import { toasts } from '../../state/toasts.svelte';
  import { updates } from '../../state/updates.svelte';

  let currentVersion = $state('');

  onMount(async () => {
    // <-- Version installée, affichée à côté du bouton -->
    try {
      currentVersion = await invoke('update.version');
    } catch (error) {
      toasts.error(error, 'Lecture de la version');
    }
  });
</script>

<section class="card" style:--accent="var(--colorStar)">
  <h2 class="note-label">Mises à jour</h2>
  <p class="hint">Ruruka vérifie au démarrage. Tu peux aussi regarder sur GitHub maintenant, sans le relancer.</p>
  <div class="actions">
    <button class="btn btn-secondary" type="button" disabled={updates.isChecking} onclick={() => updates.checkNow()}>
      {updates.isChecking ? 'Vérification…' : 'Vérifier les mises à jour'}
    </button>
    {#if currentVersion}
      <span class="version">Version actuelle : {currentVersion}</span>
    {/if}
  </div>
</section>

<style>
  section {
    position: relative;
    margin-bottom: var(--space4);
    padding: var(--space5);
  }

  .hint {
    margin: calc(var(--space2) * -1) 0 var(--space3);
    color: var(--textFaint);
    font-size: var(--fontSizeSm);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space3);
  }

  .version {
    color: var(--textSoft);
    font-size: var(--fontSizeSm);
  }
</style>
