<script lang="ts">
  import Modal from '../../components/Modal.svelte';
  import type { CalendarEvent } from '../../lib/bridge';
  import { toasts } from '../../state/toasts.svelte';
  import { calendar } from './calendar.svelte';

  interface Props {
    event: CalendarEvent;
    onclose: () => void;
  }

  let { event, onclose }: Props = $props();

  async function remove() {
    try {
      await calendar.removeEvent(event.id);
      toasts.success('Événement supprimé.');
      onclose();
    } catch (error) {
      toasts.error(error, 'Impossible de supprimer cet événement');
    }
  }
</script>

<Modal open title="Supprimer « {event.title} » ?" {onclose}>
  <p>
    {event.repeatWeeks > 1
      ? `Ses ${event.repeatWeeks} semaines disparaissent du calendrier, avec ses notes.`
      : 'Il disparaît du calendrier, avec ses notes.'}
  </p>

  {#snippet footer()}
    <button class="btn" type="button" onclick={onclose}>Garder</button>
    <button class="btn btn-danger" type="button" onclick={remove}>Supprimer l'événement</button>
  {/snippet}
</Modal>
