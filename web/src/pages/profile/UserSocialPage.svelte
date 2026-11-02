<script lang="ts">
  import { fetchRelation, type Relation, type SocialUser } from '../../api/queries/social';
  import { fetchUserProfile, toggleFollow } from '../../api/queries/user';
  import EmptyState from '../../components/EmptyState.svelte';
  import LoadingState from '../../components/LoadingState.svelte';
  import UserCard from '../../components/UserCard.svelte';
  import type { RouteParams } from '../../lib/router.svelte';
  import { session } from '../../state/session.svelte';
  import { toasts } from '../../state/toasts.svelte';
  import ProfileTabs from './ProfileTabs.svelte';

  let { params }: { params: RouteParams } = $props();

  type Filter = 'all' | 'shared';

  const viewerId = session.viewer?.id ?? 0;
  const name = $derived(params.name ?? '');

  // <-- Ses deux listes et les tiennes, pour repérer les détectives que vous connaissez tous les deux -->
  const relations = $derived(
    fetchUserProfile(name).then(async (user) => {
      const [following, followers, myFollowing, myFollowers] = await Promise.all([
        fetchRelation(user.id, 'following'),
        fetchRelation(user.id, 'followers'),
        fetchRelation(viewerId, 'following'),
        fetchRelation(viewerId, 'followers'),
      ]);
      return { user, following, followers, myFollowingIds: new Set(myFollowing.map(({ id }) => id)), myFollowerIds: new Set(myFollowers.map(({ id }) => id)) };
    }),
  );

  let relation = $state<Relation>('following');
  let filter = $state<Filter>('all');
  // <-- Abonnements changés depuis cette page, par-dessus ta liste chargée -->
  let followOverrides = $state<Record<number, boolean>>({});

  const relationLabels: Record<Relation, string> = { following: 'Suivis', followers: 'Abonnés' };

  function isFollowedByMe(user: SocialUser, myFollowingIds: Set<number>): boolean {
    return followOverrides[user.id] ?? myFollowingIds.has(user.id);
  }

  function badgeFor(user: SocialUser, myFollowingIds: Set<number>, myFollowerIds: Set<number>): string | null {
    if (user.id === viewerId) return 'C’est toi';
    const isFollowed = isFollowedByMe(user, myFollowingIds);
    if (isFollowed && myFollowerIds.has(user.id)) return 'Ami mutuel';
    if (isFollowed) return 'Tu le suis';
    return myFollowerIds.has(user.id) ? 'Te suit' : null;
  }

  async function toggle(user: SocialUser) {
    try {
      followOverrides[user.id] = await toggleFollow(user.id, user.name);
    } catch (error) {
      toasts.error(error, 'Impossible de modifier l’abonnement');
    }
  }
</script>

{#await relations}
  <div class="page"><LoadingState /></div>
{:then { user, following, followers, myFollowingIds, myFollowerIds }}
  {@const isShared = (other: SocialUser) => other.id === viewerId || myFollowingIds.has(other.id) || myFollowerIds.has(other.id)}
  {@const lists = { following, followers }}
  {@const listed = filter === 'shared' ? lists[relation].filter(isShared) : lists[relation]}
  <div class="page">
    <ProfileTabs name={user.name} avatar={user.avatar.medium} />

    <div class="tabs">
      {#each Object.entries(relationLabels) as [value, label] (value)}
        <button class="chip" class:is-active={relation === value} type="button" onclick={() => (relation = value as Relation)}>
          {label} <span class="faint">{lists[value as Relation].length}</span>
        </button>
      {/each}
    </div>

    <div class="tabs">
      <button class="chip small" class:is-active={filter === 'all'} type="button" onclick={() => (filter = 'all')}>Tous</button>
      <button class="chip small" class:is-active={filter === 'shared'} type="button" onclick={() => (filter = 'shared')}>
        En commun avec toi <span class="faint">{lists[relation].filter(isShared).length}</span>
      </button>
    </div>

    {#if listed.length}
      <div class="users">
        {#each listed as other (other.id)}
          <UserCard
            user={other}
            badge={badgeFor(other, myFollowingIds, myFollowerIds)}
            isFollowing={isFollowedByMe(other, myFollowingIds)}
            ontoggle={other.id === viewerId ? undefined : () => toggle(other)}
          />
        {/each}
      </div>
    {:else}
      <EmptyState
        title="Personne ici"
        message={filter === 'shared' ? `Aucun détective que vous connaissez tous les deux parmi ses ${relationLabels[relation].toLowerCase()}.` : 'Cette liste est vide.'}
      />
    {/if}
  </div>
{:catch error}
  <EmptyState title="Dossier introuvable" message={error.message} />
{/await}

<style>
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space2);
    margin-bottom: var(--space4);
  }

  .chip {
    border: 0;
    cursor: pointer;
  }

  .chip.small {
    padding: 2px 10px;
    font-size: var(--fontSizeXs);
  }

  .users {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--space3);
  }
</style>
