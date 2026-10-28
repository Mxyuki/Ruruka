<script lang="ts">
  import type { SettingsPatch, Theme } from '../../lib/bridge';
  import { session } from '../../state/session.svelte';

  interface Props {
    update: (patch: SettingsPatch) => Promise<void>;
  }

  let { update }: Props = $props();

  const themeOptions: [Theme, string][] = [
    ['light', 'Clair'],
    ['dark', 'Sombre'],
    ['system', 'Comme Windows'],
    ['schedule', 'Selon l’heure'],
  ];

  const theme = $derived(session.settings?.theme ?? 'light');

  const toTimeInput = (minuteOfDay: number) =>
    `${String(Math.floor(minuteOfDay / 60)).padStart(2, '0')}:${String(minuteOfDay % 60).padStart(2, '0')}`;

  function fromTimeInput(value: string): number | null {
    const match = value.match(/^(\d{2}):(\d{2})/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  }

  function updateTime(value: string, key: 'themeLightFromMinute' | 'themeDarkFromMinute') {
    const minuteOfDay = fromTimeInput(value);
    if (minuteOfDay !== null) void update({ [key]: minuteOfDay });
  }
</script>

<section class="card" style:--accent="var(--colorMauve)">
  <h2 class="note-label">Apparence</h2>
  <p class="hint">Le carnet de jour, le carnet de nuit, celui qui suit le mode clair ou sombre de Windows, ou les deux selon l’heure.</p>
  <div class="themes">
    {#each themeOptions as [value, label] (value)}
      <button class="chip" class:is-active={theme === value} type="button" onclick={() => update({ theme: value })}>
        {label}
      </button>
    {/each}
  </div>

  <!-- Les deux heures du thème programmé -->
  {#if theme === 'schedule' && session.settings}
    <div class="schedule">
      <label>
        <span class="field-label">Carnet de jour dès</span>
        <input class="input" type="time" value={toTimeInput(session.settings.themeLightFromMinute)} onchange={(event) => updateTime(event.currentTarget.value, 'themeLightFromMinute')} />
      </label>
      <label>
        <span class="field-label">Carnet de nuit dès</span>
        <input class="input" type="time" value={toTimeInput(session.settings.themeDarkFromMinute)} onchange={(event) => updateTime(event.currentTarget.value, 'themeDarkFromMinute')} />
      </label>
    </div>
  {/if}
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

  .themes {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space2);
  }

  .themes .chip {
    border: 0;
    background: var(--colorSunken);
    cursor: pointer;
  }

  .themes .chip.is-active {
    background: var(--colorBlond);
  }

  .schedule {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space4);
    margin-top: var(--space4);
  }

  .schedule label {
    display: grid;
    gap: var(--space1);
  }
</style>
