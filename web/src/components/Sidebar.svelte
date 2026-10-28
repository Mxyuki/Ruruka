<script lang="ts">
  import { isActive } from '../lib/router.svelte';
  import { userPath } from '../lib/routes';
  import { playback } from '../state/playback.svelte';
  import { session } from '../state/session.svelte';
  import Icon, { type IconName } from './Icon.svelte';
  import Kira from './Kira.svelte';

  interface NavItem {
    label: string;
    path: string;
    icon: IconName;
    badge?: number;
  }

  const navigation: NavItem[] = $derived([
    { label: 'Accueil', path: '/', icon: 'home' },
    { label: 'Mes anime', path: '/list/anime', icon: 'tv' },
    { label: 'Mes manga', path: '/list/manga', icon: 'book' },
    { label: 'Explorer', path: '/search/anime', icon: 'search' },
    { label: 'Personnes', path: '/people', icon: 'user' },
    { label: 'Amis', path: '/social', icon: 'users' },
    { label: 'Bibliothèque', path: '/library', icon: 'folder' },
    { label: 'Nouvelles', path: '/notifications', icon: 'bell', badge: session.viewer?.unreadNotificationCount },
  ]);
</script>

<!-- Reliure du carnet : un onglet par page -->
<nav class="spine">
  <a class="brand" href="#/" title="Accueil">
    <img src="./ruruka.png" alt="" width="38" height="38" />
    <span class="wordmark">Ruruka<Kira size={15} /></span>
  </a>

  <ul>
    {#each navigation as item (item.path)}
      {@const active = isActive(item.path)}
      <li>
        <a class="tab" href="#{item.path}" class:is-active={active} aria-current={active ? 'page' : undefined}>
          <Icon name={item.icon} size={17} />
          <span class="label">{item.label}</span>
          {#if item.badge}<span class="badge">{item.badge}</span>{/if}
        </a>
      </li>
    {/each}
  </ul>

  <div class="footer">
    {#if playback.nowPlaying}
      <a class="now-playing" href="#/media/{playback.nowPlaying.media.id}">
        <Icon name="play" size={14} filled />
        <span>
          <small>En lecture · ép. {playback.nowPlaying.episode}</small>
          {playback.nowPlaying.media.title.userPreferred}
        </span>
      </a>
    {/if}

    {#if session.viewer}
      <div class="account">
        <a class="pill" href="#{userPath(session.viewer.name)}" class:is-active={isActive('/user/')}>
          <img src={session.viewer.avatar.medium} alt="" width="30" height="30" />
          <span>{session.viewer.name}</span>
        </a>
        <a class="pill settings" href="#/settings" class:is-active={isActive('/settings')} aria-label="Réglages" title="Réglages">
          <Icon name="settings" />
        </a>
      </div>
    {/if}
  </div>
</nav>

<style>
  .spine {
    display: flex;
    flex-direction: column;
    gap: var(--space4);
    width: var(--sidebarWidth);
    height: 100%;
    padding: var(--space5) 0 var(--space4) var(--space3);
    border-right: var(--outline);
    background: var(--colorMauve);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: var(--space2);
    padding: 0 var(--space2) var(--space2);
  }

  .brand img {
    transition: transform 0.4s var(--easeSpring);
  }

  .brand:hover img {
    transform: rotate(-10deg) scale(1.08);
  }

  .wordmark {
    display: inline-flex;
    align-items: flex-start;
    gap: 2px;
    font-family: var(--fontTitle);
    font-size: 2.6rem;
    line-height: 1;
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* <-- Onglets : l'actif se raccroche à la page, les autres restent glissés dans la reliure --> */
  .tab {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space3);
    padding: 8px var(--space3);
    border: 2px solid transparent;
    border-right: 0;
    border-radius: var(--radiusSticker) 0 0 var(--radiusSticker);
    color: var(--textSoft);
    font-weight: 800;
    transition: background var(--transitionFast), transform 0.2s var(--easeSpring);
  }

  .tab:hover {
    background: var(--colorMauveSoft);
    color: var(--textMain);
    transform: translateX(3px);
  }

  .tab.is-active {
    z-index: 1;
    margin-right: -2px;
    border-color: var(--colorInk);
    background: var(--colorMilk);
    color: var(--textMain);
    transform: none;
  }

  .tab.is-active::before {
    content: '';
    position: absolute;
    left: -8px;
    width: 13px;
    height: 13px;
    border: var(--outline);
    border-radius: 50%;
    background: var(--colorStrawberry);
  }

  .label {
    flex: 1;
  }

  .badge {
    min-width: 22px;
    margin-right: var(--space2);
    padding: 0 6px;
    border: var(--outlineThin);
    border-radius: var(--radiusPill);
    background: var(--colorStrawberry);
    font-family: var(--fontTitle);
    font-size: 1.1rem;
    text-align: center;
  }

  .footer {
    display: flex;
    flex-direction: column;
    gap: var(--space2);
    margin-top: auto;
    padding-right: var(--space3);
  }

  .now-playing {
    display: flex;
    align-items: center;
    gap: var(--space2);
    padding: var(--space2) var(--space3);
    border: var(--outline);
    border-radius: var(--radiusSticker);
    background: var(--colorStar);
    box-shadow: 2px 2px 0 var(--colorInk);
    font-size: var(--fontSizeSm);
    font-weight: 800;
  }

  .now-playing span {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .now-playing small {
    font-family: var(--fontHand);
    font-size: 1.5rem;
    font-weight: 400;
  }

  .account {
    display: flex;
    gap: var(--space1);
  }

  .pill {
    display: flex;
    align-items: center;
    gap: var(--space2);
    min-width: 0;
    padding: 6px var(--space2);
    border: 2px solid transparent;
    border-radius: var(--radiusSticker);
    color: var(--textSoft);
    font-weight: 800;
  }

  .pill:first-child {
    flex: 1;
  }

  .pill:hover {
    background: var(--colorMauveSoft);
    color: var(--textMain);
  }

  .pill.is-active {
    border-color: var(--colorInk);
    background: var(--colorMilk);
    color: var(--textMain);
  }

  .pill span {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pill img {
    border: var(--outlineThin);
    border-radius: 50%;
  }
</style>
