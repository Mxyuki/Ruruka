<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchFriendActivity, postStatus } from '../../api/queries/activity';
  import { fetchRelation, type SocialUser } from '../../api/queries/social';
  import { toggleFollow } from '../../api/queries/user';
  import ActivityFeed from '../../components/ActivityFeed.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import LoadingState from '../../components/LoadingState.svelte';
  import PageHeader from '../../components/PageHeader.svelte';
  import Sticker from '../../components/Sticker.svelte';
  import TextComposer from '../../components/TextComposer.svelte';
  import { userPath } from '../../lib/routes';
  import { session } from '../../state/session.svelte';
  import { toasts } from '../../state/toasts.svelte';
  import UserCard from './UserCard.svelte';

  type Tab = 'activity' | 'following' | 'followers';
  type Filter = 'all' | 'mutual' | 'oneWay';

  const viewerId = session.viewer?.id ?? 0;

  let tab = $state<Tab>('activity');
  let filter = $state<Filter>('all');
  let following = $state<SocialUser[]>([]);
  let followers = $state<SocialUser[]>([]);
  let isLoading = $state(true);
  let feed = $state<ActivityFeed>();

  const followingIds = $derived(new Set(following.map((user) => user.id)));
  const followerIds = $derived(new Set(followers.map((user) => user.id)));

  const filterLabels: Record<Exclude<Tab, 'activity'>, Record<Filter, string>> = {
    following: { all: 'Tous', mutual: 'Te suivent aussi', oneWay: 'Ne te suivent pas' },
    followers: { all: 'Tous', mutual: 'Tu les suis aussi', oneWay: 'Tu ne les suis pas' },
  };

  const listed = $derived.by(() => {
    if (tab === 'activity') return [];
    const users = tab === 'following' ? following : followers;
    const otherSide = tab === 'following' ? followerIds : followingIds;
    if (filter === 'mutual') return users.filter((user) => otherSide.has(user.id));
    if (filter === 'oneWay') return users.filter((user) => !otherSide.has(user.id));
    return users;
  });

  onMount(async () => {
    try {
      [following, followers] = await Promise.all([fetchRelation(viewerId, 'following'), fetchRelation(viewerId, 'followers')]);
    } catch (error) {
      toasts.error(error, 'Impossible de charger tes amis');
    } finally {
      isLoading = false;
    }
  });

  const mutualCount = $derived(following.filter((user) => followerIds.has(user.id)).length);

  async function post(text: string) {
    try {
      feed?.prepend(await postStatus(text));
      toasts.success('C’est publié !');
    } catch (error) {
      toasts.error(error, 'Impossible de publier');
      throw error;
    }
  }

  function selectTab(next: Tab) {
    tab = next;
    filter = 'all';
  }

  async function toggle(user: SocialUser) {
    try {
      const isNowFollowing = await toggleFollow(user.id, user.name);
      following = isNowFollowing
        ? [...following, user].sort((a, b) => a.name.localeCompare(b.name))
        : following.filter((followed) => followed.id !== user.id);
    } catch (error) {
      toasts.error(error, 'Impossible de modifier l’abonnement');
    }
  }
</script>

<div class="page">
  <PageHeader
    title="Les amis"
    note={isLoading ? undefined : `${following.length} suivis · ${followers.length} abonnés · ${mutualCount} amis mutuels`}
  />

  <div class="tabs">
    <button class="chip" class:is-active={tab === 'activity'} type="button" onclick={() => selectTab('activity')}>Nouvelles</button>
    <button class="chip" class:is-active={tab === 'following'} type="button" onclick={() => selectTab('following')}>
      Suivis <span class="faint">{following.length}</span>
    </button>
    <button class="chip" class:is-active={tab === 'followers'} type="button" onclick={() => selectTab('followers')}>
      Abonnés <span class="faint">{followers.length}</span>
    </button>
  </div>

  {#if tab === 'activity'}
    <div class="activity-layout">
      <div class="feed">
        <div class="card composer">
          <TextComposer placeholder="Partage un indice avec tes amis…" submitLabel="Publier" avatar={session.viewer?.avatar.medium} onsubmit={post} />
        </div>
        <ActivityFeed bind:this={feed} load={(page) => fetchFriendActivity(viewerId, page)} emptyMessage="Pas de nouvelles de tes amis pour l'instant." />
      </div>

      <aside class="card agency">
        <Sticker name="coeur" size={58} rotate={12} position="top: -24px; right: -18px" />
        <h2 class="note-label">Mon agence</h2>
        <div class="tallies">
          <button type="button" onclick={() => selectTab('following')}><strong>{following.length}</strong><span>Suivis</span></button>
          <button type="button" onclick={() => selectTab('followers')}><strong>{followers.length}</strong><span>Abonnés</span></button>
          <div><strong>{mutualCount}</strong><span>Mutuels</span></div>
        </div>
        {#if followers.length}
          <h3 class="note-label" >Mes abonnés</h3>
          <div class="faces">
            {#each followers.slice(0, 12) as user (user.id)}
              <a href="#{userPath(user.name)}" title={user.name}><img src={user.avatar.medium} alt={user.name} loading="lazy" /></a>
            {/each}
          </div>
        {/if}
      </aside>
    </div>
  {:else if isLoading}
    <LoadingState />
  {:else}
    <div class="filters">
      {#each Object.entries(filterLabels[tab]) as [value, label] (value)}
        <button class="chip small" class:is-active={filter === value} type="button" onclick={() => (filter = value as Filter)}>{label}</button>
      {/each}
    </div>

    {#if listed.length}
      <div class="users">
        {#each listed as user (user.id)}
          <UserCard
            {user}
            badge={tab === 'following' ? (followerIds.has(user.id) ? 'Te suit' : null) : followingIds.has(user.id) ? 'Mutuel' : null}
            isFollowing={followingIds.has(user.id)}
            ontoggle={() => toggle(user)}
          />
        {/each}
      </div>
    {:else}
      <EmptyState title="Personne ici" message="Personne ne correspond à ce filtre." />
    {/if}
  {/if}
</div>

<style>
  .tabs,
  .filters {
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

  .activity-layout {
    display: grid;
    grid-template-columns: minmax(0, 900px) minmax(260px, 340px);
    align-items: start;
    gap: var(--space6);
  }

  @media (max-width: 1180px) {
    .activity-layout {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .agency {
    position: sticky;
    top: var(--space5);
    padding: var(--space4) var(--space5);
  }

  .tallies {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space2);
    margin-bottom: var(--space5);
  }

  .tallies > * {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space3) 0;
    border: 1px solid var(--colorLine);
    border-radius: var(--radiusSmall);
    background: var(--colorSunken);
  }

  .tallies button {
    cursor: pointer;
    transition: border-color var(--transitionFast);
  }

  .tallies button:hover {
    border-color: var(--textSoft);
  }

  .tallies strong {
    color: var(--textSoft);
    font-size: var(--fontSizeXl);
    line-height: 1.1;
  }

  .tallies span {
    color: var(--textFaint);
    font-size: var(--fontSizeXs);
    font-weight: 700;
    text-transform: uppercase;
  }

  .faces {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: var(--space2);
  }

  .faces img {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 50%;
    object-fit: cover;
    transition: transform 0.25s var(--easeSpring);
  }

  .faces a:hover img {
    transform: scale(1.12);
  }

  .feed {
    display: flex;
    flex-direction: column;
    gap: var(--space4);
  }

  .composer {
    padding: var(--space3) var(--space4);
  }

  .users {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--space3);
  }
</style>
