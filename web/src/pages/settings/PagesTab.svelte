<script lang="ts">
  import type { CalendarCovers, SettingsPatch } from '../../lib/bridge';
  import { session } from '../../state/session.svelte';
  import ProfileVideoCard from './ProfileVideoCard.svelte';
  import SectionOrderDialog from './SectionOrderDialog.svelte';

  interface Props {
    update: (patch: SettingsPatch) => Promise<void>;
  }

  let { update }: Props = $props();

  const calendarCoverOptions: [CalendarCovers, string][] = [
    ['all', 'Toujours'],
    ['single', 'Seulement s’il y a un seul anime'],
    ['none', 'Jamais'],
  ];
  const compareCacheOptions: [number, string][] = [
    [0, 'Désactivée'],
    [5, '5 min'],
    [10, '10 min'],
    [30, '30 min'],
    [60, '1 h'],
  ];

  let isSectionOrderOpen = $state(false);
  const hasCustomOrder = $derived(Boolean(session.settings?.mediaSectionOrder.length));
</script>

<section class="card settings-card" style:--accent="var(--colorStrawberry)">
  <h2 class="note-label">Page d’un anime ou d’un manga</h2>
  <p class="settings-hint">Choisis dans quel ordre s’affichent le résumé, les épisodes, le fil des indices, la bande-son…</p>
  <button class="btn" type="button" onclick={() => (isSectionOrderOpen = true)}>Configurer l’ordre des sections</button>
  {#if hasCustomOrder}<span class="faint custom-order">Ordre personnalisé</span>{/if}
</section>

<!-- Les images des cases du calendrier -->
<section class="card settings-card" style:--accent="var(--colorSky)">
  <h2 class="note-label">Calendrier</h2>
  <p class="settings-hint">Les images des anime qui sortent ce jour-là, dans les cases du calendrier. Jusqu’à quatre tiennent dans une case.</p>
  <div class="settings-choices">
    {#each calendarCoverOptions as [value, label] (value)}
      <button class="chip" class:is-active={session.settings?.calendarCovers === value} type="button" onclick={() => update({ calendarCovers: value })}>
        {label}
      </button>
    {/each}
  </div>
</section>

<!-- Combien de temps une comparaison garde les deux listes -->
<section class="card settings-card" style:--accent="var(--colorMauve)">
  <h2 class="note-label">Comparer nos carnets</h2>
  <p class="settings-hint">
    Les deux listes restent en mémoire ce temps-là : revenir sur une comparaison ne les redemande pas à AniList. Le bouton « Relever à nouveau » force la mise à jour.
  </p>
  <div class="settings-choices">
    {#each compareCacheOptions as [minutes, label] (minutes)}
      <button class="chip" class:is-active={session.settings?.compareCacheMinutes === minutes} type="button" onclick={() => update({ compareCacheMinutes: minutes })}>
        {label}
      </button>
    {/each}
  </div>
</section>

<ProfileVideoCard {update} />

<SectionOrderDialog open={isSectionOrderOpen} onclose={() => (isSectionOrderOpen = false)} />

<style>
  .custom-order {
    margin-left: var(--space3);
    font-family: var(--fontHand);
    font-size: var(--fontSizeMd);
  }
</style>
