<script lang="ts">
  import { fetchFriendActivity } from '../../api/queries/activity';
  import { fetchRecentAirings, type RecentAiring } from '../../api/queries/notifications';
  import { browseMedia, currentSeason } from '../../api/queries/search';
  import type { ListEntry } from '../../api/types';
  import ActivityFeed from '../../components/ActivityFeed.svelte';
  import ArtSlot from '../../components/ArtSlot.svelte';
  import LoadingState from '../../components/LoadingState.svelte';
  import MediaCard from '../../components/MediaCard.svelte';
  import PageHeader from '../../components/PageHeader.svelte';
  import Section from '../../components/Section.svelte';
  import { formatSeason } from '../../lib/format';
  import { library } from '../../state/library.svelte';
  import { mediaList } from '../../state/mediaList.svelte';
  import { session } from '../../state/session.svelte';
  import { toasts } from '../../state/toasts.svelte';
  import AiringList from './AiringList.svelte';
  import CaseHero from './CaseHero.svelte';
  import ContinueRow from './ContinueRow.svelte';
  import RandomPick from './RandomPick.svelte';

  const collapsedUpNext = 6;
  const trendingCount = 6;
  const friendsPreviewCount = 4;
  const freshEpisodeHours = 12;

  const { season, year } = currentSeason();
  const trending = browseMedia({ type: 'ANIME', season, year, sort: 'TRENDING_DESC' });
  const seasonExplorerPath = `#/search/anime?season=${season}&year=${year}&sort=TRENDING_DESC`;
  let showsAllUpNext = $state(false);
  let recentAirings = $state<RecentAiring[]>([]);

  fetchRecentAirings(Math.floor(Date.now() / 1000) - freshEpisodeHours * 3600)
    .then((airings) => (recentAirings = airings))
    .catch((error: unknown) => toasts.error(error, 'Impossible de vérifier les nouveaux épisodes'));

  const byMostWatched = (a: ListEntry, b: ListEntry) => b.progress - a.progress || b.updatedAt - a.updatedAt;

  const isReady = (entry: ListEntry) => library.episodesFor(entry.mediaId).has(entry.progress + 1);

  // <-- Les anime dont l'épisode suivant est téléchargé passent devant -->
  const watching = $derived.by(() => {
    const inProgress = mediaList.list('ANIME').filter((entry) => entry.status === 'CURRENT' || entry.status === 'REPEATING');
    return {
      ready: inProgress.filter(isReady).sort(byMostWatched),
      upNext: inProgress.filter((entry) => !isReady(entry)).sort(byMostWatched),
    };
  });

  // <-- Un épisode notifié dans les 12 dernières heures, et pas encore vu, prend la une : le plus récent gagne -->
  const freshEntry = $derived(
    recentAirings
      .map((airing) => ({ airing, entry: mediaList.entryFor(airing.mediaId) }))
      .find(({ airing, entry }) => entry && ['CURRENT', 'REPEATING', 'PLANNING'].includes(entry.status) && entry.progress < airing.episode)?.entry,
  );

  // <-- Sinon le premier devient l'affaire du jour ; l'affaire du jour sort des listes en dessous -->
  const hero = $derived.by(() => {
    if (freshEntry) return { entry: freshEntry, isReady: isReady(freshEntry) };
    if (watching.ready[0]) return { entry: watching.ready[0], isReady: true };
    return watching.upNext[0] ? { entry: watching.upNext[0], isReady: false } : null;
  });
  const ready = $derived(watching.ready.filter((entry) => entry.id !== hero?.entry.id));
  const upNext = $derived(watching.upNext.filter((entry) => entry.id !== hero?.entry.id));
  const visibleUpNext = $derived(showsAllUpNext ? upNext : upNext.slice(0, collapsedUpNext));
  const caseCount = $derived(watching.ready.length + watching.upNext.length);

  // <-- Ce que tu regardes, plus les anime prévus seulement quand leur premier épisode arrive -->
  const isAwaitedEpisode = ({ status, media }: ListEntry) =>
    status === 'CURRENT' || (status === 'PLANNING' && media.nextAiringEpisode?.episode === 1);

  const airing = $derived(
    mediaList
      .list('ANIME')
      .filter((entry) => entry.media.nextAiringEpisode && isAwaitedEpisode(entry))
      .sort((a, b) => (a.media.nextAiringEpisode?.airingAt ?? 0) - (b.media.nextAiringEpisode?.airingAt ?? 0))
      .slice(0, 8),
  );

  const caseNote = $derived(
    !mediaList.isLoaded('ANIME') ? undefined : caseCount ? `${caseCount} enquête${caseCount > 1 ? 's' : ''} t'attend${caseCount > 1 ? 'ent' : ''} aujourd'hui` : 'Aucune enquête en cours',
  );
