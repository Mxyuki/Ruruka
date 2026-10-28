<script lang="ts" module>
  export type SongSource = 'audio' | 'videoHq' | 'videoMq';
</script>

<script lang="ts">
  import type { AnimeSong } from '../../api/anisongdb';
  import Icon from '../../components/Icon.svelte';
  import { formatClock } from '../../lib/format';
  import { session } from '../../state/session.svelte';

  interface Props {
    song: AnimeSong;
    /** The source playing in this row, if any. Only one row plays at a time. */
    playing: SongSource | null;
    onplay: (source: SongSource | null) => void;
  }

  let { song, playing, onplay }: Props = $props();

  const kindLabels = { opening: 'OP', ending: 'ED', insert: 'Insert' } as const;
  // <-- Sans serveur de fichiers dans les réglages, la chanson est listée mais aucun lecteur n'apparaît -->
  const fileUrl = (fileName: string | null) => (fileName && session.songFileHost ? `${session.songFileHost}/${encodeURIComponent(fileName)}` : null);
  const sources = $derived(
    (
      [
        ['audio', 'Écouter', 'music', fileUrl(song.audioFile)],
        ['videoHq', 'Vidéo HQ', 'tv', fileUrl(song.videoHqFile)],
        ['videoMq', 'Vidéo MQ', 'tv', fileUrl(song.videoMqFile)],
      ] as const
    ).filter(([, , , url]) => url),
  );
  const playingUrl = $derived(playing ? sources.find(([source]) => source === playing)?.[3] : null);
  const credits = $derived(
    [song.composer && `Composition : ${song.composer}`, song.arranger && song.arranger !== song.composer && `Arrangement : ${song.arranger}`]
      .filter(Boolean)
      .join(' · '),
  );
</script>

<li class:is-playing={playing}>
  <span class="badge {song.kind}">{kindLabels[song.kind]}{song.number ? ` ${song.number}` : ''}</span>

  <div class="text">
    <strong>{song.name}</strong>
    <span class="artist">{song.artist}</span>
    {#if credits}<span class="credits">{credits}</span>{/if}
  </div>

  <div class="meta">
    {#if song.isDub}<span class="chip">Doublage</span>{/if}
    {#if song.isRebroadcast}<span class="chip">Rediffusion</span>{/if}
    {#if song.lengthSeconds}<span class="length">{formatClock(song.lengthSeconds)}</span>{/if}
  </div>

  <div class="actions">
    {#each sources as [source, label, icon] (source)}
      <button class="btn btn-sm" class:btn-primary={playing === source} type="button" aria-pressed={playing === source} onclick={() => onplay(playing === source ? null : source)}>
        <Icon name={playing === source ? 'close' : icon} size={14} />
        {label}
      </button>
    {/each}
  </div>

  <!-- Un seul lecteur à la fois, créé au clic pour ne rien télécharger d'avance -->
  {#if playingUrl}
    <div class="player">
      {#if playing === 'audio'}
        <audio src={playingUrl} controls autoplay></audio>
      {:else}
        <video src={playingUrl} controls autoplay playsinline><track kind="captions" /></video>
      {/if}
    </div>
  {/if}
</li>

<style>
  li {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    align-items: center;
    gap: var(--space2) var(--space4);
    padding: var(--space3) var(--space4);
    border-bottom: 1px dashed var(--colorLineStrong);
    content-visibility: auto;
    contain-intrinsic-size: auto 64px;
  }

  li:last-child {
    border-bottom: 0;
  }

  li.is-playing {
    background: var(--colorSkySoft);
  }

  /* <-- Pastille façon étiquette de dossier : une couleur par type de générique --> */
  .badge {
    min-width: 64px;
    padding: 2px 10px;
    border: var(--outlineThin);
    border-radius: var(--radiusPill);
    font-family: var(--fontFile);
    font-size: var(--fontSizeXs);
    font-weight: 700;
    text-align: center;
    transform: rotate(-3deg);
  }

  .badge.opening {
    background: var(--colorStar);
  }

  .badge.ending {
    background: var(--colorStrawberry);
  }

  .badge.insert {
    background: var(--colorSky);
  }

  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .text strong {
    overflow-wrap: anywhere;
  }

  .artist {
    color: var(--textSoft);
    font-size: var(--fontSizeSm);
    font-weight: 700;
  }

  .credits {
    color: var(--textFaint);
    font-size: var(--fontSizeXs);
  }

  .meta,
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space2);
  }

  .length {
    color: var(--textFaint);
    font-family: var(--fontFile);
    font-size: var(--fontSizeSm);
  }

  .player {
    grid-column: 1 / -1;
    display: flex;
    justify-content: center;
    padding-top: var(--space2);
  }

  audio {
    width: min(100%, 520px);
  }

  video {
    width: min(100%, 720px);
    aspect-ratio: 16 / 9;
    border: var(--outline);
    border-radius: var(--radiusSmall);
    background: var(--colorInk);
  }

  @media (max-width: 1000px) {
    li {
      grid-template-columns: auto minmax(0, 1fr);
    }

    .meta,
    .actions {
      grid-column: 2;
      justify-content: flex-start;
    }
  }
</style>
