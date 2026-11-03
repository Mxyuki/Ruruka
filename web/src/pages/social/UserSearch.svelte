<script lang="ts">
  import { searchUsers, type SocialUser } from '../../api/queries/social';
  import Icon from '../../components/Icon.svelte';
  import { navigate } from '../../lib/router.svelte';
  import { userPath } from '../../lib/routes';
  import { toasts } from '../../state/toasts.svelte';

  interface Props {
    followingIds: Set<number>;
    followerIds: Set<number>;
  }

  let { followingIds, followerIds }: Props = $props();

  const searchDelayMs = 300;
  const minLength = 2;
  const listId = $props.id();
  let query = $state('');
  let results = $state<SocialUser[]>([]);
  let isOpen = $state(false);
  let isSearching = $state(false);
  let highlighted = $state(0);

  // <-- On attend une courte pause dans la frappe avant d'interroger AniList, pour ménager son quota -->
  $effect(() => {
    const search = query.trim();
    if (search.length < minLength) {
      results = [];
      return;
    }
    let isCurrent = true;
    const timer = setTimeout(async () => {
      isSearching = true;
      try {
        const found = await searchUsers(search);
        if (!isCurrent) return;
        results = found;
        highlighted = 0;
      } catch (error) {
        toasts.error(error, 'Impossible de chercher ce détective');
      } finally {
        if (isCurrent) isSearching = false;
      }
    }, searchDelayMs);
    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  });

  function badgeFor(user: SocialUser): string | null {
    const isFollowed = followingIds.has(user.id);
    const isFollower = followerIds.has(user.id);
    if (isFollowed && isFollower) return 'Ami·e mutuel·le';
    if (isFollowed) return 'Suivi·e';
    return isFollower ? 'Te suit' : null;
  }

  function open(user: SocialUser | undefined) {
    if (!user) return;
    isOpen = false;
    query = '';
    navigate(userPath(user.name));
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      isOpen = false;
      return;
    }
    if (!results.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      isOpen = true;
      highlighted = (highlighted + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      open(results[highlighted]);
    }
  }
</script>

<div class="search">
  <Icon name="search" size={16} />
  <input
    class="input"
    type="search"
    role="combobox"
    autocomplete="off"
    placeholder="Chercher un détective…"
    aria-label="Chercher quelqu’un sur AniList"
    aria-expanded={isOpen && results.length > 0}
    aria-controls={listId}
    bind:value={query}
    onfocus={() => (isOpen = true)}
    oninput={() => (isOpen = true)}
    onblur={() => (isOpen = false)}
    {onkeydown}
  />

  <!-- Fiche de suspects posée sous le champ -->
  {#if isOpen && query.trim().length >= minLength}
    <ul class="results" id={listId} role="listbox">
      {#each results as user, index (user.id)}
        {@const badge = badgeFor(user)}
        <li
          role="option"
          aria-selected={highlighted === index}
          class:is-highlighted={highlighted === index}
          onmousedown={(event) => {
            event.preventDefault();
            open(user);
          }}
          onmouseenter={() => (highlighted = index)}
        >
          <img src={user.avatar.medium} alt="" loading="lazy" />
          <span class="name">{user.name}</span>
          {#if badge}<span class="badge">{badge}</span>{/if}
        </li>
      {:else}
        <li class="none" role="presentation">{isSearching ? 'On fouille les archives…' : 'Personne à ce nom'}</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .search {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    color: var(--textFaint);
  }

  .search > :global(svg) {
    position: absolute;
    left: 12px;
    pointer-events: none;
  }

  .input {
    padding-left: 36px;
  }

  .results {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    left: 0;
    z-index: 20;
    margin: 0;
    padding: var(--space1);
    border: var(--outline);
    border-radius: var(--radiusSmall);
    background: var(--colorPaper);
    box-shadow: var(--stickerShadow);
    color: var(--textMain);
    list-style: none;
  }

  li {
    display: flex;
    align-items: center;
    gap: var(--space2);
    padding: 5px var(--space2);
    border-radius: var(--radiusSmall);
    cursor: pointer;
    font-size: var(--fontSizeSm);
  }

  li.is-highlighted {
    background: var(--colorMauveSoft);
  }

  li img {
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    border: var(--outlineThin);
    border-radius: 50%;
    object-fit: cover;
  }

  .name {
    overflow: hidden;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badge {
    margin-left: auto;
    padding: 0 8px;
    border-radius: var(--radiusPill);
    background: var(--colorBlond);
    font-size: var(--fontSizeXs);
    font-weight: 700;
    white-space: nowrap;
  }

  .none {
    color: var(--textFaint);
    cursor: default;
  }
</style>
