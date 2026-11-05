<script lang="ts">
  import { untrack } from 'svelte';
  import type { MediaSummary } from '../../api/types';
  import Modal from '../../components/Modal.svelte';
  import NumberStepper from '../../components/NumberStepper.svelte';
  import type { CalendarEvent, CalendarEventAnime } from '../../lib/bridge';
  import { mediaList } from '../../state/mediaList.svelte';
  import { toasts } from '../../state/toasts.svelte';
  import AnimePicker from './AnimePicker.svelte';
  import { calendar } from './calendar.svelte';
  import { addDays, dateFromKey, episodesForOccurrence, formatEpisodes, formatShortDay, formatWeekday } from './calendarDates';

  interface Props {
    /** The event to change; null creates one on `date`. */
    event: CalendarEvent | null;
    date: string;
    onclose: () => void;
  }

  let { event, date, onclose }: Props = $props();

  const maxRepeatWeeks = 104;

  // <-- Le formulaire vit le temps d'une ouverture : on part des valeurs reçues -->
  const initial = untrack(() => event);
  let title = $state(initial?.title ?? '');
  let eventDate = $state(initial?.date ?? untrack(() => date));
  let time = $state(initial?.time ?? '');
  let notes = $state(initial?.notes ?? '');
  let repeatWeeks = $state(initial?.repeatWeeks ?? 1);
  let anime = $state.raw<CalendarEventAnime | null>(initial?.anime ?? null);
  let isSaving = $state(false);
  let error = $state<string | null>(null);

  const repeatSummary = $derived.by(() => {
    if (!eventDate) return '';
    const firstDay = dateFromKey(eventDate);
    if (repeatWeeks === 1) return `Une seule fois, le ${formatShortDay(firstDay)}.`;
    return `${repeatWeeks} fois, chaque ${formatWeekday(firstDay)}, jusqu'au ${formatShortDay(addDays(firstDay, (repeatWeeks - 1) * 7))}.`;
  });

  // <-- Le rythme s'arrête avec l'anime : on annonce la dernière semaine qui a encore des épisodes -->
  const paceSummary = $derived.by(() => {
    const weeks = Array.from({ length: repeatWeeks }, (_, week) => week);
    const firstRange = episodesForOccurrence(anime, 0);
    const lastWeek = weeks.findLast((week) => episodesForOccurrence(anime, week)) ?? 0;
    const lastRange = episodesForOccurrence(anime, lastWeek);
    if (!firstRange || !lastRange) return '';
    if (lastWeek === 0) return `Semaine 1 : ${formatEpisodes(firstRange)}.`;
    const pace = `Semaine 1 : ${formatEpisodes(firstRange)}. Semaine ${lastWeek + 1} : ${formatEpisodes(lastRange)}.`;
    return lastWeek < repeatWeeks - 1 ? `${pace} L’anime sera fini à ce moment-là.` : pace;
  });

  function attach(media: MediaSummary) {
    error = null;
    const nextEpisode = (mediaList.entryFor(media.id)?.progress ?? 0) + 1;
    anime = {
      mediaId: media.id,
      title: media.title.userPreferred,
      coverUrl: media.coverImage.medium,
      totalEpisodes: media.episodes,
      firstEpisode: Math.min(nextEpisode, media.episodes ?? nextEpisode),
      episodesPerSession: 1,
    };
  }

  function changeAnime(changes: Partial<CalendarEventAnime>) {
    if (anime) anime = { ...anime, ...changes };
  }

  async function save(submit: SubmitEvent) {
    submit.preventDefault();
    const eventTitle = title.trim() || anime?.title.trim() || '';
    if (!eventTitle) {
      error = 'Donne un titre à ton événement, ou attache-lui un anime.';
      return;
    }
    if (!eventDate) {
      error = 'Choisis le jour de ton événement.';
      return;
    }
    isSaving = true;
    error = null;
    try {
      await calendar.saveEvent({
        id: initial?.id ?? crypto.randomUUID(),
        title: eventTitle,
        date: eventDate,
        time: time || null,
        notes: notes.trim(),
        repeatWeeks,
        anime,
      });
      toasts.success(initial ? 'Événement modifié !' : 'Événement noté dans le carnet !');
      onclose();
    } catch (saveError) {
      toasts.error(saveError, 'Impossible d’enregistrer cet événement');
    } finally {
      isSaving = false;
    }
  }
