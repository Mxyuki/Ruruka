<script lang="ts">
  import { fetchUserReviews, type Review } from '../../api/queries/review';
  import { fetchUserProfile, type UserProfile } from '../../api/queries/user';
  import EmptyState from '../../components/EmptyState.svelte';
  import LoadingState from '../../components/LoadingState.svelte';
  import type { RouteParams } from '../../lib/router.svelte';
  import { toasts } from '../../state/toasts.svelte';
  import ProfileTabs from './ProfileTabs.svelte';
  import ReviewCard from './ReviewCard.svelte';

  let { params }: { params: RouteParams } = $props();

  let user = $state<UserProfile | null>(null);
  let reviews = $state<Review[]>([]);
  let page = $state(0);
  let hasNextPage = $state(false);
  let isLoading = $state(true);
  let loadError = $state<string | null>(null);

  // <-- Le profil d'abord (pour son id), puis la première page de critiques -->
  $effect(() => {
    const name = params.name ?? '';
    let isCurrent = true;
    fetchUserProfile(name)
      .then(async (profile) => {
        const first = await fetchUserReviews(profile.id, 1);
        if (!isCurrent) return;
        user = profile;
        reviews = first.reviews;
        page = 1;
        hasNextPage = first.pageInfo.hasNextPage;
      })
      .catch((error: unknown) => {
        if (isCurrent) loadError = error instanceof Error ? error.message : String(error);
      })
      .finally(() => {
        if (isCurrent) isLoading = false;
      });
    return () => {
      isCurrent = false;
    };
  });

  async function loadMore() {
    if (!user || isLoading) return;
    isLoading = true;
    try {
      const next = await fetchUserReviews(user.id, page + 1);
      reviews = [...reviews, ...next.reviews];
      page += 1;
      hasNextPage = next.pageInfo.hasNextPage;
    } catch (error) {
      toasts.error(error, 'Impossible de charger plus de critiques');
    } finally {
      isLoading = false;
    }
  }
</script>

{#if loadError}
  <EmptyState title="Critiques introuvables" message={loadError} />
{:else if !user}
  <div class="page"><LoadingState /></div>
{:else}
  <div class="page">
    <ProfileTabs name={user.name} avatar={user.avatar.medium} />

    {#if reviews.length}
      <div class="reviews">
        {#each reviews as review (review.id)}
          <ReviewCard {review} />
        {/each}
      </div>
      {#if hasNextPage}
        <button class="btn more" type="button" disabled={isLoading} onclick={loadMore}>{isLoading ? 'Chargement…' : 'Plus de critiques'}</button>
      {/if}
    {:else}
      <EmptyState title="Aucune critique" message="{user.name} n’a encore écrit aucune critique." />
    {/if}
  </div>
{/if}

<style>
  .reviews {
    display: flex;
    flex-direction: column;
    gap: var(--space4);
    max-width: 960px;
  }

  .more {
    margin-top: var(--space4);
  }
</style>
