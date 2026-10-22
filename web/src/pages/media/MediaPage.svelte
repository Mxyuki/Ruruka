<script lang="ts">
  import { fetchFollowing, fetchMedia, type FollowingEntry } from '../../api/queries/media';
  import EmptyState from '../../components/EmptyState.svelte';
  import LoadingState from '../../components/LoadingState.svelte';
  import MediaCard from '../../components/MediaCard.svelte';
  import Section from '../../components/Section.svelte';
  import { sanitizeHtml } from '../../lib/html';
  import type { RouteParams } from '../../lib/router.svelte';
  import CharactersSection from './CharactersSection.svelte';
  import DashboardSection from './DashboardSection.svelte';
  import EpisodesSection from './EpisodesSection.svelte';
  import MediaHeader from './MediaHeader.svelte';
  import RelationsSection from './RelationsSection.svelte';
  import StaffSection from './StaffSection.svelte';
  import TagsSection from './TagsSection.svelte';
  import TrailerSection from './TrailerSection.svelte';

  let { params }: { params: RouteParams } = $props();

  const id = $derived(Number(params.id));
  const details = $derived(fetchMedia(id));
  // <-- Les notes des amis sont un bonus : la page s'affiche même si elles échouent -->
  const following = $derived(fetchFollowing(id).catch((): FollowingEntry[] => []));
</script>

{#await Promise.all([details, following])}
  <LoadingState />
{:then [media, friends]}
  <MediaHeader {media} {friends} />

  <div class="page content">
    {#if media.description}
      <section class="description rich-text">{@html sanitizeHtml(media.description)}</section>
    {/if}

    {#if media.type === 'ANIME'}
      <EpisodesSection {media} />
    {/if}

    {#if media.relations.length}
      <RelationsSection relations={media.relations} />
    {/if}

    {#if media.characters.length}
      <CharactersSection characters={media.characters} />
    {/if}

    {#if media.staff.length}
      <StaffSection staff={media.staff} />
    {/if}

    <DashboardSection {media} {friends} />

    {#if media.tags.length}
      <TagsSection tags={media.tags} type={media.type} />
    {/if}

    {#if media.trailer}
      <TrailerSection trailer={media.trailer} />
    {/if}

    {#if media.recommendations.length}
      <Section title="Pistes similaires">
        <div class="media-grid">
          {#each media.recommendations as recommendation (recommendation.id)}
            <MediaCard media={recommendation} />
          {/each}
        </div>
      </Section>
    {/if}
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