</script>

<Modal open title={initial ? 'Modifier l’événement' : 'Nouvel événement'} width="600px" {onclose}>
  <form id="calendar-event" onsubmit={save} oninput={() => (error = null)}>
    <label>
      <span class="field-label">Titre</span>
      <input class="input" type="text" maxlength="200" placeholder="Soirée rattrapage" bind:value={title} />
    </label>

    <div class="row">
      <label>
        <span class="field-label">Jour</span>
        <input class="input" type="date" bind:value={eventDate} />
      </label>
      <label>
        <span class="field-label">Heure (facultatif)</span>
        <input class="input" type="time" bind:value={time} />
      </label>
    </div>

    <div>
      <span class="field-label">Nombre de semaines d'affilée</span>
      <div class="inline">
        <NumberStepper label="Nombre de semaines d'affilée" min={1} max={maxRepeatWeeks} value={repeatWeeks} onchange={(weeks) => (repeatWeeks = weeks)} />
        <span class="hint">{repeatSummary}</span>
      </div>
    </div>

    <label>
      <span class="field-label">Notes</span>
      <textarea class="input" rows="3" maxlength="4000" bind:value={notes}></textarea>
    </label>

    <div>
      <span class="field-label">Anime attaché (facultatif)</span>
      {#if anime}
        <div class="attached">
          <img src={anime.coverUrl} alt="" width="40" height="56" />
          <span class="anime-title">{anime.title}</span>
          <button class="btn btn-ghost btn-sm" type="button" onclick={() => (anime = null)}>Retirer</button>
        </div>
        <div class="row pace">
          <div>
            <span class="field-label">À partir de l'épisode</span>
            <NumberStepper label="À partir de l'épisode" min={1} max={anime.totalEpisodes} value={anime.firstEpisode} onchange={(firstEpisode) => changeAnime({ firstEpisode })} />
          </div>
          <div>
            <span class="field-label">Épisodes par semaine</span>
            <NumberStepper label="Épisodes par semaine" max={anime.totalEpisodes} value={anime.episodesPerSession} onchange={(episodesPerSession) => changeAnime({ episodesPerSession })} />
          </div>
        </div>
        <p class="hint">{paceSummary || 'Sans objectif d’épisodes : l’anime est juste rattaché à l’événement.'}</p>
      {:else}
        <AnimePicker onpick={attach} />
      {/if}
    </div>

    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </form>

  {#snippet footer()}
    <button class="btn" type="button" onclick={onclose}>Annuler</button>
    <button class="btn btn-primary" type="submit" form="calendar-event" disabled={isSaving}>
      {initial ? 'Enregistrer les modifications' : 'Ajouter au calendrier'}
    </button>
  {/snippet}
</Modal>

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: var(--space4);
  }

  label {
    display: block;
  }

  .input {
    width: 100%;
  }

  textarea {
    resize: vertical;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space4);
  }

  .row > * {
    flex: 1 1 200px;
  }

  .inline {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space3);
  }

  .hint {
    color: var(--textSoft);
    font-size: var(--fontSizeSm);
  }

  .attached {
    display: flex;
    align-items: center;
    gap: var(--space3);
  }

  .attached img {
    flex-shrink: 0;
    border: var(--outlineThin);
    border-radius: var(--radiusSmall);
    object-fit: cover;
  }

  .anime-title {
    flex: 1;
    min-width: 0;
    font-weight: 800;
  }

  .pace {
    margin: var(--space3) 0 var(--space2);
  }

  .error {
    color: var(--colorDanger);
    font-weight: 700;
  }
</style>
