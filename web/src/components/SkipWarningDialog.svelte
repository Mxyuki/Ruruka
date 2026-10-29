<script lang="ts">
  import { playback } from '../state/playback.svelte';
  import Modal from './Modal.svelte';

  const prompt = $derived(playback.skipPrompt);
</script>

{#if prompt}
  <Modal open title="Attends, détective !" width="620px" onclose={() => playback.answerSkipPrompt(null)}>
    <div class="clue">
      <img src="./ruruka.png" alt="" width="64" height="64" />
      <p>
        Les indices ne collent pas : ta liste dit que tu en es à l'épisode <strong>{prompt.suggested - 1}</strong> de
        <em>{prompt.media.title.userPreferred}</em>, donc le suivant devrait être le <strong>{prompt.suggested}</strong>.
      </p>
    </div>

    {#snippet footer()}
      <button class="btn btn-ghost" type="button" onclick={() => playback.answerSkipPrompt(prompt.requested)}>
        Regarder le {prompt.requested} quand même
      </button>
      <button
        class="btn btn-ghost"
        type="button"
        disabled={!prompt.hasSuggestedFile}
        title={prompt.hasSuggestedFile ? undefined : `L'épisode ${prompt.suggested} n'est pas téléchargé`}
        onclick={() => playback.answerSkipPrompt(prompt.suggested)}
      >
        Regarder le {prompt.suggested}
      </button>
      <!-- Enchaînement : chaque épisode fini laisse sa place au suivant dans la même fenêtre mpv -->
      <button
        class="btn btn-primary"
        type="button"
        disabled={!prompt.hasSuggestedFile}
        title={prompt.hasSuggestedFile
          ? `Joue le ${prompt.suggested}, puis chaque épisode à la suite jusqu'au ${prompt.requested}`
          : `L'épisode ${prompt.suggested} n'est pas téléchargé`}
        onclick={() => playback.answerSkipPrompt(prompt.suggested, prompt.requested)}
      >
        Enchaîner du {prompt.suggested} au {prompt.requested}
      </button>
    {/snippet}
  </Modal>
{/if}

<style>
  .clue {
    display: flex;
    align-items: flex-start;
    gap: var(--space4);
  }

  img {
    flex-shrink: 0;
    border: 2px solid var(--colorStar);
    border-radius: 50%;
  }

  p {
    color: var(--textSoft);
  }

  strong {
    color: var(--textSoft);
  }
</style>
