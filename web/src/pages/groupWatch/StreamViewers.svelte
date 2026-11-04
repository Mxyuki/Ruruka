<script lang="ts">
  import { groupWatch } from '../../state/groupWatch.svelte';
  import { watchStream, type ViewerStatus } from '../../state/watchStream.svelte';

  const statusLabels: Record<ViewerStatus, string> = {
    waiting: 'attend ton accord',
    connecting: 'connexion directe…',
    connected: 'reçoit le flux',
  };
</script>

{#if !groupWatch.shared}
  <p class="muted">Lance un épisode depuis tes dossiers : le flux démarre avec lui.</p>
{:else if !watchStream.viewers.length}
  <p class="muted">Tes amis peuvent demander le flux depuis leur séance. Tu accepteras chacun d’eux ici.</p>
{/if}

{#if watchStream.viewers.length}
  <ul>
    {#each watchStream.viewers as viewer (viewer.friendId)}
      <li>
        <span><strong>{viewer.name}</strong> · {statusLabels[viewer.status]}</span>
        {#if viewer.status === 'waiting'}
          <button class="btn btn-secondary btn-sm" type="button" onclick={() => watchStream.admit(viewer.friendId)}>Accepter</button>
        {/if}
        <button class="btn btn-ghost btn-sm" type="button" onclick={() => watchStream.dropViewer(viewer.friendId)}>
          {viewer.status === 'waiting' ? 'Refuser' : 'Couper son flux'}
        </button>
      </li>
    {/each}
  </ul>
{/if}

<style>
  p {
    margin: 0;
  }

  ul {
    display: grid;
    gap: var(--space2);
    width: 100%;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space2);
  }

  span {
    flex: 1;
    min-width: 160px;
  }
</style>
