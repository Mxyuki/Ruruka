<script lang="ts">
  import PageHeader from '../../components/PageHeader.svelte';
  import { groupWatch } from '../../state/groupWatch.svelte';
  import { toasts } from '../../state/toasts.svelte';
  import FriendPanel from './FriendPanel.svelte';
  import HostPanel from './HostPanel.svelte';

  let typedCode = $state('');

  async function open() {
    try {
      await groupWatch.host();
    } catch (error) {
      toasts.error(error, 'Impossible d’ouvrir la séance');
    }
  }

  async function join(event: SubmitEvent) {
    event.preventDefault();
    try {
      await groupWatch.join(typedCode);
      typedCode = '';
    } catch (error) {
      toasts.error(error, 'Impossible de rejoindre la séance');
    }
  }
</script>

<div class="page">
  <PageHeader title="Séance entre amis" note="On regarde ensemble, chacun garde son carnet à jour" />

  {#if groupWatch.role === 'hosting'}
    <HostPanel />
  {:else if groupWatch.role === 'joined'}
    <FriendPanel />
  {:else}
    <div class="choices">
      <!-- Ouvrir une séance -->
      <section class="card" style:--accent="var(--colorStrawberry)">
        <h2 class="note-label">Tu partages l’épisode</h2>
        <p>
          Ouvre une séance et donne le code à tes amis. Ensuite, choisis comment ils regardent : ton partage d’écran, leur propre fichier en
          même temps que toi, ou un flux direct depuis ton PC.
        </p>
        <button class="btn btn-primary" type="button" disabled={groupWatch.isConnecting} onclick={open}>Ouvrir une séance</button>
      </section>

      <!-- Rejoindre avec un code -->
      <section class="card" style:--accent="var(--colorSky)">
        <h2 class="note-label">Un ami partage l’épisode</h2>
        <p>Entre le code reçu : ta liste avance et ton profil en direct suit l’épisode jusqu’à la fin de la séance.</p>
        <form onsubmit={join}>
          <input class="input code" placeholder="XXXXX-XXXXX" spellcheck="false" autocomplete="off" maxlength="16" bind:value={typedCode} />
          <button class="btn btn-secondary" type="submit" disabled={groupWatch.isConnecting || !typedCode.trim()}>Rejoindre</button>
        </form>
      </section>
    </div>
  {/if}

  <p class="faint privacy">
    La séance passe par un relais public : personne n’a de port à ouvrir. Ce qui y circule est chiffré avec le code, garde-le entre amis. Le
    flux, lui, passe directement entre vos deux PC : vous voyez alors l’adresse IP l’un de l’autre.
  </p>
</div>

<style>
  .choices {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: var(--space5);
  }

  section {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space3);
    padding: var(--space5);
  }

  p {
    margin: 0;
  }

  form {
    display: flex;
    gap: var(--space3);
    width: 100%;
  }

  .code {
    flex: 1;
    font-family: var(--fontFile);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .privacy {
    margin-top: var(--space5);
    font-size: var(--fontSizeSm);
  }
</style>
