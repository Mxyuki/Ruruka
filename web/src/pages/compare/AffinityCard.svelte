<script lang="ts">
  import type { MediaType, UserAvatar } from '../../api/types';
  import Kira from '../../components/Kira.svelte';
  import { pluralize } from '../../lib/format';
  import type { Affinity } from './tastes';

  interface Detective {
    name: string;
    avatar: UserAvatar;
  }

  interface Props {
    viewer: Detective;
    other: Detective;
    affinity: Affinity;
    type: MediaType;
  }

  let { viewer, other, affinity, type }: Props = $props();

  const word = $derived(type === 'MANGA' ? 'manga' : 'anime');

  const verdicts: [minimum: number, text: string][] = [
    [75, 'Âmes sœurs d’enquête !'],
    [50, 'Un duo de détectives redoutable'],
    [25, 'Quelques pistes en commun'],
    [0, 'Des méthodes bien différentes'],
    [-Infinity, 'Rivaux jurés : à chacun ses suspects'],
  ];
  const verdict = $derived(affinity.percent === null ? null : verdicts.find(([minimum]) => (affinity.percent ?? 0) >= minimum)?.[1]);
</script>

<!-- Les deux détectives face à face, l'affinité au milieu -->
<section class="affinity notebook-page">
  <i class="tape"></i>
  <figure class="detective is-left">
    <img src={viewer.avatar.large} alt="" />
    <figcaption>{viewer.name}</figcaption>
  </figure>

  <div class="center">
    {#if affinity.percent !== null}
      <div class="badge" style:--fill="{Math.max(0, affinity.percent)}%">
        <span>{affinity.percent}<small>%</small></span>
        <Kira size={22} />
      </div>
      <p class="verdict">{verdict}</p>
      <p class="faint">
        Calculée sur {pluralize(affinity.sharedScored, `${word} noté`)} par vous deux · {pluralize(affinity.sharedSeen, `${word} vu`)} en commun
      </p>
    {:else}
      <div class="badge is-empty"><span>?</span></div>
      <p class="verdict">Pas assez d’indices</p>
      <p class="faint">Il faut au moins 5 {word} notés par vous deux pour comparer vos goûts ({affinity.sharedScored} pour l’instant).</p>
    {/if}
  </div>

  <figure class="detective is-right">
    <img src={other.avatar.large} alt="" />
    <figcaption>{other.name}</figcaption>
  </figure>
</section>

<style>
  .affinity {
    display: grid;
    grid-template-columns: 1fr minmax(0, 2fr) 1fr;
    align-items: center;
    gap: var(--space5);
    margin-bottom: var(--space7);
    padding: var(--space6) var(--space6) var(--space5) 64px;
  }

  .affinity .tape {
    top: -10px;
    left: calc(50% - 37px);
  }

  .detective {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space2);
    margin: 0;
  }

  .detective img {
    width: 120px;
    height: 120px;
    border: var(--outline);
    border-radius: var(--radiusSticker);
    box-shadow: var(--stickerShadow);
    object-fit: cover;
  }

  .is-left img {
    transform: rotate(-5deg);
  }

  .is-right img {
    transform: rotate(4deg);
  }

  figcaption {
    padding: 2px 12px;
    border: var(--outlineThin);
    border-radius: var(--radiusSticker);
    background: var(--colorPaper);
    font-family: var(--fontTitle);
    font-size: var(--fontSizeMd);
  }

  .center {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space2);
    text-align: center;
  }

  /* <-- Grosse pastille d'autocollant remplie à hauteur de l'affinité --> */
  .badge {
    position: relative;
    display: grid;
    width: 140px;
    height: 140px;
    place-items: center;
    border: var(--outline);
    border-radius: 50%;
    background:
      radial-gradient(closest-side, var(--colorPaper) 74%, transparent 76%),
      conic-gradient(var(--colorStar) var(--fill), var(--colorMauve) 0);
    box-shadow: var(--stickerShadowLarge);
    transform: rotate(-5deg);
  }

  .badge.is-empty {
    background: var(--colorPaper);
  }

  .badge span {
    font-family: var(--fontTitle);
    font-size: 4rem;
  }

  .badge small {
    font-size: 0.5em;
  }

  .badge :global(svg) {
    position: absolute;
    top: 4px;
    right: 2px;
  }

  .verdict {
    color: var(--textSoft);
    font-family: var(--fontHand);
    font-size: 2.6rem;
  }

  @media (max-width: 900px) {
    .affinity {
      grid-template-columns: 1fr;
    }
  }
</style>
