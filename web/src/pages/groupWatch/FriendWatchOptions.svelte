<script lang="ts">
  import { groupWatch } from '../../state/groupWatch.svelte';
  import { playback } from '../../state/playback.svelte';
  import { watchStream } from '../../state/watchStream.svelte';

  const remote = $derived(groupWatch.remote);
  const shared = $derived(remote?.shared ?? null);
  const hasOwnFile = $derived(shared ? playback.hasEpisodeFile(shared.mediaId, shared.episode) : false);
  const canUseOwnFile = $derived(remote?.mode !== 'screen' && hasOwnFile);
  const canStream = $derived(remote?.mode === 'stream' && Boolean(remote.stream));
  const isFollowing = $derived(groupWatch.following !== 'none');
  const isStreamBusy = $derived(watchStream.linkStatus !== 'idle');
  const offsetLabel = $derived(`${groupWatch.syncOffsetSeconds > 0 ? '+' : ''}${groupWatch.syncOffsetSeconds.toFixed(1)} s`);
</script>

{#if remote?.mode === 'files' && !hasOwnFile}
  <p class="muted">Cet épisode n’est pas dans tes dossiers : tu peux le suivre par le partage d’écran de l’hôte.</p>
{/if}

{#if !isFollowing && !isStreamBusy && (canUseOwnFile || canStream)}
  <div class="actions">
    {#if canUseOwnFile}
      <button class="btn btn-primary" type="button" onclick={() => groupWatch.followWithOwnFile()}>Ouvrir mon fichier</button>
    {/if}
    {#if canStream}
      <button class={canUseOwnFile ? 'btn btn-secondary' : 'btn btn-primary'} type="button" onclick={() => watchStream.requestStream()}>
        Demander le flux
      </button>
    {/if}
  </div>
{/if}

{#if watchStream.linkStatus === 'waiting'}
  <p class="muted">Demande envoyée, on attend l’accord de l’hôte…</p>
{:else if watchStream.linkStatus === 'connecting'}
  <p class="muted">Connexion directe en cours…</p>
{/if}

{#if isStreamBusy}
  <button class="btn btn-ghost btn-sm" type="button" onclick={() => watchStream.leaveStream()}>Arrêter le flux</button>
{:else if isFollowing}
  <button class="btn btn-ghost btn-sm" type="button" onclick={() => groupWatch.stopFollowingHost()}>Ne plus suivre l’hôte</button>
{/if}

{#if groupWatch.following === 'files'}
  <!-- Deux releases n'ont pas toujours le même minutage -->
  <div class="offset">
    <span class="note-label">Décalage de ta version</span>
    <button class="btn btn-sm" type="button" aria-label="Reculer de 0,5 seconde" onclick={() => groupWatch.nudgeSyncOffset(-0.5)}>-0,5 s</button>
    <span class="counter">{offsetLabel}</span>
    <button class="btn btn-sm" type="button" aria-label="Avancer de 0,5 seconde" onclick={() => groupWatch.nudgeSyncOffset(0.5)}>+0,5 s</button>
  </div>
{/if}

<style>
  p {
    margin: 0;
  }

  .actions,
  .offset {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space2);
  }

  .counter {
    min-width: 64px;
    font-family: var(--fontFile);
    text-align: center;
  }
</style>
