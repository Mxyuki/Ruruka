<script lang="ts">
  import { fetchActivityHistory } from '../../api/queries/activity';
  import { pluralize } from '../../lib/format';
  import { buildActivityGrid } from './activityGrid';

  let { userName }: { userName: string } = $props();

  const weekdayLabels = ['lun.', '', 'mer.', '', 'ven.', '', ''];
  const levels = [0, 1, 2, 3, 4];

  const grid = $derived(fetchActivityHistory(userName).then((history) => buildActivityGrid(history)));
</script>

{#await grid}
  <p class="faint status" role="status">On relève les traces des six derniers mois…</p>
{:then { weeks, monthLabels, total, activeDays }}
  {#if total}
    <!-- Les carrés des six derniers mois, une colonne par semaine -->
    <div class="card graph">
      <div class="board" style:--weeks={weeks.length}>
        <span></span>
        <div class="months">
          {#each monthLabels as label, index (index)}<span>{label}</span>{/each}
        </div>
        <div class="weekdays" aria-hidden="true">
          {#each weekdayLabels as label, index (index)}<span>{label}</span>{/each}
        </div>
        <div class="cells" role="img" aria-label="{pluralize(total, 'activité')} sur six mois, réparties sur {pluralize(activeDays, 'jour')}">
          {#each weeks as week, weekIndex (weekIndex)}
            {#each week as cell, dayIndex (dayIndex)}
              {#if cell}
                <span
                  class="cell level-{cell.level}"
                  class:is-today={cell.isToday}
                  class:tip-start={weekIndex < weeks.length / 4}
                  class:tip-end={weekIndex > (weeks.length * 3) / 4}
                  data-tip={cell.label}
                ></span>
              {:else}
                <span class="blank"></span>
              {/if}
            {/each}
          {/each}
        </div>
      </div>

      <div class="foot">
        <span>{pluralize(total, 'activité')} sur six mois · {pluralize(activeDays, 'jour')} d’enquête</span>
        <span class="legend" aria-hidden="true">
          Moins
          {#each levels as level (level)}<span class="cell level-{level}"></span>{/each}
          Plus
        </span>
      </div>
    </div>
  {:else}
    <p class="faint status">Pas encore de trace d’activité sur six mois.</p>
  {/if}
{:catch}
  <p class="faint status">Impossible de lire l’activité de cette personne pour l’instant.</p>
{/await}

<style>
  .graph {
    padding: var(--space4);
  }

  /* <-- Étiquettes des mois en haut, des jours à gauche, les carrés dans la case restante --> */
  .board {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: var(--space1) var(--space2);
  }

  .months,
  .cells {
    display: grid;
    grid-template-columns: repeat(var(--weeks), minmax(0, 1fr));
    gap: 3px;
  }

  .months {
    color: var(--textSoft);
    font-size: var(--fontSizeXs);
    font-weight: 800;
  }

  .months span {
    overflow: visible;
    white-space: nowrap;
  }

  .weekdays {
    display: grid;
    grid-template-rows: repeat(7, 1fr);
    gap: 3px;
    color: var(--textFaint);
    font-size: var(--fontSizeXs);
    line-height: 1;
  }

  .weekdays span {
    display: flex;
    align-items: center;
  }

  .cells {
    grid-auto-flow: column;
    grid-template-rows: repeat(7, auto);
  }

  .cell,
  .blank {
    aspect-ratio: 1;
    border-radius: 3px;
  }

  .cell {
    position: relative;
    background: var(--colorSunken);
    box-shadow: inset 0 0 0 1px var(--colorLine);
  }

  .level-1 {
    background: var(--colorActivity1);
  }

  .level-2 {
    background: var(--colorActivity2);
  }

  .level-3 {
    background: var(--colorActivity3);
  }

  .level-4 {
    background: var(--colorActivity4);
  }

  .cell.is-today {
    box-shadow: inset 0 0 0 2px var(--colorInk);
  }

  /* <-- Au survol, une bulle donne le jour et le nombre d'activités ; elle s'accroche au bord pour ne pas sortir de la page --> */
  .cells .cell:hover {
    z-index: 2;
    box-shadow: inset 0 0 0 2px var(--colorInk);
  }

  .cells .cell:hover::after {
    content: attr(data-tip);
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    padding: 4px 10px;
    border: var(--outlineThin);
    border-radius: var(--radiusSmall);
    background: var(--colorPaper);
    box-shadow: 2px 2px 0 var(--colorInk);
    color: var(--textMain);
    font-size: var(--fontSizeXs);
    font-weight: 800;
    pointer-events: none;
    transform: translateX(-50%);
    white-space: nowrap;
  }

  .cells .cell.tip-start:hover::after {
    left: 0;
    transform: none;
  }

  .cells .cell.tip-end:hover::after {
    right: 0;
    left: auto;
    transform: none;
  }

  .foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space2);
    margin-top: var(--space3);
    color: var(--textSoft);
    font-size: var(--fontSizeSm);
    font-weight: 700;
  }

  .legend {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: var(--fontSizeXs);
  }

  .legend .cell {
    width: 14px;
  }

  .status {
    margin: 0;
  }
</style>
