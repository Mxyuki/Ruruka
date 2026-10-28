<script lang="ts">
  import type { FollowingEntry, MediaDetails, Ranking } from '../../api/queries/media';
  import ScoreRing from '../../components/ScoreRing.svelte';
  import { formatCountdown, formatEnum } from '../../lib/format';
  import { studioPath } from '../../lib/routes';
  import MediaActions from './MediaActions.svelte';

  interface Props {
    media: MediaDetails;
    friends: FollowingEntry[];
    /** Opens the chapters section (manga only). */
    onread?: () => void;
  }

  let { media, friends, onread }: Props = $props();

  interface Fact {
    text: string;
    title: string;
    href?: string;
  }

  const scopeOrder = { allTime: 0, year: 1, season: 2 };
  const tapeColors = ['var(--colorStrawberry)', 'var(--colorSky)', 'var(--colorStar)', 'var(--colorLilac)'];
  const searchPath = $derived(`/search/${media.type.toLowerCase()}`);
  const count = (value: number, singular: string) => `${value} ${singular}${value > 1 ? 's' : ''}`;

  const facts: Fact[] = $derived.by(() => {
    const list: (Fact | null)[] = [
      media.format && { text: formatEnum(media.format), title: 'Format' },
      media.type === 'ANIME' && media.episodes ? { text: count(media.episodes, 'épisode'), title: 'Épisodes' } : null,
      media.duration ? { text: `${media.duration} min`, title: "Durée d'un épisode" } : null,
      media.type === 'MANGA' && media.chapters ? { text: count(media.chapters, 'chapitre'), title: 'Chapitres' } : null,
      media.volumes ? { text: count(media.volumes, 'tome'), title: 'Tomes' } : null,
      media.status && { text: formatEnum(media.status), title: 'Statut' },
      media.season && media.seasonYear
        ? { text: `${formatEnum(media.season)} ${media.seasonYear}`, title: 'Saison', href: `${searchPath}?season=${media.season}&year=${media.seasonYear}` }
        : null,
      ...media.studios.map((studio) => ({ text: studio.name, title: 'Studio', href: studioPath(studio.id) })),
      sourceFact(media.source),
    ];
    return list.filter((fact): fact is Fact => Boolean(fact));
  });

  function sourceFact(source: string | null): Fact | null {
    if (!source || source === 'OTHER') return null;
    return { text: source === 'ORIGINAL' ? 'Histoire originale' : `Adapté d'un ${formatEnum(source).toLowerCase()}`, title: 'Source' };
  }

  const friendScores = $derived(friends.filter((friend) => friend.score > 0));
  const friendAverage = $derived(
    friendScores.length ? Math.round(friendScores.reduce((sum, friend) => sum + friend.score, 0) / friendScores.length) : null,
  );
  const friendTooltip = $derived(
    [...friendScores].sort((a, b) => b.score - a.score).map((friend) => `${friend.name} : ${friend.score}%`).join('\n'),
  );

  // <-- La popularité n'a de sens que tous temps confondus ; les classements par année ou saison l'encombrent -->
  const rankings = $derived(
    media.rankings
      .filter((ranking) => ranking.type === 'RATED' || ranking.allTime)
      .sort((a, b) => Number(a.type !== 'RATED') - Number(b.type !== 'RATED') || scopeOrder[scopeOf(a)] - scopeOrder[scopeOf(b)])
      .slice(0, 4),
  );

  function scopeOf(ranking: Ranking): keyof typeof scopeOrder {
    if (ranking.allTime) return 'allTime';
    return ranking.season ? 'season' : 'year';
  }

  function rankingLabel(ranking: Ranking): string {
    const scope = ranking.allTime ? 'de tous les temps' : [ranking.season && formatEnum(ranking.season), ranking.year].filter(Boolean).join(' ');
    return `${ranking.type === 'RATED' ? 'mieux noté' : 'plus populaire'} ${scope}`;
  }

  function rankingHref(ranking: Ranking): string {
    const query = new URLSearchParams({ sort: ranking.type === 'RATED' ? 'SCORE_DESC' : 'POPULARITY_DESC', format: ranking.format });
    if (!ranking.allTime && ranking.year) query.set('year', String(ranking.year));
    if (!ranking.allTime && ranking.season) query.set('season', ranking.season);
    return `${searchPath}?${query}`;
  }
</script>

