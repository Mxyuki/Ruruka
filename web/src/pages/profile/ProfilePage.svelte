<script lang="ts">
  import { fetchUserActivity } from '../../api/queries/activity';
  import { fetchUserProfile, toggleFollow, type TypeStatistics } from '../../api/queries/user';
  import ActivityFeed from '../../components/ActivityFeed.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Icon from '../../components/Icon.svelte';
  import LoadingState from '../../components/LoadingState.svelte';
  import MediaCard from '../../components/MediaCard.svelte';
  import Section from '../../components/Section.svelte';
  import { renderAniListMarkdown } from '../../lib/markdown';
  import type { RouteParams } from '../../lib/router.svelte';
  import { aboutEditorPath, characterPath, staffPath, studioPath } from '../../lib/routes';
  import { session } from '../../state/session.svelte';
  import { toasts } from '../../state/toasts.svelte';

  let { params }: { params: RouteParams } = $props();

  const profile = $derived(fetchUserProfile(params.name ?? ''));
  const isViewer = $derived(session.viewer?.name === params.name);
  let isFollowingOverride = $state<boolean | null>(null);
  const aboutCollapsedHeight = 360;
  let isAboutExpanded = $state(false);
  let aboutHeight = $state(0);
  const isAboutLong = $derived(aboutHeight > aboutCollapsedHeight);

  async function follow(userId: number, name: string) {
    try {
      isFollowingOverride = await toggleFollow(userId, name);
    } catch (error) {
      toasts.error(error, 'Impossible de modifier l’abonnement');
    }
  }

  function statTiles(stats: TypeStatistics, type: 'anime' | 'manga'): [string, string][] {
    const tiles: [string, string][] = [[type === 'anime' ? 'Anime' : 'Manga', stats.count.toLocaleString()]];
    if (type === 'anime') {
      tiles.push(['Jours de visionnage', ((stats.minutesWatched ?? 0) / 1440).toFixed(1)], ['Épisodes', (stats.episodesWatched ?? 0).toLocaleString('fr-FR')]);
    } else {
      tiles.push(['Chapitres', (stats.chaptersRead ?? 0).toLocaleString('fr-FR')], ['Tomes', (stats.volumesRead ?? 0).toLocaleString('fr-FR')]);
    }
    tiles.push(['Note moyenne', stats.meanScore ? stats.meanScore.toFixed(1) : '–']);
    return tiles;
  }
</script>

