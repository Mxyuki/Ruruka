<script lang="ts">
  import { invoke } from '../lib/bridge';
  import { library } from '../state/library.svelte';
  import { session } from '../state/session.svelte';
  import Icon from './Icon.svelte';

  async function choose() {
    const libraryRoot = await invoke('shell.pickFolder', { title: 'Choisis le dossier qui contient tes dossiers d’anime' });
    if (!libraryRoot) return;
    await session.updateSettings({ libraryRoot });
    void library.refresh();
  }
</script>

<div class="picker">
  <Icon name="folder" />
  <span class="path" class:is-empty={!session.settings?.libraryRoot}>
    {session.settings?.libraryRoot ?? 'Aucun dossier choisi'}
  </span>
  <button class="btn" type="button" onclick={choose}>
    {session.settings?.libraryRoot ? 'Changer…' : 'Choisir un dossier…'}
  </button>
</div>
<p class="hint">
  Un sous-dossier par série, par exemple <code>Anime/Sousou no Frieren/</code>. Ruruka relie chaque dossier à sa fiche
  AniList toute seule, et tu peux corriger un lien dans la Bibliothèque.
</p>

<style>
  .picker {
    display: flex;
    align-items: center;
    gap: var(--space3);
    padding: var(--space3) var(--space4);
    border-radius: var(--radiusSmall);
    background: var(--colorSunken);
    color: var(--textSoft);
  }

  .path {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    color: var(--textMain);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .path.is-empty {
    color: var(--textFaint);
  }

  .hint {
    margin-top: var(--space2);
    color: var(--textFaint);
    font-size: var(--fontSizeSm);
  }

  code {
    color: var(--textSoft);
  }
</style>
