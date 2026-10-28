<script lang="ts">
  import { browseMedia } from '../../api/queries/search';
  import type { MediaSummary } from '../../api/types';
  import Icon from '../../components/Icon.svelte';
  import { formatEnum } from '../../lib/format';
  import { mediaPath } from '../../lib/routes';
  import { mediaList } from '../../state/mediaList.svelte';
  import { toasts } from '../../state/toasts.svelte';

  type Pool = 'watching' | 'planning' | 'anything';

  const pools: [Pool, string][] = [
    ['watching', 'En cours'],
    ['planning', 'À voir'],
    ['anything', 'N’importe lequel'],
  ];
  // <-- « N'importe lequel » pioche dans les 1 200 anime les plus populaires d'AniList : assez large, sans tomber sur l'introuvable -->
  const popularPageCount = 40;
  const maxPageTries = 3;

  let pool = $state<Pool>('watching');
  let pick = $state<MediaSummary | null>(null);
  let isPicking = $state(false);

  const poolEntries = $derived(
    mediaList.list('ANIME').filter((entry) => (pool === 'planning' ? entry.status === 'PLANNING' : entry.status === 'CURRENT' || entry.status === 'REPEATING')),
  );
  const pickedEntry = $derived(pick ? mediaList.entryFor(pick.id) : undefined);
  const canPick = $derived(pool === 'anything' || poolEntries.length > 0);

  // <-- Évite de retomber sur le même anime deux fois de suite quand on relance -->
  function randomOf<T extends { id: number }>(items: T[]): T | null {
    const others = items.length > 1 ? items.filter((item) => item.id !== pick?.id) : items;
    return others[Math.floor(Math.random() * others.length)] ?? null;
  }

  async function draw() {
    if (pool !== 'anything') {
      pick = randomOf(poolEntries.map((entry) => entry.media));
      return;
    }
    isPicking = true;
    try {
      pick = await drawFromAniList();
    } catch (error) {
      toasts.error(error, 'Impossible de tirer un anime au hasard');
    } finally {
      isPicking = false;
    }
  }

  async function drawFromAniList(): Promise<MediaSummary | null> {
    for (let attempt = 0; attempt < maxPageTries; attempt++) {
      const page = 1 + Math.floor(Math.random() * popularPageCount);
      const { media } = await browseMedia({ type: 'ANIME', sort: 'POPULARITY_DESC' }, page);
      const candidate = randomOf(media.filter((item) => mediaList.entryFor(item.id)?.status !== 'COMPLETED'));
      if (candidate) return candidate;
    }
    return null;
  }

  function choosePool(next: Pool) {
    pool = next;
    pick = null;
  }
</script>

<div class="card picker">
  <div class="pools" role="radiogroup" aria-label="Piocher dans">
    {#each pools as [value, label] (value)}
      <button class="chip" class:is-active={pool === value} type="button" role="radio" aria-checked={pool === value} onclick={() => choosePool(value)}>{label}</button>
    {/each}
  </div>

  {#if pick}
    <!-- Le dossier tiré au sort -->
    <a class="result" href="#{mediaPath(pick.id)}">
      <img src={pick.coverImage.medium} alt="" loading="lazy" />
      <span class="text">
        <strong>{pick.title.userPreferred}</strong>
        <span class="meta">
          {[formatEnum(pick.format), pick.seasonYear, pick.episodes ? `${pick.episodes} ép.` : null].filter(Boolean).join(' · ')}
        </span>
        {#if pickedEntry && pickedEntry.progress}
          <span class="progress">Tu en es à l’épisode {pickedEntry.progress}</span>
        {/if}
      </span>
    </a>
  {/if}

  <button class="btn btn-primary" type="button" data-sparkle disabled={!canPick || isPicking} onclick={draw}>
    <Icon name="refresh" size={16} />
    {isPicking ? 'Mashutan tire au sort…' : pick ? 'Un autre !' : 'Tirer un anime au hasard'}
  </button>
  {#if !canPick}
    <p class="faint">{pool === 'planning' ? 'Ta liste « À voir » est vide.' : 'Rien en cours pour l’instant.'}</p>
  {/if}
</div>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    gap: var(--space3);
    padding: var(--space4);
  }

  .pools {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space2);
  }

  /* <-- Le tirage s'affiche comme une fiche collée dans le carnet --> */
  .result {
    display: flex;
    gap: var(--space3);
    padding: var(--space2);
    border: var(--outlineThin);
    border-radius: var(--radiusSmall);
    background: var(--colorBlond);
    transform: rotate(-1deg);
    transition: transform 0.25s var(--easeSpring);
  }

  .result:hover {
    transform: rotate(0deg) scale(1.02);
  }

  .result img {
    width: 64px;
    aspect-ratio: 2 / 3;
    flex-shrink: 0;
    border: var(--outlineThin);
    object-fit: cover;
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .text strong {
    overflow-wrap: anywhere;
  }

  .meta,
  .progress {
    color: var(--textSoft);
    font-size: var(--fontSizeXs);
    font-weight: 700;
  }

  .progress {
    font-family: var(--fontHand);
    font-size: var(--fontSizeMd);
    font-weight: 400;
  }
</style>
