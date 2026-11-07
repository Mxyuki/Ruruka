<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchActivity, type Activity } from '../../api/queries/activity';
  import ActivityCard from '../../components/ActivityCard.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import LoadingState from '../../components/LoadingState.svelte';
  import PageHeader from '../../components/PageHeader.svelte';
  import { back, router, type RouteParams } from '../../lib/router.svelte';
  import { session } from '../../state/session.svelte';
  import { toasts } from '../../state/toasts.svelte';

  let { params }: { params: RouteParams } = $props();

  let activity = $state<Activity | null>(null);
  let isLoading = $state(true);
  const focusedReplyId = Number(router.query().get('reply')) || null;

  onMount(async () => {
    try {
      activity = await fetchActivity(Number(params.id), session.scoreFormat);
    } catch (error) {
      toasts.error(error, 'Impossible de charger cette activité');
    } finally {
      isLoading = false;
    }
  });
</script>

<div class="page narrow">
  <PageHeader title="Témoignage" note="Une piste du carnet" />

  {#if activity}
    <div class="card">
      <ActivityCard bind:activity expanded {focusedReplyId} ondeleted={back} />
    </div>
  {:else if isLoading}
    <LoadingState />
  {:else}
    <EmptyState title="Piste perdue" message="Cette activité n'existe plus." />
  {/if}
</div>

<style>
  .narrow {
    max-width: 860px;
  }
</style>
