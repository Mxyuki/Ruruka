<script lang="ts">
  import { mediaPath } from '../../lib/routes';
  import { groupWatch } from '../../state/groupWatch.svelte';
  import { playback } from '../../state/playback.svelte';
  import SharedEpisodeCard from './SharedEpisodeCard.svelte';

  const remote = $derived(groupWatch.remote);
  const isOwnMpvPlaying = $derived(Boolean(playback.nowPlaying && !playback.nowPlaying.isRemote));
</script>

<section class="card" style:--accent="var(--colorSky)">
  <h2 class="note-label">{remote ? `Séance de ${remote.hostName}` : 'Séance'} · <span class="code">{groupWatch.code}</span></h2>

  {#if groupWatch.isReconnecting}
    <p class="warning">Connexion au relais perdue, on la rétablit…</p>
  {:else if !remote}
    <p class="muted">Connecté·e, on attend des nouvelles de l’hôte…</p>
  {:else if remote.status === 'lost'}
    <p class="warning">{remote.hostName} a perdu la connexion. On attend son retour…</p>
  {:else if remote.shared}
    <a href="#{mediaPath(remote.shared.media.id)}">
      <SharedEpisodeCard media={remote.shared.media} shared={remote.shared} />
    </a>
    {#if isOwnMpvPlaying}
      <p class="warning">Ton propre mpv joue un épisode : il passe avant la séance tant qu’il est ouvert.</p>
    {:else}
      <p class="muted">Ta liste avancera quand l’épisode comptera comme vu chez {remote.hostName}.</p>
    {/if}
  {:else}
    <p class="muted">{remote.hostName} n’a rien lancé pour l’instant.</p>
  {/if}

  <button class="btn btn-danger" type="button" onclick={() => groupWatch.leave()}>Quitter la séance</button>
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

  .code {
    font-family: var(--fontFile);
    letter-spacing: 0.08em;
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
</style>
