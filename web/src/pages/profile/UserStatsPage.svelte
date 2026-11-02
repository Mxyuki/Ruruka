<script lang="ts">
  import { fetchUserProfile, fetchUserStatistics, type DetailedStatistics } from '../../api/queries/user';
  import type { MediaType } from '../../api/types';
  import EmptyState from '../../components/EmptyState.svelte';
  import LoadingState from '../../components/LoadingState.svelte';
  import { formatEnum, formatListStatus } from '../../lib/format';
  import type { RouteParams } from '../../lib/router.svelte';
  import { staffPath, studioPath } from '../../lib/routes';
  import ProfileTabs from './ProfileTabs.svelte';
  import StatBars, { type StatBar } from './StatBars.svelte';
  import StatColumns from './StatColumns.svelte';

  let { params }: { params: RouteParams } = $props();

  const name = $derived(params.name ?? '');
  const data = $derived(Promise.all([fetchUserProfile(name), fetchUserStatistics(name)]));
  let type = $state<MediaType>('ANIME');

  const countryNames: Record<string, string> = { JP: 'Japon', KR: 'Corée du Sud', CN: 'Chine', TW: 'Taïwan' };

  function tilesFor(stats: DetailedStatistics): [string, string][] {
    const amount = (value: number | undefined) => (value ?? 0).toLocaleString('fr-FR');
    const units: [string, string][] =
      type === 'ANIME'
        ? [['Jours de visionnage', ((stats.minutesWatched ?? 0) / 1440).toFixed(1)], ['Épisodes', amount(stats.episodesWatched)]]
        : [['Chapitres', amount(stats.chaptersRead)], ['Tomes', amount(stats.volumesRead)]];
    return [
      [type === 'ANIME' ? 'Anime' : 'Manga', amount(stats.count)],
      ...units,
      ['Note moyenne', stats.meanScore ? stats.meanScore.toFixed(1) : '–'],
      ['Écart type', stats.standardDeviation ? stats.standardDeviation.toFixed(1) : '–'],
    ];
  }

  // <-- Chaque répartition devient une liste de barres ; les entrées cliquables mènent à l'Explorateur ou à la fiche -->
  function sectionsFor(stats: DetailedStatistics): { title: string; bars: StatBar[] }[] {
    const searchType = type === 'ANIME' ? 'anime' : 'manga';
    const sections = [
      { title: 'Statuts', bars: stats.statuses.map(({ status, count }) => ({ label: formatListStatus(status, type), count })) },
      { title: 'Formats', bars: stats.formats.map(({ format, count }) => ({ label: formatEnum(format), count })) },
      { title: 'Pays', bars: stats.countries.map(({ country, count }) => ({ label: countryNames[country] ?? country, count })) },
      {
        title: 'Genres',
        bars: stats.genres.map(({ genre, count, meanScore }) => ({ label: genre, count, meanScore, href: `#/search/${searchType}?genre=${encodeURIComponent(genre)}` })),
      },
      {
        title: 'Tags',
        bars: stats.tags.map(({ tag, count, meanScore }) => ({ label: tag.name, count, meanScore, href: `#/search/${searchType}?tag=${encodeURIComponent(tag.name)}` })),
      },
      {
        title: 'Studios',
        bars: (stats.studios ?? []).map(({ studio, count, meanScore }) => ({ label: studio.name, count, meanScore, href: `#${studioPath(studio.id)}` })),
      },
      {
        title: 'Seiyuu',
        bars: (stats.voiceActors ?? []).map(({ voiceActor, count, meanScore }) => ({ label: voiceActor.name.userPreferred, count, meanScore, href: `#${staffPath(voiceActor.id)}` })),
      },
      {
        title: 'Équipe',
        bars: stats.staff.map(({ staff, count, meanScore }) => ({ label: staff.name.userPreferred, count, meanScore, href: `#${staffPath(staff.id)}` })),
      },
    ];
    return sections.filter((section) => section.bars.length);
  }

  const scoreColumns = (stats: DetailedStatistics) =>
    [...stats.scores].sort((a, b) => a.score - b.score).map(({ score, count }) => ({ label: String(score), count }));

  // <-- AniList ne trie pas vraiment les années : on les remet dans l'ordre, trous compris, pour un axe régulier -->
  function yearColumns(stats: DetailedStatistics): { label: string; count: number }[] {
    const years = stats.releaseYears.map(({ releaseYear }) => releaseYear);
    if (!years.length) return [];
    const counts = new Map(stats.releaseYears.map(({ releaseYear, count }) => [releaseYear, count]));
    const first = Math.min(...years);
    return Array.from({ length: Math.max(...years) - first + 1 }, (_, offset) => ({ label: String(first + offset), count: counts.get(first + offset) ?? 0 }));
  }
</script>

{#await data}
  <div class="page"><LoadingState /></div>
{:then [user, statistics]}
  {@const stats = statistics[type]}
  {@const unit = type === 'ANIME' ? 'anime' : 'manga'}
  <div class="page">
    <ProfileTabs name={user.name} avatar={user.avatar.medium} />

    <div class="types">
      <button class="chip" class:is-active={type === 'ANIME'} type="button" onclick={() => (type = 'ANIME')}>Anime</button>
      <button class="chip" class:is-active={type === 'MANGA'} type="button" onclick={() => (type = 'MANGA')}>Manga</button>
    </div>

    {#if !stats.count}
      <EmptyState title="Dossier vide" message="Aucun {unit} dans sa liste pour l’instant." />
    {:else}
      <div class="card tiles">
        {#each tilesFor(stats) as [label, value] (label)}
          <div class="tile"><strong>{value}</strong><span>{label}</span></div>
        {/each}
      </div>

      <div class="grid">
        {#if stats.scores.length}
          <section class="card wide">
            <h2 class="note-label">Notes données <span class="faint">(sur 100)</span></h2>
            <StatColumns columns={scoreColumns(stats)} {unit} />
          </section>
        {/if}
        {#if stats.releaseYears.length}
          <section class="card wide">
            <h2 class="note-label">Années de sortie</h2>
            <StatColumns columns={yearColumns(stats)} {unit} />
          </section>
        {/if}
        {#each sectionsFor(stats) as section (section.title)}
          <section class="card">
            <h2 class="note-label">{section.title}</h2>
            <StatBars bars={section.bars} />
          </section>
        {/each}
      </div>
    {/if}
  </div>
{:catch error}
  <EmptyState title="Stats introuvables" message={error.message} />
{/await}

<style>
  .types {
    display: flex;
    gap: var(--space2);
    margin-bottom: var(--space4);
  }

  .chip {
    border: 0;
    cursor: pointer;
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    margin-bottom: var(--space5);
    padding: var(--space4) 0;
  }

  .tile {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 var(--space3);
    border-left: 1px solid var(--colorLine);
    text-align: center;
  }

  .tile:first-child {
    border-left: 0;
  }

  .tile strong {
    color: var(--textSoft);
    font-size: var(--fontSizeXl);
  }

  .tile span {
    color: var(--textFaint);
    font-size: var(--fontSizeXs);
    font-weight: 700;
    text-transform: uppercase;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    gap: var(--space4);
  }

  section {
    padding: var(--space4) var(--space5);
  }

  .wide {
    grid-column: 1 / -1;
  }

  h2 {
    margin-bottom: var(--space3);
  }
</style>