</script>

<div class="page">
  <div class="greeting">
    <PageHeader title="Coucou, {session.viewer?.name ?? 'détective'} !" note={caseNote} />
    <span class="portrait"><ArtSlot name="accueil-portrait.png" width={150} height={204} /></span>
  </div>

  {#if hero}
    <CaseHero entry={hero.entry} isReady={hero.isReady} />
  {/if}

  <div class="layout">
    <div>
      <Section title="Enquêtes en cours">
        {#snippet action()}<a class="btn btn-ghost btn-sm" href="#/list/anime">Toute la liste</a>{/snippet}
        {#if !mediaList.isLoaded('ANIME')}
          <LoadingState />
        {:else if !hero}
          <p class="muted">Rien en cours. <a class="link" href="#/search/anime">Trouve une nouvelle affaire</a> !</p>
        {:else}
          {#if ready.length}
            <h3 class="note-label">Prêts à regarder · {ready.length}</h3>
            <ul class="rows">
              {#each ready as entry (entry.id)}
                <ContinueRow {entry} isReady />
              {/each}
            </ul>
          {/if}

          {#if upNext.length}
            <h3 class="note-label">À suivre · {upNext.length}</h3>
            <ul class="rows">
              {#each visibleUpNext as entry (entry.id)}
                <ContinueRow {entry} isReady={false} />
              {/each}
            </ul>
            {#if upNext.length > collapsedUpNext}
              <button class="btn btn-sm" type="button" onclick={() => (showsAllUpNext = !showsAllUpNext)}>
                {showsAllUpNext ? 'Voir moins' : `Voir les ${upNext.length}`}
              </button>
            {/if}
          {/if}
        {/if}
      </Section>

      <Section title="Tendances · {formatSeason(season)} {year}">
        {#snippet action()}<a class="btn btn-ghost btn-sm" href={seasonExplorerPath}>Toute la saison</a>{/snippet}
        {#await trending}
          <LoadingState />
        {:then result}
          <div class="trending">
            {#each result.media.slice(0, trendingCount) as media (media.id)}
              <MediaCard {media} />
            {/each}
          </div>
        {:catch error}
          <p class="faint">{error.message}</p>
        {/await}
      </Section>
    </div>

    <aside>
      <Section title="Au hasard">
        <RandomPick />
      </Section>
      <Section title="Bientôt">
        <AiringList entries={airing} />
      </Section>
      <Section title="Les amis">
        <ActivityFeed
          load={(page) => fetchFriendActivity(session.viewer?.id ?? 0, page)}
          emptyMessage="Pas de nouvelles de tes amis pour l'instant."
          preview={{ count: friendsPreviewCount, href: '#/social' }}
        />
      </Section>
    </aside>
  </div>
</div>

<style>
  .greeting {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space5);
  }

  /* <-- Ruruka s'accoude sur la bannière, à gauche de la carte du jour et de la loupe --> */
  .portrait {
    position: relative;
    z-index: 1;
    margin-right: 380px;
    margin-bottom: -30px;
  }

  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) clamp(320px, 25vw, 420px);
    gap: var(--space7);
  }

  @media (max-width: 1180px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space2);
    margin: 0 0 var(--space5);
    padding: 0;
    list-style: none;
  }

  .trending {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: var(--space5);
  }

  @media (max-width: 1400px) {
    .trending {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  .link {
    color: var(--textSoft);
    text-decoration: underline;
    text-decoration-color: var(--colorStar);
    text-decoration-thickness: 3px;
  }
</style>
