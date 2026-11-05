<script lang="ts">
  import { pluralize } from '../../lib/format';
  import { session } from '../../state/session.svelte';
  import type { CalendarItem } from './calendar.svelte';
  import { dayKey, formatDay } from './calendarDates';
  import DayChip from './DayChip.svelte';

  interface Props {
    month: Date;
    days: Date[];
    itemsByDay: Map<string, CalendarItem[]>;
    todayKey: string;
    selectedKey: string;
    onselect: (key: string) => void;
  }

  let { month, days, itemsByDay, todayKey, selectedKey, onselect }: Props = $props();

  const maxChipsPerDay = 3;
  const weekdays = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];

  const maxCoversPerDay = 4;

  // <-- Taille `large` : `medium` devient flou une fois agrandi à la largeur d'une case -->
  /** The covers a day shows, one per anime airing, following the viewer's setting. */
  function dayCovers(items: CalendarItem[]): string[] {
    const setting = session.settings?.calendarCovers ?? 'all';
    if (setting === 'none') return [];
    const covers = new Set(items.flatMap((item) => (item.kind === 'airing' ? [item.media.coverImage.large] : [])));
    if (setting === 'single' && covers.size > 1) return [];
    return [...covers].slice(0, maxCoversPerDay);
  }
</script>

{#snippet dayChip(item: CalendarItem, isOnCover: boolean)}
  {#if item.kind === 'event'}
    <DayChip tone="event" icon="edit" label={item.event.title} {isOnCover} />
  {:else}
    <DayChip
      tone={item.isPlanned ? 'planned' : 'anime'}
      isEstimated={item.isEstimated}
      icon={item.isWatched ? 'check' : undefined}
      mark="{item.isEstimated ? '~' : ''}{item.episode}"
      label={item.media.title.userPreferred}
      {isOnCover}
    />
  {/if}
{/snippet}

<!-- Page du mois : une case par jour, semaines complètes du lundi au dimanche -->
<div class="card calendar">
  <div class="weekdays" aria-hidden="true">
    {#each weekdays as weekday (weekday)}<span>{weekday}</span>{/each}
  </div>
  <ol class="days">
    {#each days as day (dayKey(day))}
      {@const key = dayKey(day)}
      {@const items = itemsByDay.get(key) ?? []}
      {@const covers = dayCovers(items)}
      <li>
        <button
          type="button"
          class="day"
          class:is-other-month={day.getMonth() !== month.getMonth()}
          class:is-selected={key === selectedKey}
          class:has-cover={covers.length}
          aria-pressed={key === selectedKey}
          aria-label="{formatDay(day)}, {items.length ? pluralize(items.length, 'élément') : 'rien de prévu'}"
          onclick={() => onselect(key)}
        >
          {#if covers.length}
            <span class="covers">
              {#each covers as cover (cover)}<img src={cover} alt="" loading="lazy" />{/each}
            </span>
          {/if}
          <span class="number" class:is-today={key === todayKey}>{day.getDate()}</span>
          <span class="chips">
            {#each items.slice(0, maxChipsPerDay) as item (item.id)}
              {@render dayChip(item, covers.length > 0)}
            {/each}
            {#if items.length > maxChipsPerDay}
              <span class="more">+{items.length - maxChipsPerDay}</span>
            {/if}
          </span>
        </button>
      </li>
    {/each}
  </ol>
</div>

<!-- Légende : ce que veut dire chaque étiquette -->
<div class="legend">
  <DayChip tone="anime" mark="6" label="Date AniList" />
  <DayChip tone="anime" isEstimated mark="~7" label="Date estimée" />
  <DayChip tone="planned" mark="1" label="Premier épisode d'un anime à voir" />
  <DayChip tone="event" icon="edit" label="Ton événement" />
  <DayChip tone="anime" icon="check" mark="5" label="Déjà vu" />
</div>

<style>
  .calendar {
    overflow: hidden;
    padding: 0;
  }

  .weekdays,
  .days {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }

  .weekdays {
    border-bottom: var(--outline);
    background: var(--colorMauve);
    font-family: var(--fontHand);
    font-size: 1.7rem;
    text-align: center;
  }

  .days {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    min-width: 0;
    border-right: 1px solid var(--colorLineStrong);
    border-bottom: 1px solid var(--colorLineStrong);
  }

  li:nth-child(7n) {
    border-right: 0;
  }

  /* <-- Cases de hauteur fixe : le mois ne saute pas d'un jour chargé à l'autre --> */
  .day {
    position: relative;
    isolation: isolate;
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    height: 128px;
    padding: var(--space1);
    overflow: hidden;
    border: 0;
    background: none;
    color: inherit;
    cursor: pointer;
    text-align: left;
    transition: background var(--transitionFast);
  }

  .day:hover {
    background: var(--colorSunken);
  }

  .day.is-selected {
    background: var(--colorSkySoft);
    outline: var(--outline);
    outline-offset: -2px;
  }

  .day:focus-visible {
    outline-offset: -3px;
  }

  .day.is-other-month:not(.is-selected) {
    background: var(--screentone);
  }

  /* <-- Les couvertures passent sous la case, pour que le contour du jour choisi et du focus reste visible --> */
  .covers {
    position: absolute;
    z-index: -1;
    inset: 0;
    display: flex;
    gap: 1px;
    background: var(--colorInk);
    transition: transform var(--transitionFast);
  }

  /* <-- Côte à côte et cadrées sur le haut : les étiquettes cachent le bas de la case, une seconde rangée n'y serait pas vue --> */
  .covers img {
    flex: 1;
    min-width: 0;
    height: 100%;
    object-fit: cover;
    object-position: 50% 20%;
  }

  .day:hover .covers {
    transform: scale(1.04);
  }

  .is-other-month .covers {
    opacity: 0.45;
  }

  .has-cover .number {
    border: var(--outlineThin);
    background: var(--colorPaper);
  }

  /* <-- La pile part du bas de la case : le premier de la journée en dessous, les suivants au-dessus --> */
  .chips {
    display: flex;
    flex-direction: column-reverse;
    gap: 2px;
    min-width: 0;
    margin-top: auto;
  }

  .has-cover .more {
    align-self: flex-end;
    padding: 0 var(--space1);
    border-radius: var(--radiusSmall);
    background: var(--colorPaper);
  }

  .number {
    align-self: flex-start;
    min-width: 22px;
    border: 1.5px solid transparent;
    border-radius: var(--radiusPill);
    color: var(--textSoft);
    font-family: var(--fontFile);
    font-size: var(--fontSizeSm);
    font-weight: 700;
    line-height: 1.4;
    text-align: center;
  }

  .is-other-month .number {
    color: var(--textFaint);
  }

  .number.is-today {
    border: var(--outlineThin);
    background: var(--colorStar);
    color: var(--textMain);
  }

  .more {
    color: var(--textSoft);
    font-size: var(--fontSizeXs);
    font-weight: 800;
    text-align: right;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space2);
    margin-top: var(--space3);
  }
</style>
