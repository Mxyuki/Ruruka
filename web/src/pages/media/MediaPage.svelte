<script lang="ts">
  import { tick } from 'svelte';
  import { fetchFollowing, fetchMedia, type FollowingEntry } from '../../api/queries/media';
  import EmptyState from '../../components/EmptyState.svelte';
  import LoadingState from '../../components/LoadingState.svelte';
  import MediaCard from '../../components/MediaCard.svelte';
  import Section from '../../components/Section.svelte';
  import { sanitizeHtml } from '../../lib/html';
  import { orderSections } from '../../lib/mediaSections';
  import type { RouteParams } from '../../lib/router.svelte';
  import { session } from '../../state/session.svelte';
  import ChaptersSection from './ChaptersSection.svelte';
  import CharactersSection from './CharactersSection.svelte';
  import DashboardSection from './DashboardSection.svelte';
  import EpisodesSection from './EpisodesSection.svelte';
  import MediaHeader from './MediaHeader.svelte';
  import RelationsSection from './RelationsSection.svelte';
  import SongsSection from './SongsSection.svelte';
  import StaffSection from './StaffSection.svelte';
  import TagsSection from './TagsSection.svelte';
  import TrailerSection from './TrailerSection.svelte';

  let { params }: { params: RouteParams } = $props();

  const id = $derived(Number(params.id));
  const details = $derived(fetchMedia(id));
  // <-- Les notes des amis sont un bonus : la page s'affiche même si elles échouent -->
  const following = $derived(fetchFollowing(id).catch((): FollowingEntry[] => []));
  const sectionOrder = $derived(orderSections(session.settings?.mediaSectionOrder ?? []));
  let isChaptersOpen = $state(false);

  // <-- Le bouton « Chapitres » du dossier ouvre la liste des chapitres et y descend -->
  async function openChapters() {
    isChaptersOpen = true;
    await tick();
    document.getElementById('chapters-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
</script>

{#await Promise.all([details, following])}
  <LoadingState />
{:then [media, friends]}
  <MediaHeader {media} {friends} onread={openChapters} />

  <!-- Les sections suivent l'ordre choisi dans les réglages -->
  <div class="page content">
    {#each sectionOrder as section (section)}
      {#if section === 'description' && media.description}
        <section class="description rich-text">{@html sanitizeHtml(media.description)}</section>
      {:else if section === 'episodes' && media.type === 'ANIME'}
        <EpisodesSection {media} />
      {:else if section === 'chapters' && media.type === 'MANGA' && session.mangaSite}
        <ChaptersSection {media} bind:isOpen={isChaptersOpen} />
      {:else if section === 'relations' && media.relations.length}
        <RelationsSection relations={media.relations} />
      {:else if section === 'characters' && media.characters.length}
        <CharactersSection characters={media.characters} />
      {:else if section === 'staff' && media.staff.length}
        <StaffSection staff={media.staff} />
      {:else if section === 'dashboard'}
        <DashboardSection {media} {friends} />
      {:else if section === 'tags' && media.tags.length}
        <TagsSection tags={media.tags} type={media.type} />
      {:else if section === 'songs' && media.type === 'ANIME'}
        <SongsSection {media} />
      {:else if section === 'trailer' && media.trailer}
        <TrailerSection trailer={media.trailer} />
      {:else if section === 'recommendations' && media.recommendations.length}
        <Section title="Pistes similaires">
          <div class="media-grid">
            {#each media.recommendations as recommendation (recommendation.id)}
              <MediaCard media={recommendation} />
            {/each}
          </div>
        </Section>
      {/if}
    {/each}
  </div>
{:catch error}
  <EmptyState title="Impossible d'ouvrir ce dossier" message={error.message} />
{/await}

<style>
  .content {
    padding-top: var(--space5);
  }

  .description {
    max-width: 900px;
    margin-bottom: var(--space6);
    color: var(--textSoft);
    line-height: 1.7;
  }
</style>
