<script lang="ts">
  import { invoke } from '../lib/bridge';
  import { back, router } from '../lib/router.svelte';
  import { playback } from '../state/playback.svelte';
  import { session } from '../state/session.svelte';
  import { toasts } from '../state/toasts.svelte';
  import Icon, { type IconName } from './Icon.svelte';

  interface Props {
    /** Paints the left part like the sidebar spine that sits below it. */
    hasSpine: boolean;
  }

  let { hasSpine }: Props = $props();

  type WindowAction = 'window.close' | 'window.minimize' | 'window.toggleMaximize';

  const lights: { action: WindowAction; label: string; icon: IconName; color: string }[] = [
    { action: 'window.close', label: 'Fermer', icon: 'close', color: 'var(--colorStrawberry)' },
    { action: 'window.minimize', label: 'Réduire', icon: 'minus', color: 'var(--colorStar)' },
    { action: 'window.toggleMaximize', label: 'Agrandir', icon: 'plus', color: 'var(--colorSky)' },
  ];
  const doubleClickDelay = 350;

  const caption = $derived.by(() => {
    const playing = playback.nowPlaying;
    if (playing) return `En lecture · ${playing.media.title.userPreferred} · ép. ${playing.episode}`;
    return session.viewer ? `Le carnet d'enquête de ${session.viewer.name}` : 'Ruruka';
  });

  let lastPressAt = 0;

  function send(action: WindowAction | 'window.startDrag' | 'window.startResize') {
    invoke(action).catch((error) => toasts.error(error, 'La fenêtre ne répond pas'));
  }

  // <-- Glisser déplace la fenêtre, un double-clic l'agrandit, comme une vraie barre de titre -->
  function onPress(event: MouseEvent) {
    if (event.button !== 0 || (event.target as Element).closest('button')) return;
    const isDoubleClick = event.timeStamp - lastPressAt < doubleClickDelay;
    lastPressAt = event.timeStamp;
    send(isDoubleClick ? 'window.toggleMaximize' : 'window.startDrag');
  }
</script>

<!-- Barre de titre du carnet : pastilles à gauche, légende manuscrite au centre -->
<header class="title-bar" class:has-spine={hasSpine} onmousedown={onPress} role="presentation">
  <span class="grip" onmousedown={(event) => { event.stopPropagation(); send('window.startResize'); }} role="presentation"></span>
  <div class="lights">
    {#each lights as light (light.action)}
      <button class="light" style:--light={light.color} type="button" aria-label={light.label} title={light.label} onclick={() => send(light.action)}>
        <Icon name={light.icon} size={9} />
      </button>
    {/each}
  </div>
  {#if hasSpine && router.canGoBack}
    <button class="back" type="button" title="Revenir à la page précédente" onclick={back}>
      <Icon name="chevronLeft" size={14} /> Retour
    </button>
  {/if}
  <p class="caption">{caption}</p>
</header>

<style>
  .title-bar {
    position: relative;
    z-index: 5;
    display: grid;
    flex: none;
    grid-template-columns: var(--sidebarWidth) minmax(0, 1fr) var(--sidebarWidth);
    align-items: center;
    height: var(--titleBarHeight);
    background: var(--colorMilk);
    border-bottom: 1.5px dashed var(--colorLineStrong);
    user-select: none;
  }

  /* <-- La partie gauche prolonge la reliure mauve de la barre latérale --> */
  .title-bar.has-spine .lights {
    align-self: stretch;
    border-right: var(--outline);
    background: var(--colorMauve);
  }

  /* <-- Le retour se pose juste après la reliure, sans décentrer la légende --> */
  .back {
    position: absolute;
    top: 50%;
    left: calc(var(--sidebarWidth) + var(--space3));
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 2px 10px 2px 6px;
    border: var(--outlineThin);
    border-radius: var(--radiusPill);
    background: var(--colorPaper);
    color: var(--textSoft);
    cursor: pointer;
    font-size: var(--fontSizeXs);
    font-weight: 800;
    transform: translateY(-50%);
    transition: background var(--transitionFast), transform 0.2s var(--easeSpring);
  }

  .back:hover {
    background: var(--colorBlond);
    color: var(--textMain);
    transform: translate(-2px, -50%);
  }

  .grip {
    position: absolute;
    inset: 0 0 auto;
    height: 5px;
    cursor: ns-resize;
  }

  .lights {
    display: flex;
    align-items: center;
    gap: var(--space2);
    padding-left: var(--space4);
  }

  .light {
    display: grid;
    width: 15px;
    height: 15px;
    padding: 0;
    place-items: center;
    border: var(--outlineThin);
    border-radius: 50%;
    background: var(--light);
    color: transparent;
    cursor: pointer;
    transition: transform var(--transitionFast);
  }

  .lights:hover .light,
  .light:focus-visible {
    color: var(--colorInk);
  }

  .light:hover {
    transform: scale(1.15);
  }

  .light:active {
    transform: scale(0.92);
  }

  .caption {
    overflow: hidden;
    color: var(--textSoft);
    font-family: var(--fontHand);
    font-size: 1.6rem;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
