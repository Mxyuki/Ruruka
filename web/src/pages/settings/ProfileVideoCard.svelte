<script lang="ts">
  import Toggle from '../../components/Toggle.svelte';
  import type { SettingsPatch } from '../../lib/bridge';
  import { session } from '../../state/session.svelte';

  interface Props {
    update: (patch: SettingsPatch) => Promise<void>;
  }

  let { update }: Props = $props();

  const volumeOptions = [10, 20, 30, 40, 50, 75, 100];
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
  <div class="volumes">
    {#each volumeOptions as percent (percent)}
      <button class="chip" class:is-active={session.settings?.profileVideoVolumePercent === percent} type="button" onclick={() => update({ profileVideoVolumePercent: percent })}>
        {percent} %
      </button>
    {/each}
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

  .volumes {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space2);
  }

  .volumes .chip {
    border: 0;
    background: var(--colorSunken);
    cursor: pointer;
  }

  .volumes .chip.is-active {
    background: var(--colorBlond);
  }
</style>