{#await profile}
  <LoadingState />
{:then user}
  {@const isFollowing = isFollowingOverride ?? user.isFollowing}
  <!-- Bannière en trame manga, nom posé dessus comme une étiquette -->
  <header class="banner" style:--banner={user.bannerImage ? `url('${user.bannerImage}')` : undefined} class:has-image={user.bannerImage}>
    <div class="identity">
      <img src={user.avatar.large} alt="" />
      <h1>{user.name}</h1>
      {#if !isViewer}
        <button class="btn" class:btn-primary={!isFollowing} type="button" onclick={() => follow(user.id, user.name)}>
          {isFollowing ? 'Suivi·e' : 'Suivre'}
        </button>
      {/if}
      <a class="btn btn-sm anilist" href="https://anilist.co/user/{user.name}" target="_blank" rel="noopener noreferrer">Voir sur AniList</a>
    </div>
  </header>

  <div class="page">
    {#if user.about || isViewer}
      <section class="about card" class:is-collapsible={isAboutLong} class:is-expanded={isAboutExpanded}>
        {#if isViewer}
          <a class="btn btn-sm edit" href="#{aboutEditorPath}">
            <Icon name="edit" size={14} />
            Modifier
          </a>
        {/if}
        {#if user.about}
          <div class="rich-text" bind:clientHeight={aboutHeight}>{@html renderAniListMarkdown(user.about)}</div>
        {:else}
          <p class="empty">Ton dossier est encore vierge. Écris quelques lignes pour te présenter aux autres détectives !</p>
        {/if}
        {#if isAboutLong}
          <button class="btn btn-ghost btn-sm toggle" type="button" onclick={() => (isAboutExpanded = !isAboutExpanded)}>
            {isAboutExpanded ? 'Voir moins' : 'Lire la suite'}
          </button>
        {/if}
      </section>
    {/if}

    <div class="stats">
      {#each [['anime', user.statistics.anime], ['manga', user.statistics.manga]] as const as [type, stats] (type)}
        <div class="card stat-group">
          {#each statTiles(stats, type) as [label, value] (label)}
            <div class="tile">
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          {/each}
        </div>
      {/each}
    </div>

    <div class="columns">
      <div>
        {#if user.statistics.anime.genres.length}
          <Section title="Genres préférés">
            <div class="genres">
              {#each user.statistics.anime.genres as genre (genre.genre)}
                <a class="chip" href="#/search/anime?genre={encodeURIComponent(genre.genre)}">{genre.genre} <span class="faint">{genre.count}</span></a>
              {/each}
            </div>
          </Section>
        {/if}

        {#each [['Anime favoris', user.favourites.anime.nodes], ['Manga favoris', user.favourites.manga.nodes]] as const as [title, nodes] (title)}
          {#if nodes.length}
            <Section {title}>
              <div class="media-grid">
                {#each nodes as media (media.id)}<MediaCard {media} />{/each}
              </div>
            </Section>
          {/if}
        {/each}

        {#each [['Personnages favoris', user.favourites.characters.nodes, characterPath], ['Créateurs favoris', user.favourites.staff.nodes, staffPath]] as const as [title, nodes, pathFor] (title)}
          {#if nodes.length}
            <Section {title}>
              <div class="people">
                {#each nodes as person (person.id)}
                  <a href="#{pathFor(person.id)}" title={person.name.userPreferred}>
                    <img src={person.image.medium} alt="" loading="lazy" />
                    <span>{person.name.userPreferred}</span>
                  </a>
                {/each}
              </div>
            </Section>
          {/if}
        {/each}

        {#if user.favourites.studios.nodes.length}
          <Section title="Studios favoris">
            <div class="genres">
              {#each user.favourites.studios.nodes as studio (studio.id)}
                <a class="chip" href="#{studioPath(studio.id)}">{studio.name}</a>
              {/each}
            </div>
          </Section>
        {/if}
      </div>

      <aside>
        <Section title="Dernières nouvelles">
          <ActivityFeed load={(page) => fetchUserActivity(user.id, page)} emptyMessage="Aucune nouvelle récente." />
        </Section>
      </aside>
    </div>
  </div>
{:catch error}
  <EmptyState title="Profil introuvable" message={error.message} />
{/await}

<style>
  .banner {
    display: flex;
    align-items: flex-end;
    min-height: 220px;
    border-bottom: var(--outline);
    background: var(--screentone), var(--colorMauve);
  }

  .banner.has-image {
    background: var(--screentone), var(--banner) center / cover;
  }

  .identity {
    display: flex;
    align-items: flex-end;
    gap: var(--space4);
    width: 100%;
    max-width: var(--contentMaxWidth);
    margin: 0 auto;
    padding: var(--space5) clamp(24px, 3vw, 56px);
  }

  .identity img {
    width: 110px;
    height: 110px;
    margin-bottom: -40px;
    border: var(--outline);
    border-radius: var(--radiusSticker);
    box-shadow: var(--stickerShadow);
    object-fit: cover;
    transform: rotate(-4deg);
  }

  .identity h1 {
    padding: 2px 16px;
    border: var(--outline);
    border-radius: var(--radiusSticker);
    background: var(--colorPaper);
    box-shadow: var(--stickerShadow);
    font-size: var(--fontSizeXl);
  }

  /* <-- « Suivre » reste collé au nom ; le lien AniList part tout à droite --> */
  .anilist {
    margin-left: auto;
  }

  /* <-- Les présentations peuvent être très longues et pleines d'images : elles commencent repliées --> */
  .about {
    position: relative;
    margin-bottom: var(--space5);
    padding: var(--space4) var(--space5);
    overflow: hidden;
    color: var(--textSoft);
  }

  .about.is-collapsible {
    max-height: 360px;
    padding-bottom: var(--space6);
  }

  .about.is-expanded {
    max-height: none;
  }

  /* <-- Le bouton flotte en haut à droite : le texte s'écoule autour au lieu de passer dessous --> */
  .edit {
    position: relative;
    z-index: 1;
    float: right;
    margin: 0 0 var(--space2) var(--space3);
  }

  .empty {
    font-family: var(--fontHand);
    font-size: var(--fontSizeLg);
  }

  .about .toggle {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    width: 100%;
    border-radius: 0;
    background: linear-gradient(transparent, var(--colorPaper) 60%);
  }

  .columns {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 360px;
    gap: var(--space6);
  }

  @media (max-width: 1180px) {
    .columns {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
    gap: var(--space4);
    margin-bottom: var(--space6);
  }

  .stat-group {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
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

  .genres {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space2);
  }

  .people {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: var(--space4);
  }

  .people a {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: var(--fontSizeXs);
    font-weight: 800;
    text-align: center;
  }

  .people a {
    padding: 5px 5px 8px;
    border: var(--outline);
    background: var(--colorPaper);
    box-shadow: var(--stickerShadow);
    transition: transform 0.25s var(--easeSpring);
  }

  .people a:nth-child(odd) {
    transform: rotate(-2deg);
  }

  .people a:hover {
    transform: rotate(0deg) scale(1.05);
  }

  .people img {
    width: 100%;
    aspect-ratio: 2 / 3;
    border: var(--outlineThin);
    object-fit: cover;
  }

  .people a:hover span {
    color: var(--textSoft);
  }
</style>
