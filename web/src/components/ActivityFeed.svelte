<script lang="ts">
  import { onMount } from 'svelte';
  import type { Activity, ActivityPage } from '../api/queries/activity';
  import { toasts } from '../state/toasts.svelte';
  import ActivityCard from './ActivityCard.svelte';
  import LoadingState from './LoadingState.svelte';

  interface Props {
    load: (page: number) => Promise<ActivityPage>;
    emptyMessage: string;
    /** Shows only this many items, in the compact layout, with a "See all" link instead of paging. */
    preview?: { count: number; href: string };
  }

  let { load, emptyMessage, preview }: Props = $props();

  let activities = $state<Activity[]>([]);
  let page = $state(0);
  let hasNextPage = $state(true);
  let isLoading = $state(false);

  const visibleCount = $derived(preview ? Math.min(preview.count, activities.length) : activities.length);

  onMount(loadMore);

  /** Adds an activity the viewer just posted to the top of the feed. */
  export function prepend(activity: Activity): void {
    activities.unshift(activity);
  }

  async function loadMore() {
    isLoading = true;
    try {
      const result = await load(page + 1);
      const seen = new Set(activities.map((activity) => activity.id));
      activities.push(...result.activities.filter((activity) => !seen.has(activity.id)));
      page = result.pageInfo.currentPage;
      hasNextPage = result.pageInfo.hasNextPage;
    } catch (error) {
      toasts.error(error, 'Impossible de charger les nouvelles');
    } finally {
      isLoading = false;
    }
  }
</script>

{#if activities.length}
  <div class="card feed">
    {#each activities.slice(0, visibleCount) as activity, index (activity.id)}
      <ActivityCard bind:activity={activities[index]!} compact={Boolean(preview)} />
    {/each}
  </div>
  {#if preview}
    <a class="btn btn-ghost btn-sm more" href={preview.href}>Toutes les nouvelles</a>
  {:else if hasNextPage}
    <button class="btn btn-ghost more" type="button" disabled={isLoading} onclick={loadMore}>
      {isLoading ? 'Chargement…' : 'Plus anciennes'}
    </button>
  {/if}
{:else if isLoading}
  <LoadingState />
{:else}
  <p class="faint">{emptyMessage}</p>
{/if}

<style>
  .feed {
    overflow: hidden;
  }

  .more {
    width: 100%;
    margin-top: var(--space2);
  }
</style>
