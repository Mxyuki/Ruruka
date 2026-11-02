<script lang="ts">
  import { mediaPath } from '../../lib/routes';
  import { groupWatch } from '../../state/groupWatch.svelte';
  import { playback } from '../../state/playback.svelte';
  import { toasts } from '../../state/toasts.svelte';
  import SharedEpisodeCard from './SharedEpisodeCard.svelte';

  const playing = $derived(playback.nowPlaying && !playback.nowPlaying.isRemote ? playback.nowPlaying : null);

  async function copyCode() {
    if (!groupWatch.code) return;
    try {
      await navigator.clipboard.writeText(groupWatch.code);
      toasts.success('Code copié, envoie-le à tes amis !');
    } catch (error) {
      toasts.error(error, 'Impossible de copier le code');
    }
  }
</script>

<section class="card" style:--accent="var(--colorStrawberry)">
  <!-- Le code à dicter, façon numéro de dossier -->
  <div class="code-row">
    <div>
      <h2 class="note-label">Code de la séance</h2>
      <p class="code">{groupWatch.code}</p>
    </div>
    <button class="btn btn-secondary btn-sm" type="button" onclick={copyCode}>Copier</button>
  </div>

  {#if groupWatch.isReconnecting}
    <p class="warning">Connexion au relais perdue, on la rétablit…</p>
  {/if}

  <h3 class="note-label">À l’écran</h3>
  {#if playing && groupWatch.shared}
    <a href="#{mediaPath(playing.media.id)}">
      <SharedEpisodeCard media={playing.media} shared={groupWatch.shared} />
    </a>
  {:else}
    <p class="muted">Lance un épisode dans mpv : tes amis le suivront dès qu’il démarre.</p>
  {/if}

  <h3 class="note-label">Dans la séance · {groupWatch.friends.length}</h3>
  {#if groupWatch.friends.length}
    <ul>
      {#each groupWatch.friends as friend (friend.friendId)}
        <li class="chip">{friend.name}</li>
      {/each}
    </ul>
  {:else}
    <p class="muted">Personne pour l’instant. Donne-leur le code !</p>
  {/if}

  <button class="btn btn-danger" type="button" onclick={() => groupWatch.leave()}>Fermer la séance</button>
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space3);
    max-width: 640px;
    padding: var(--space5);
  }

  .code-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space4);
    width: 100%;
  }

  .code {
    margin: 0;
    font-family: var(--fontFile);
    font-size: var(--fontSize2xl);
    letter-spacing: 0.12em;
  }

  p {
    margin: 0;
  }

  .warning {
    color: var(--colorWarning);
    font-weight: 800;
  }

  a {
    width: 100%;
  }

  ul {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
</style>
