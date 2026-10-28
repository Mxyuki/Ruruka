<script lang="ts">
  import { listStatuses, type MediaType } from '../../api/types';
  import { formatListStatus, statusColor } from '../../lib/format';
  import type { ListChoice } from './filterPicks';

  interface Props {
    type: MediaType;
    /** Empty shows everything. */
    choices: ListChoice[];
  }

  let { type, choices = $bindable() }: Props = $props();

  function toggle(choice: ListChoice) {
    choices = choices.includes(choice) ? choices.filter((chosen) => chosen !== choice) : [...choices, choice];
  }
</script>

<!-- Filtre « Ma liste » : plusieurs statuts à la fois, rien de coché montre tout -->
<div class="list-filter">
  <span class="field-label">Ma liste</span>
  <button class="chip" class:is-active={!choices.length} type="button" onclick={() => (choices = [])}>Tout</button>
  {#each listStatuses as status (status)}
    <button class="chip" class:is-active={choices.includes(status)} type="button" onclick={() => toggle(status)}>
      <span class="dot" style:background={statusColor(status)}></span>
      {formatListStatus(status, type)}
    </button>
  {/each}
  <button class="chip" class:is-active={choices.includes('NONE')} type="button" onclick={() => toggle('NONE')}>Pas dans ma liste</button>
</div>

<style>
  .list-filter {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space2);
    margin-bottom: var(--space5);
  }

  .list-filter .field-label {
    margin: 0 var(--space1) 0 0;
  }

  .chip {
    border: 0;
    cursor: pointer;
    font-size: var(--fontSizeXs);
  }

  .dot {
    width: 8px;
    height: 8px;
    border: var(--outlineThin);
    border-radius: 50%;
  }
</style>
