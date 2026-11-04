<script lang="ts">
  import Toggle from '../../components/Toggle.svelte';
  import { groupWatch } from '../../state/groupWatch.svelte';

  const canShareControl = $derived(groupWatch.mode !== 'screen');
</script>

{#if groupWatch.friends.length}
  <ul>
    {#each groupWatch.friends as friend (friend.friendId)}
      <li>
        <span class="chip">{friend.name}</span>
        {#if canShareControl}
          <Toggle
            checked={groupWatch.isController(friend.friendId)}
            label="Peut mettre en pause et avancer pour tout le monde"
            onchange={(isAllowed) => groupWatch.setController(friend.friendId, isAllowed)}
          />
        {/if}
      </li>
    {/each}
  </ul>
{:else}
  <p class="muted">Personne pour l’instant. Donne-leur le code !</p>
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
    gap: var(--space3);
  }
</style>