<header>
  <!-- Bannière avec trame manga -->
  <div class="banner" class:has-image={media.bannerImage} style:--banner={media.bannerImage ? `url('${media.bannerImage}')` : undefined}></div>

  <div class="inner">
    <!-- Jaquette en carte à collectionner -->
    <div class="cover">
      <img src={media.coverImage.extraLarge} alt="" />
    </div>

    <div class="info">
      <h1>{media.title.userPreferred}</h1>
      {#if media.title.english && media.title.english !== media.title.userPreferred}
        <p class="alt-title">{media.title.english}</p>
      {/if}

      <div class="facts">
        {#each facts as fact (fact.title + fact.text)}
          {#if fact.href}
            <a href="#{fact.href}" title={fact.title}>{fact.text}</a>
          {:else}
            <span title={fact.title}>{fact.text}</span>
          {/if}
        {/each}
        {#if media.nextAiringEpisode}
          <span class="airing" title="Prochain épisode">
            ép. {media.nextAiringEpisode.episode} dans {formatCountdown(media.nextAiringEpisode.timeUntilAiring)}
          </span>
        {/if}
      </div>

      <div class="stats">
        {#if media.averageScore}
          <ScoreRing score={media.averageScore} label="Note moyenne" tooltip={media.meanScore ? `Moyenne exacte : ${media.meanScore}%` : undefined} />
        {/if}
        {#if friendAverage}
          <ScoreRing score={friendAverage} label="Tes amis · {friendScores.length}" tooltip={friendTooltip} />
        {/if}
        {#if rankings.length}
          <div class="rankings">
            {#each rankings as ranking, index (index)}
              <a class="ranking" href="#{rankingHref(ranking)}" title="#{ranking.rank} {ranking.context}">
                <strong>#{ranking.rank}</strong>
                <span>{rankingLabel(ranking)}</span>
              </a>
            {/each}
          </div>
        {/if}
      </div>

      {#if media.genres.length}
        <div class="genres">
          {#each media.genres as genre, index (genre)}
            <a class="genre" style:--tape={tapeColors[index % tapeColors.length]} href="#{searchPath}?genre={encodeURIComponent(genre)}">{genre}</a>
          {/each}
        </div>
      {/if}

      <MediaActions {media} {onread} />
    </div>
  </div>
</header>

<style>
  header {
    position: relative;
  }

  .banner {
    height: 120px;
    border-bottom: var(--outline);
    background: var(--screentone), var(--colorMauve);
  }

  .banner.has-image {
    height: clamp(240px, 24vh, 340px);
    background: var(--screentone), var(--banner) center / cover;
  }

  .inner {
    display: grid;
    grid-template-columns: clamp(190px, 13vw, 240px) minmax(0, 1fr);
    gap: var(--space6);
    max-width: var(--contentMaxWidth);
    margin: 0 auto;
    padding: 0 clamp(24px, 3vw, 56px) var(--space5);
  }

  .cover {
    align-self: start;
    margin-top: -110px;
    padding: 6px;
    border: var(--outline);
    border-radius: var(--radiusSticker);
    background: var(--colorCollar);
    box-shadow: var(--stickerShadowLarge);
    transform: rotate(-3deg);
  }

  .cover img {
    width: 100%;
    border: var(--outlineThin);
    border-radius: var(--radiusSmall);
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: var(--space3);
    padding-top: var(--space4);
  }

  h1 {
    font-size: clamp(2.6rem, 2.2vw, 3.6rem);
  }

  .alt-title {
    margin-top: calc(var(--space2) * -1);
    color: var(--textSoft);
    font-family: var(--fontHand);
    font-size: 2rem;
    font-weight: 400;
  }

  .facts {
    display: flex;
    flex-wrap: wrap;
    row-gap: 4px;
    font-weight: 700;
  }

  .facts > * + *::before {
    content: '·';
    margin: 0 10px;
    color: var(--colorLilac);
    font-weight: 900;
  }

  .facts a {
    text-decoration: underline;
    text-decoration-color: var(--colorStar);
    text-decoration-thickness: 3px;
  }

  .facts a:hover {
    background: var(--colorBlond);
  }

  .airing {
    color: var(--colorSuccess);
    font-weight: 900;
  }

  .stats {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space5);
    margin: var(--space2) 0;
  }

  .rankings {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space2);
  }

  .ranking {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    padding: 4px 12px;
    border: var(--outlineThin);
    border-radius: var(--radiusSmall);
    background: var(--colorPaper);
    font-size: var(--fontSizeXs);
    transition: transform 0.2s var(--easeSpring);
  }

  .ranking:nth-child(even) {
    transform: rotate(1.5deg);
  }

  .ranking:hover {
    background: var(--colorBlond);
    transform: rotate(-2deg) scale(1.05);
  }

  .ranking strong {
    font-family: var(--fontTitle);
    font-size: var(--fontSizeSm);
    font-weight: 400;
  }

  /* <-- Les genres sont des morceaux de washi tape --> */
  .genres {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space2);
  }

  .genre {
    padding: 3px 14px;
    background: color-mix(in srgb, var(--tape) 75%, transparent);
    clip-path: polygon(3% 0, 100% 6%, 97% 100%, 0 94%);
    font-weight: 800;
    transition: transform 0.2s var(--easeSpring);
  }

  .genre:nth-child(odd) {
    transform: rotate(-2deg);
  }

  .genre:hover {
    transform: rotate(2deg) scale(1.08);
  }
</style>
