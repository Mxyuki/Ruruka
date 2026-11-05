<script lang="ts">
  import { updates } from '../../state/updates.svelte';
</script>

<section class="card" style:--accent="var(--colorStar)">
  <h2 class="note-label">Mises à jour</h2>
  <p class="hint">Ruruka vérifie au démarrage. Tu peux aussi regarder sur GitHub maintenant, sans le relancer.</p>
  <button class="btn btn-secondary" type="button" disabled={updates.isChecking} onclick={() => updates.checkNow()}>
    {updates.isChecking ? 'Vérification…' : 'Vérifier les mises à jour'}
  </button>
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
</style>
