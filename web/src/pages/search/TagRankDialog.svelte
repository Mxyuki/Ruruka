<script lang="ts">
  import Modal from '../../components/Modal.svelte';
  import { defaultTagRank, type FilterPick } from './filterPicks';

  interface Props {
    open: boolean;
    /** The required tags; excluded ones have no rank. */
    picks: FilterPick[];
    onrank: (name: string, minimumRank: number) => void;
    onclose: () => void;
  }

  let { open, picks, onrank, onclose }: Props = $props();
  const sliderId = $props.id();

  // <-- Le pourcentage s'affiche pendant le glissement, la recherche ne part qu'au relâchement -->
  let drafts = $state<Record<string, number>>({});
  const rankOf = (pick: FilterPick) => drafts[pick.name] ?? pick.minimumRank ?? defaultTagRank;
</script>

<Modal {open} title="Pertinence des mots-clés" {onclose}>
  <p class="hint">
    Sur AniList, chaque mot-clé a un pourcentage : la part des votants qui le trouvent vraiment présent dans l’œuvre. Un anime
    n’est gardé que si chaque mot-clé atteint ton minimum.
  </p>
  {#if picks.length}
    <ul>
      {#each picks as pick, index (pick.name)}
        <li>
          <label for="{sliderId}-{index}">{pick.name}</label>
          <input
            id="{sliderId}-{index}"
            type="range"
            min="0"
            max="100"
            step="5"
            value={rankOf(pick)}
            oninput={(event) => (drafts[pick.name] = Number(event.currentTarget.value))}
            onchange={(event) => onrank(pick.name, Number(event.currentTarget.value))}
          />
          <span class="value">≥ {rankOf(pick)} %</span>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="faint">Ajoute d’abord un mot-clé exigé.</p>
  {/if}
</Modal>

<style>
  .hint {
    margin-bottom: var(--space4);
    color: var(--textSoft);
    font-size: var(--fontSizeSm);
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: var(--space3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 180px 70px;
    align-items: center;
    gap: var(--space3);
  }

  label {
    overflow: hidden;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  input {
    accent-color: var(--colorLilac);
  }

  .value {
    font-family: var(--fontFile);
    text-align: right;
  }
</style>
