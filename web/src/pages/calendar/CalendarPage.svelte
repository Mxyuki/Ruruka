<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '../../components/Icon.svelte';
  import LoadingState from '../../components/LoadingState.svelte';
  import PageHeader from '../../components/PageHeader.svelte';
  import type { CalendarEvent } from '../../lib/bridge';
  import { mediaList } from '../../state/mediaList.svelte';
  import { toasts } from '../../state/toasts.svelte';
  import { calendar, type AiringItem } from './calendar.svelte';
  import { addMonths, dateFromKey, dayKey, formatMonth, monthGrid, startOfMonth } from './calendarDates';
  import DayPanel from './DayPanel.svelte';
  import EventDialog from './EventDialog.svelte';
  import HiddenAnimeDialog from './HiddenAnimeDialog.svelte';
  import MonthGrid from './MonthGrid.svelte';
  import RemoveEventDialog from './RemoveEventDialog.svelte';

  const today = new Date();
  const todayKey = dayKey(today);
  const currentMonth = startOfMonth(today);
  const firstVisibleDay = monthGrid(currentMonth)[0] ?? currentMonth;

  let monthsAhead = $state(0);
  let selectedKey = $state(todayKey);
  let eventDialog = $state.raw<{ event: CalendarEvent | null } | null>(null);
  let eventToRemove = $state.raw<CalendarEvent | null>(null);
  let isHiddenListOpen = $state(false);

  const month = $derived(addMonths(currentMonth, monthsAhead));
  const days = $derived(monthGrid(month));
  const itemsByDay = $derived(calendar.itemsByDay(days[0] ?? month, days.at(-1) ?? month));

  // <-- Le jour choisi suit le mois affiché, et revient sur aujourd'hui dans le mois courant -->
  function changeMonth(months: number) {
    monthsAhead += months;
    selectedKey = monthsAhead === 0 ? todayKey : dayKey(addMonths(currentMonth, monthsAhead));
  }

  async function hide({ media }: AiringItem) {
    try {
      await calendar.hide(media.id);
      toasts.success(`${media.title.userPreferred} est masqué du calendrier.`, {
        label: 'Annuler',
        run: () => calendar.show(media.id).catch((error) => toasts.error(error, 'Impossible de réafficher cet anime')),
      });
    } catch (error) {
      toasts.error(error, 'Impossible de masquer cet anime');
    }
  }

  onMount(() => {
    calendar.load(firstVisibleDay).catch((error) => toasts.error(error, 'Impossible d’ouvrir le calendrier'));
  });
</script>

<div class="page">
  <PageHeader title="Calendrier" note="Les sorties de tes anime et tes propres rendez-vous, mois après mois">
    {#snippet actions()}
      <button class="btn" type="button" onclick={() => (isHiddenListOpen = true)}>Anime masqués · {calendar.hiddenMediaIds.length}</button>
      <button class="btn btn-primary" type="button" onclick={() => (eventDialog = { event: null })}>
        <Icon name="plus" size={16} /> Ajouter un événement
      </button>
    {/snippet}
  </PageHeader>

  <div class="month-bar">
    <button class="btn btn-sm btn-icon" type="button" aria-label="Mois précédent" title="Mois précédent" disabled={monthsAhead === 0} onclick={() => changeMonth(-1)}>
      <Icon name="chevronLeft" size={16} />
    </button>
    <h2>{formatMonth(month)}</h2>
    <button class="btn btn-sm btn-icon" type="button" aria-label="Mois suivant" title="Mois suivant" onclick={() => changeMonth(1)}>
      <Icon name="chevronRight" size={16} />
    </button>
    {#if monthsAhead > 0}
      <button class="btn btn-ghost btn-sm" type="button" onclick={() => changeMonth(-monthsAhead)}>Revenir à ce mois-ci</button>
    {/if}
    {#if calendar.isLoadingSchedule}<span class="faint status" role="status">On relève les dates…</span>{/if}
  </div>

  {#if calendar.scheduleError}
    <div class="card problem" role="alert">
      <p>Les dates d'AniList n'ont pas pu être relevées : {calendar.scheduleError} Ce qui s'affiche peut être incomplet.</p>
      <button class="btn btn-sm" type="button" onclick={() => calendar.loadAiringData(firstVisibleDay)}>
        <Icon name="refresh" size={14} /> Réessayer
      </button>
    </div>
  {/if}

  {#if !mediaList.isLoaded('ANIME') && !calendar.scheduleError}
    <LoadingState label="On ouvre le calendrier…" />
  {:else}
    <div class="layout">
      <div>
        <MonthGrid {month} {days} {itemsByDay} {todayKey} {selectedKey} onselect={(key) => (selectedKey = key)} />
      </div>
      <DayPanel
        day={dateFromKey(selectedKey)}
        items={itemsByDay.get(selectedKey) ?? []}
        onhide={hide}
        onedit={(event) => (eventDialog = { event })}
        onremove={(event) => (eventToRemove = event)}
      />
    </div>
  {/if}
</div>

{#if eventDialog}
  <EventDialog event={eventDialog.event} date={selectedKey} onclose={() => (eventDialog = null)} />
{/if}
{#if eventToRemove}
  <RemoveEventDialog event={eventToRemove} onclose={() => (eventToRemove = null)} />
{/if}
{#if isHiddenListOpen}
  <HiddenAnimeDialog onclose={() => (isHiddenListOpen = false)} />
{/if}

<style>
  .month-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space2);
    margin-bottom: var(--space3);
  }

  h2 {
    min-width: 11em;
    font-size: var(--fontSizeXl);
    text-align: center;
  }

  .status {
    margin-left: var(--space2);
    font-size: var(--fontSizeSm);
  }

  .problem {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space3);
    margin-bottom: var(--space3);
    padding: var(--space3) var(--space4);
  }

  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) clamp(280px, 24vw, 380px);
    gap: var(--space5);
    align-items: start;
  }

  /* <-- Fenêtre étroite : le détail du jour passe sous le mois --> */
  @media (max-width: 1180px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
