<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchViewerAbout } from '../../api/queries/user';
  import EmptyState from '../../components/EmptyState.svelte';
  import Icon from '../../components/Icon.svelte';
  import LoadingState from '../../components/LoadingState.svelte';
  import PageHeader from '../../components/PageHeader.svelte';
  import { hasLiveTags } from '../../lib/aboutTemplate';
  import { navigate } from '../../lib/router.svelte';
  import { userPath } from '../../lib/routes';
  import { liveAbout } from '../../state/liveAbout.svelte';
  import { session } from '../../state/session.svelte';
  import { toasts } from '../../state/toasts.svelte';
  import AboutSidePane from './AboutSidePane.svelte';
  import { quickSyntaxes, type AboutSyntax } from './aboutSyntax';

  // <-- L'aperçu attend une courte pause dans la frappe : chaque rendu recharge les lecteurs YouTube -->
  const previewDelayMs = 400;

  let savedAbout = $state<string | null>(null);
  let loadError = $state<string | null>(null);
  let draft = $state('');
  let previewSource = $state('');
  let isSaving = $state(false);
  let textarea = $state<HTMLTextAreaElement>();

  const profilePath = $derived(userPath(session.viewer?.name ?? ''));
  const hasChanges = $derived(savedAbout !== null && draft !== savedAbout);
  const isLive = $derived(hasLiveTags(draft));

  // <-- Un modèle en direct vit sur ce PC : c'est lui qu'on modifie, pas sa version remplie sur AniList -->
  onMount(async () => {
    try {
      const about = liveAbout.template || (await fetchViewerAbout());
      savedAbout = about;
      draft = about;
      previewSource = about;
    } catch (error) {
      loadError = error instanceof Error ? error.message : String(error);
    }
  });

  $effect(() => {
    const text = draft;
    const timer = setTimeout(() => (previewSource = text), previewDelayMs);
    return () => clearTimeout(timer);
  });

  // <-- Entoure la sélection avec la balise, ou insère l'exemple, puis sélectionne le contenu à remplacer -->
  function insert(syntax: AboutSyntax) {
    if (!textarea) return;
    const { selectionStart: start, selectionEnd: end } = textarea;
    const content = textarea.value.slice(start, end) || syntax.placeholder;
    textarea.focus();
    textarea.setRangeText(`${syntax.before}${content}${syntax.after}`, start, end);
    const contentStart = start + syntax.before.length;
    textarea.setSelectionRange(contentStart, contentStart + content.length);
    draft = textarea.value;
  }

  async function save() {
    const name = session.viewer?.name;
    if (!name || !hasChanges || isSaving) return;
    isSaving = true;
    try {
      await liveAbout.save(draft);
      savedAbout = draft;
      toasts.success('Présentation enregistrée, le dossier est à jour !');
      navigate(userPath(name));
    } catch (error) {
      toasts.error(error, 'Impossible d’enregistrer la présentation');
    } finally {
      isSaving = false;
    }
  }

  function onkeydown(event: KeyboardEvent) {
    if (!event.ctrlKey || event.key.toLowerCase() !== 's') return;
    event.preventDefault();
    void save();
  }
</script>

<div class="page">
  <PageHeader title="Ma présentation" note="Le dossier que liront les autres détectives">
    {#snippet actions()}
      <a class="btn btn-ghost" href="#{profilePath}">Annuler</a>
      <button class="btn btn-primary" type="button" disabled={!hasChanges || isSaving} onclick={save}>
        <Icon name="check" size={16} />
        {isSaving ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    {/snippet}
  </PageHeader>

  {#if loadError}
    <EmptyState title="Dossier inaccessible" message={loadError} />
  {:else if savedAbout === null}
    <LoadingState />
  {:else}
    {#if isLive}
      <p class="live-note">
        Profil en direct : ce texte reste sur ce PC. AniList reçoit sa version remplie, mise à jour toutes les 15 secondes environ pendant
        un épisode, puis au repos quand mpv se ferme.
      </p>
    {/if}
    <div class="workspace">
      <!-- Brouillon : markdown AniList ou HTML -->
      <section class="card pane">
        <div class="toolbar" role="toolbar" aria-label="Mise en forme">
          {#each quickSyntaxes as syntax (syntax.name)}
            <button class="chip" type="button" title={syntax.description} onclick={() => insert(syntax)}>{syntax.name}</button>
          {/each}
        </div>
        <textarea
          bind:this={textarea}
          bind:value={draft}
          {onkeydown}
          spellcheck="false"
          aria-label="Texte de la présentation"
          placeholder="Raconte qui tu es, ce que tu regardes… Le guide des balises est à droite."
        ></textarea>
      </section>

      <AboutSidePane source={previewSource} oninsert={insert} />
    </div>
  {/if}
</div>

<style>
  .workspace {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space5);
    height: clamp(520px, calc(100vh - var(--titleBarHeight) - 220px), 1600px);
  }

  @media (max-width: 1100px) {
    .workspace {
      grid-template-columns: minmax(0, 1fr);
      height: auto;
    }

    .workspace > :global(.pane) {
      height: 70vh;
    }
  }

  .pane {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space2);
    padding: var(--space3) var(--space4);
    border-bottom: var(--outlineThin);
    background: var(--colorSunken);
  }

  /* <-- Page de carnet : les lignes suivent le texte au défilement --> */
  textarea {
    flex: 1;
    width: 100%;
    padding: 4px var(--space4) var(--space4);
    border: 0;
    background: var(--ruledLines), var(--colorPaper);
    background-attachment: local;
    color: var(--textMain);
    font-family: var(--fontFile);
    font-size: var(--fontSizeSm);
    line-height: 28px;
    resize: none;
  }

  textarea:focus {
    outline: none;
  }

  textarea::placeholder {
    color: var(--textFaint);
  }

  .live-note {
    margin-bottom: var(--space4);
    padding: var(--space3) var(--space4);
    border: var(--outlineThin);
    border-radius: var(--radiusSmall);
    background: var(--colorSkySoft);
    font-weight: 700;
  }
</style>
