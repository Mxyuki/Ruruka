<script lang="ts">
  import type { ClipFormat, ClipQuality } from '../../lib/bridge';
  import { session } from '../../state/session.svelte';
  import { toasts } from '../../state/toasts.svelte';
  import ClipPresetDialog from './ClipPresetDialog.svelte';
  import RangeSlider from './RangeSlider.svelte';
  import TimeField from './TimeField.svelte';

  interface Props {
    startSeconds: number;
    endSeconds: number;
    quality: ClipQuality;
    format: ClipFormat;
    presetId: string;
    /** Where the video was paused: the clip usually ends there. */
    positionSeconds: number;
    durationSeconds: number;
    /** A bound was moved or typed: the picture at that time should be shown. */
    onscrub: (seconds: number) => void;
  }

  let {
    startSeconds = $bindable(),
    endSeconds = $bindable(),
    quality = $bindable(),
    format = $bindable(),
    presetId = $bindable(),
    positionSeconds,
    durationSeconds,
    onscrub,
  }: Props = $props();

  const minimumLengthSeconds = 0.5;
  const lastSecondsChoices = [5, 10, 20, 30];

  let isPresetDialogOpen = $state(false);

  const lengthSeconds = $derived(endSeconds - startSeconds);
  const isFfmpeg = $derived(session.settings?.clipEngine === 'ffmpeg');
  const presets = $derived(session.settings?.clipPresets ?? []);
  const chosenPreset = $derived(presets.find((preset) => preset.id === presetId) ?? presets[0]);

  const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

  function takeLast(seconds: number) {
    endSeconds = positionSeconds;
    startSeconds = Math.max(0, positionSeconds - seconds);
  }

  function typeStart(seconds: number) {
    startSeconds = clamp(seconds, 0, endSeconds - minimumLengthSeconds);
    onscrub(startSeconds);
  }

  function typeEnd(seconds: number) {
    endSeconds = clamp(seconds, startSeconds + minimumLengthSeconds, durationSeconds);
    onscrub(endSeconds);
  }

  // <-- Le réglage choisi est retenu pour les prochains clips -->
  function choosePreset(id: string) {
    presetId = id;
    session.updateSettings({ clipPresetId: id }).catch((error) => toasts.error(error, 'Impossible de retenir ce réglage'));
  }
</script>

<!-- Les bornes du clip : par défaut les secondes qui précèdent l'image figée -->
<div class="clip">
  <div class="row">
    <span class="note-label">Les dernières secondes</span>
    {#each lastSecondsChoices as seconds (seconds)}
      <button class="chip" class:is-active={Math.abs(lengthSeconds - seconds) < 0.05 && endSeconds === positionSeconds} type="button" onclick={() => takeLast(seconds)}>
        {seconds} s
      </button>
    {/each}
  </div>

  <!-- Un seul curseur à deux points, et des cases pour viser juste -->
  <RangeSlider bind:start={startSeconds} bind:end={endSeconds} max={durationSeconds} minGapSeconds={minimumLengthSeconds} markerSeconds={positionSeconds} onmove={onscrub} />
  <div class="row bounds">
    <span class="label">Début</span>
    <TimeField label="Début" value={startSeconds} onchange={typeStart} />
    <span class="length">Durée : {lengthSeconds.toFixed(1)} s</span>
    <span class="label">Fin</span>
    <TimeField label="Fin" value={endSeconds} onchange={typeEnd} />
  </div>

  {#if isFfmpeg}
    <!-- Moteur ffmpeg : un réglage nommé, dont on peut lire et changer la commande -->
    <div class="row">
      <span class="note-label">Réglage</span>
      {#each presets as preset (preset.id)}
        <button class="chip" class:is-active={chosenPreset?.id === preset.id} type="button" onclick={() => choosePreset(preset.id)} title={preset.arguments}>
          {preset.name}
        </button>
      {/each}
      <button class="btn btn-ghost btn-sm" type="button" onclick={() => (isPresetDialogOpen = true)}>Réglages avancés…</button>
    </div>
    {#if chosenPreset}
      <p class="command" title="Les options ffmpeg de ce réglage. Ruruka ajoute l’épisode, l’extrait, les pistes et le cadrage.">{chosenPreset.arguments}</p>
    {/if}
  {:else}
    <div class="row">
      <span class="note-label">Qualité</span>
      <button class="chip" class:is-active={quality === 'max'} type="button" onclick={() => (quality = 'max')}>Qualité max</button>
      <button class="chip" class:is-active={quality === 'discord'} type="button" onclick={() => (quality = 'discord')} title="Sous les 10 Mo, pour l'envoyer directement sur Discord">
        Léger pour Discord
      </button>
    </div>

    <div class="row">
      <span class="note-label">Fichier</span>
      <button class="chip" class:is-active={format === 'mp4'} type="button" onclick={() => (format = 'mp4')} title="Le plus répandu : s’ouvre partout (téléphone, Discord, réseaux)">MP4</button>
      <button class="chip" class:is-active={format === 'webm'} type="button" onclick={() => (format = 'webm')} title="Plus léger à qualité égale ; lu par les navigateurs et Discord, moins par les vieux lecteurs">WebM</button>
    </div>
  {/if}
</div>

<ClipPresetDialog open={isPresetDialogOpen} {presetId} onuse={choosePreset} onclose={() => (isPresetDialogOpen = false)} />

<style>
  .clip {
    display: flex;
    flex-direction: column;
    gap: var(--space2);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space2);
  }

  .bounds {
    justify-content: space-between;
  }

  .chip {
    border: 0;
    cursor: pointer;
  }

  .label {
    font-weight: 800;
  }

  .length {
    color: var(--textSoft);
    font-family: var(--fontFile);
    font-size: var(--fontSizeSm);
  }

  .command {
    margin: 0;
    padding: var(--space2) var(--space3);
    border-radius: var(--radiusSmall);
    background: var(--colorSunken);
    color: var(--textSoft);
    font-family: var(--fontFile);
    font-size: var(--fontSizeXs);
    overflow-wrap: anywhere;
    max-height: 4.5em;
    overflow-y: auto;
  }
</style>
