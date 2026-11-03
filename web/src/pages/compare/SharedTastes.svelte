<script lang="ts">
  import type { MediaType } from '../../api/types';
  import Section from '../../components/Section.svelte';
  import { sharedTastes, type SharedTaste, type TasteKind, type TasteProfile } from './tastes';

  interface Props {
    myTastes: TasteProfile;
    theirTastes: TasteProfile;
    otherName: string;
    type: MediaType;
  }

  let { myTastes, theirTastes, otherName, type }: Props = $props();

  const groups = $derived(
    ([['genre', 'Genres', 8], ['tag', 'Mots-clés', 14]] as [TasteKind, string, number][])
      .map(([kind, title, limit]) => ({ kind, title, tastes: sharedTastes(myTastes, theirTastes, kind, limit) }))
      .filter((group) => group.tastes.length),
  );
  const word = $derived(type === 'MANGA' ? 'manga' : 'anime');

  const mean = (score: number | null) => (score === null ? '–' : Math.round(score));

  function describe(taste: SharedTaste): string {
    const side = (who: string, feature: SharedTaste['mine']) =>
      `${who} : ${feature.count} ${word}${feature.meanScore === null ? '' : `, moyenne ${Math.round(feature.meanScore)} %`}`;
    return `${side('Toi', taste.mine)}\n${side(otherName, taste.theirs)}`;
  }
</script>

<Section title="Goûts en commun">
  {#if groups.length}
    <div class="groups">
      {#each groups as group (group.kind)}
        <div class="group">
          <h3 class="field-label">{group.title}</h3>
          <ul>
            {#each group.tastes as taste (taste.name)}
              <li title={describe(taste)}>
                <span class="name">{taste.name}</span>
                <span class="scores">
                  <span>toi {mean(taste.mine.meanScore)}</span>
                  <span>{otherName} {mean(taste.theirs.meanScore)}</span>
                </span>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>
    <p class="faint hint">Les genres et mots-clés que vous regardez souvent tous les deux et notez au-dessus de votre moyenne.</p>
  {:else}
    <p class="faint">Aucun goût commun assez marqué pour l’instant : il faut quelques {word} de plus de chaque côté.</p>
  {/if}
</Section>

<style>
  .groups {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: var(--space5);
  }

  .group h3 {
    margin-bottom: var(--space2);
  }

  ul {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* <-- Chaque goût est une étiquette : le nom, puis les deux moyennes en chiffres de dossier --> */
  li {
    display: inline-flex;
    align-items: center;
    gap: var(--space2);
    padding: 4px 6px 4px 12px;
    border: var(--outlineThin);
    border-radius: var(--radiusPill);
    background: var(--colorPaper);
    box-shadow: 2px 2px 0 var(--colorInk);
    cursor: default;
  }

  li:nth-child(3n + 1) {
    background: var(--colorBlond);
  }

  li:nth-child(3n + 2) {
    background: var(--colorSkySoft);
  }

  .name {
    font-weight: 800;
  }

  .scores {
    display: inline-flex;
    gap: 4px;
  }

  .scores span {
    padding: 0 6px;
    border-radius: var(--radiusPill);
    background: var(--colorMauveSoft);
    font-family: var(--fontFile);
    font-size: var(--fontSizeXs);
  }

  .hint {
    margin-top: var(--space3);
    font-size: var(--fontSizeSm);
  }
</style>
