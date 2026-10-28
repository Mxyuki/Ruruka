<script lang="ts">
  import { fetchNotifications, type AppNotification } from '../../api/queries/notifications';
  import EmptyState from '../../components/EmptyState.svelte';
  import LoadingState from '../../components/LoadingState.svelte';
  import PageHeader from '../../components/PageHeader.svelte';
  import { session } from '../../state/session.svelte';
  import { toasts } from '../../state/toasts.svelte';
  import NotificationItem from './NotificationItem.svelte';

  let notifications = $state<AppNotification[]>([]);
  let page = $state(0);
  let hasNextPage = $state(true);
  let isLoading = $state(false);

  void loadMore();

  async function loadMore() {
    isLoading = true;
    try {
      const result = await fetchNotifications(page + 1);
      notifications = [...notifications, ...result.notifications];
      page = result.pageInfo.currentPage;
      hasNextPage = result.pageInfo.hasNextPage;
      session.markNotificationsRead();
    } catch (error) {
      toasts.error(error, 'Impossible de charger les nouvelles');
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="page narrow">
  <PageHeader title="Nouvelles" note="Les derniers indices reçus" />

  {#if notifications.length}
    <ul class="card">
      {#each notifications as notification (notification.id)}
        <NotificationItem {notification} />
      {/each}
    </ul>
    {#if hasNextPage}
      <div class="more">
        <button class="btn" type="button" disabled={isLoading} onclick={loadMore}>{isLoading ? 'Chargement…' : 'Voir plus'}</button>
      </div>
    {/if}
  {:else if isLoading}
    <LoadingState />
  {:else}
    <EmptyState title="Aucun nouvel indice" message="Tu es à jour !" />
  {/if}
</div>

<style>
  .narrow {
    max-width: 860px;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .more {
    display: flex;
    justify-content: center;
    margin-top: var(--space4);
  }
</style>
