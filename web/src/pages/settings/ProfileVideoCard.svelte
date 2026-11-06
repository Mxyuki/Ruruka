<script lang="ts">
  import Toggle from '../../components/Toggle.svelte';
  import type { SettingsPatch } from '../../lib/bridge';
  import { session } from '../../state/session.svelte';

  interface Props {
    update: (patch: SettingsPatch) => Promise<void>;
  }

  let { update }: Props = $props();

  // <-- Le réglage n'est écrit qu'au relâchement : glisser le curseur ne doit pas réécrire settings.json à chaque pas -->
  let draggedVolume = $state<number | null>(null);
  const volume = $derived(draggedVolume ?? session.settings?.profileVideoVolumePercent ?? 30);

  async function saveVolume() {
    if (draggedVolume === null) return;
    await update({ profileVideoVolumePercent: draggedVolume });
    draggedVolume = null;
  }
</script>

<section class="card" style:--accent="var(--colorStrawberry)">
  <h2 class="note-label">Vidéos des profils</h2>
  <p class="hint">Les vidéos des profils s’arrêtent quand elles sortent de l’écran. Une seule a le son à la fois, et tu gardes pause et volume sur chacune.</p>
  <div class="option">
    <Toggle
      checked={session.settings?.isProfileVideoAutoplayed ?? true}
      label="Lancer les vidéos toutes seules quand elles arrivent à l’écran"
      onchange={(isProfileVideoAutoplayed) => update({ isProfileVideoAutoplayed })}
    />
  </div>
  <div class="option">
    <Toggle
      checked={session.settings?.isProfileVideoSoundOn ?? false}
      label="Lancer la première vidéo avec le son"
      onchange={(isProfileVideoSoundOn) => update({ isProfileVideoSoundOn })}
    />
  </div>

  <h3 class="option-title">Volume de départ</h3>
  <p class="hint">Le volume d’une vidéo quand elle prend le son, pour éviter les mauvaises surprises.</p>
  <div class="volume" style:--fill="{volume}%">
    <input type="range" min="0" max="100" step="1" aria-label="Volume de départ" value={volume} oninput={(event) => (draggedVolume = Number(event.currentTarget.value))} onchange={saveVolume} />
    <span class="readout">{volume} %</span>
  </div>
</section>

<style>
  section {
    position: relative;
    margin-bottom: var(--space4);
    padding: var(--space5);
  }

  .hint {
    margin: calc(var(--space2) * -1) 0 var(--space3);
    color: var(--textFaint);
    font-size: var(--fontSizeSm);
  }

  .option {
    margin-top: var(--space4);
  }

  .option-title {
    margin: var(--space5) 0 var(--space3);
    font-size: var(--fontSizeSm);
    font-weight: 800;
  }

  .volume {
    display: flex;
    align-items: center;
    gap: var(--space3);
  }

  .readout {
    min-width: 3.5em;
    font-size: var(--fontSizeSm);
  }

  input[type='range'] {
    flex: 1;
    max-width: 320px;
    height: 12px;
    border: var(--outlineThin);
    border-radius: var(--radiusPill);
    background: linear-gradient(90deg, var(--colorStar) var(--fill), var(--colorPaper) var(--fill));
    cursor: pointer;
    appearance: none;
  }

  input[type='range']::-webkit-slider-thumb {
    width: 22px;
    height: 22px;
    border: var(--outline);
    border-radius: 50%;
    background: var(--colorStrawberry);
    box-shadow: 2px 2px 0 var(--colorInk);
    appearance: none;
  }
</style>
