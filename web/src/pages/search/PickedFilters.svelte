<script lang="ts">
  import Icon from '../../components/Icon.svelte';
  import { togglePick, updatePick, type FilterPick } from './filterPicks';

  interface Props {
    label: string;
    picks: FilterPick[];
  }

  let { label, picks = $bindable() }: Props = $props();

  function toggleExcluded(pick: FilterPick) {
    picks = updatePick(picks, pick.name, { isExcluded: !pick.isExcluded });
  }
</script>

{#if picks.length}
  <div class="picked">
    <span class="field-label">{label}</span>
    {#each picks as pick (pick.name)}
      <span class="chip" class:is-excluded={pick.isExcluded}>
        <button
          type="button"
          title={pick.isExcluded ? 'Exclu : cliquer pour l’exiger' : 'Exigé : cliquer pour l’exclure'}
          onclick={() => toggleExcluded(pick)}
        >
          {pick.isExcluded ? 'Sans' : ''}
          {pick.name}
          {#if !pick.isExcluded && pick.minimumRank !== undefined}<span class="rank">≥ {pick.minimumRank} %</span>{/if}
        </button>
        <button class="remove" type="button" aria-label="Retirer {pick.name}" onclick={() => (picks = togglePick(picks, pick.name))}>
          <Icon name="close" size={12} />
        </button>
      </span>
    {/each}
  </div>
{/if}

<style>
  .picked {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space2);
  }

  .picked .field-label {
    margin: 0 var(--space1) 0 0;
  }

  .chip {
    gap: 2px;
    padding-right: 4px;
    background: var(--colorBlond);
  }

  /* <-- Un filtre exclu passe sur fond fraise, comme un suspect écarté --> */
  .chip.is-excluded {
    background: var(--colorStrawberry);
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
    font-weight: 800;
  }

  .rank {
    font-family: var(--fontFile);
    font-size: var(--fontSizeXs);
  }

  .remove {
    padding: 2px;
    border-radius: 50%;
  }

  .remove:hover {
    background: var(--colorMauveSoft);
  }
</style>
