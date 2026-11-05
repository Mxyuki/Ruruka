<script lang="ts">
  import Icon from '../../components/Icon.svelte';
  import type { CalendarEvent } from '../../lib/bridge';
  import { mediaPath } from '../../lib/routes';
  import type { AiringItem, CalendarItem, EventItem } from './calendar.svelte';
  import { formatAiringTime, formatDay, formatEpisodes } from './calendarDates';

  interface Props {
    day: Date;
    items: CalendarItem[];
    onhide: (item: AiringItem) => void;
    onedit: (event: CalendarEvent) => void;
    onremove: (event: CalendarEvent) => void;
  }

  let { day, items, onhide, onedit, onremove }: Props = $props();

  function airingDetails({ episode, airingAt, isDateOnly, isEstimated, isPlanned, isWatched }: AiringItem): string {
    return [
      `Épisode ${episode}`,
      !isDateOnly && formatAiringTime(airingAt),
      isEstimated && 'date estimée',
      isPlanned && 'dans tes « À voir »',
      isWatched && 'déjà vu',
    ].filter(Boolean).join(' · ');
  }

  function eventDetails({ event, occurrence }: EventItem): string {
    const details = [event.time, event.repeatWeeks > 1 && `semaine ${occurrence + 1} sur ${event.repeatWeeks}`];
    return details.filter(Boolean).join(' · ') || 'Ton événement';
  }
</script>

<aside class="card panel" aria-live="polite">
  <i class="tape is-sky"></i>
  <h2>{formatDay(day)}</h2>

  <ul>
    {#each items as item (item.id)}
      <li>
        {#if item.kind === 'airing'}
          <a class="cover" href="#{mediaPath(item.media.id)}" tabindex="-1" aria-hidden="true">
            <img src={item.media.coverImage.medium} alt="" loading="lazy" width="44" height="62" />
          </a>
          <div class="text">
            <a class="title" href="#{mediaPath(item.media.id)}">{item.media.title.userPreferred}</a>
            <span class="details">{airingDetails(item)}</span>
          </div>
          <button class="btn btn-ghost btn-sm" type="button" title="Ne plus afficher cet anime dans le calendrier" onclick={() => onhide(item)}>Masquer</button>
        {:else}
          {#if item.event.anime}
            <a class="cover" href="#{mediaPath(item.event.anime.mediaId)}" tabindex="-1" aria-hidden="true">
              <img src={item.event.anime.coverUrl} alt="" loading="lazy" width="44" height="62" />
            </a>
          {:else}
            <span class="event-mark"><Icon name="edit" size={18} /></span>
          {/if}
          <div class="text">
            <span class="title">{item.event.title}</span>
            <span class="details">{eventDetails(item)}</span>
            {#if item.event.anime}
              <a class="details anime-link" href="#{mediaPath(item.event.anime.mediaId)}">
                {item.event.anime.title}{item.episodes ? ` · ${formatEpisodes(item.episodes)}` : ''}
              </a>
            {/if}
            {#if item.event.notes}<p class="notes">{item.event.notes}</p>{/if}
          </div>
          <div class="event-actions">
            <button class="btn btn-ghost btn-sm btn-icon" type="button" aria-label="Modifier « {item.event.title} »" title="Modifier" onclick={() => onedit(item.event)}>
              <Icon name="edit" size={15} />
            </button>
            <button class="btn btn-ghost btn-sm btn-icon" type="button" aria-label="Supprimer « {item.event.title} »" title="Supprimer" onclick={() => onremove(item.event)}>
              <Icon name="trash" size={15} />
            </button>
          </div>
        {/if}
      </li>
    {:else}
      <li class="empty">Rien de prévu ce jour-là.</li>
    {/each}
  </ul>
</aside>

<style>
  .panel {
    position: relative;
    padding: var(--space4);
  }

  .tape {
    top: -10px;
    left: calc(50% - 37px);
  }

  h2 {
    margin-bottom: var(--space3);
    font-size: var(--fontSizeLg);
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: var(--space3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    align-items: flex-start;
    gap: var(--space2);
    min-width: 0;
  }

  li + li {
    padding-top: var(--space3);
    border-top: 2px dashed var(--colorLine);
  }

  .cover {
    flex-shrink: 0;
  }

  img {
    display: block;
    border: var(--outlineThin);
    border-radius: var(--radiusSmall);
    object-fit: cover;
  }

  .event-mark {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 44px;
    height: 44px;
    border: var(--outlineThin);
    border-radius: var(--radiusSmall);
    background: var(--colorBlond);
  }

  .text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .title {
    font-weight: 800;
    overflow-wrap: anywhere;
  }

  a.title:hover,
  .anime-link:hover {
    text-decoration: underline;
    text-decoration-color: var(--colorStar);
    text-decoration-thickness: 3px;
  }

  .details {
    color: var(--textSoft);
    font-size: var(--fontSizeSm);
    overflow-wrap: anywhere;
  }

  .notes {
    margin-top: var(--space1);
    font-size: var(--fontSizeSm);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .event-actions {
    display: flex;
    flex-shrink: 0;
  }

  .empty {
    color: var(--textFaint);
  }
</style>
