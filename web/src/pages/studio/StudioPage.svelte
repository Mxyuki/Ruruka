<script lang="ts">
  import { fetchStudio } from '../../api/queries/people';
  import EmptyState from '../../components/EmptyState.svelte';
  import LoadingState from '../../components/LoadingState.svelte';
  import MediaCard from '../../components/MediaCard.svelte';
  import PageHeader from '../../components/PageHeader.svelte';
  import { formatEnum } from '../../lib/format';
  import type { RouteParams } from '../../lib/router.svelte';

  let { params }: { params: RouteParams } = $props();
  const studio = $derived(fetchStudio(Number(params.id)));
</script>

{#await studio}
  <LoadingState />
{:then studio}
  <div class="page">
    <PageHeader
      title={studio.name}
      note="{studio.isAnimationStudio ? 'Studio d’animation' : 'Producteur'} · {studio.favourites.toLocaleString('fr-FR')} favoris · {studio.media.length} titres"
    />
    <div class="media-grid">
      {#each studio.media as media (media.id)}
        <MediaCard {media} subtitle={[media.seasonYear, formatEnum(media.format)].filter(Boolean).join(' · ')} />
      {/each}
    </div>
  </div>
{:catch error}
  <EmptyState title="Studio introuvable" message={error.message} />
{/await}

