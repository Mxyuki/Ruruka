<script lang="ts">
  import { untrack } from 'svelte';
  import type { ClipExtension, ClipPreset } from '../../lib/bridge';
  import { session } from '../../state/session.svelte';
  import { toasts } from '../../state/toasts.svelte';
  import Modal from '../Modal.svelte';

  interface Props {
    open: boolean;
    /** The preset the clip uses right now; it is the one shown first. */
    presetId: string;
    onuse: (id: string) => void;
    onclose: () => void;
  }

  let { open, presetId, onuse, onclose }: Props = $props();

  const extensions: ClipExtension[] = ['mp4', 'webm', 'mkv'];
  const tokens = '{videoKbps}  {maxrateKbps}  {bufsizeKbps}';

  const presets = $derived(session.settings?.clipPresets ?? []);
  const customPresets = $derived(presets.filter((preset) => !preset.isBuiltIn));

  let selectedId = $state('');
  let name = $state('');
  let command = $state('');
  let extension = $state<ClipExtension>('mp4');

  const selected = $derived(presets.find((preset) => preset.id === selectedId));
  const isReadOnly = $derived(selected?.isBuiltIn ?? true);
  const isModified = $derived(
    selected !== undefined && !selected.isBuiltIn && (name !== selected.name || command !== selected.arguments || extension !== selected.extension),
  );

  // <-- À l'ouverture, le réglage en cours est affiché ; ensuite chaque clic en choisit un autre -->
  $effect(() => {
    if (open) untrack(() => show(presets.find((preset) => preset.id === presetId) ?? presets[0]));
  });

  function show(preset: ClipPreset | undefined) {
    if (!preset) return;
    selectedId = preset.id;
    name = preset.name;
    command = preset.arguments;
    extension = preset.extension;
  }

  async function saveCustom(list: ClipPreset[]): Promise<boolean> {
    try {
      await session.updateSettings({ clipPresets: list });
      return true;
    } catch (error) {
      toasts.error(error, 'Impossible d’enregistrer ce réglage');
      return false;
    }
  }

  const newPreset = (fields: Pick<ClipPreset, 'name' | 'arguments' | 'extension'>): ClipPreset => ({
    id: `reglage-${crypto.randomUUID().slice(0, 8)}`,
    isBuiltIn: false,
    ...fields,
  });

  async function addPreset(fields: Pick<ClipPreset, 'name' | 'arguments' | 'extension'>) {
    const created = newPreset(fields);
    if (await saveCustom([...customPresets, created])) show(created);
  }

  const createBlank = () => addPreset({ name: 'Mon réglage', arguments: '-c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart', extension: 'mp4' });

  const duplicate = () => addPreset({ name: `${name} (copie)`.slice(0, 40), arguments: command, extension });

  async function saveChanges() {
    const updated = customPresets.map((preset) => (preset.id === selectedId ? { ...preset, name: name.trim(), arguments: command.trim(), extension } : preset));
    await saveCustom(updated);
  }

  async function remove() {
    const others = customPresets.filter((preset) => preset.id !== selectedId);
    const wasInUse = selectedId === presetId;
    if (!(await saveCustom(others))) return;
    const fallback = presets[0];
    show(fallback);
    if (wasInUse && fallback) onuse(fallback.id);
  }

  function use() {
    onuse(selectedId);
    onclose();
  }
</script>

<Modal {open} title="Réglages avancés des clips" width="820px" {onclose}>
  <p class="intro">
    Chaque réglage est une commande ffmpeg. Ruruka ajoute l’épisode, l’extrait, les pistes, les sous-titres et le cadrage : tu ne règles que l’encodage.
  </p>

  <div class="layout">
    <!-- La liste des réglages : ceux de Ruruka, puis les tiens -->
    <nav class="list" aria-label="Réglages">
      {#each presets as preset (preset.id)}
        <button class="chip" class:is-active={selectedId === preset.id} type="button" onclick={() => show(preset)}>
          {preset.name}{preset.id === presetId ? ' ✓' : ''}
        </button>
      {/each}
      <button class="btn btn-ghost btn-sm" type="button" onclick={createBlank}>+ Nouveau réglage</button>
    </nav>

    <!-- La commande du réglage choisi -->
    <div class="editor">
      <label class="field">
        <span class="field-label">Nom</span>
        <input class="input" maxlength="40" disabled={isReadOnly} bind:value={name} />
      </label>

      <div class="extension">
        <span class="field-label">Fichier</span>
        {#each extensions as option (option)}
          <button class="chip" class:is-active={extension === option} type="button" disabled={isReadOnly} onclick={() => (extension = option)}>
            .{option}
          </button>
        {/each}
      </div>

      <label class="field">
        <span class="field-label">Commande ffmpeg</span>
        <textarea class="input command" rows="7" spellcheck="false" readonly={isReadOnly} bind:value={command}></textarea>
      </label>
      <p class="hint">
        {#if isReadOnly}
          Ce réglage fait partie de Ruruka : duplique-le pour le modifier.
        {:else}
          Mets tes guillemets comme sur la ligne de commande. Un <code>-vf</code> s’ajoute au cadrage et aux sous-titres. Valeurs calculées pour viser 10 Mo : <code>{tokens}</code>.
        {/if}
      </p>
    </div>
  </div>

  {#snippet footer()}
    {#if !isReadOnly}
      <button class="btn btn-ghost" type="button" onclick={remove}>Supprimer</button>
    {/if}
    <button class="btn btn-ghost" type="button" onclick={duplicate}>Dupliquer</button>
    {#if isModified}
      <button class="btn btn-secondary" type="button" onclick={saveChanges}>Enregistrer</button>
    {/if}
    <button class="btn btn-primary" type="button" disabled={isModified} title={isModified ? 'Enregistre d’abord tes changements' : undefined} onclick={use}>
      Utiliser ce réglage
    </button>
  {/snippet}
</Modal>

<style>
  .intro {
    margin: 0 0 var(--space4);
    color: var(--textSoft);
    font-size: var(--fontSizeSm);
  }

  .layout {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    gap: var(--space4);
  }

  .list {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space2);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space1);
  }

  .editor {
    display: flex;
    flex-direction: column;
    gap: var(--space3);
  }

  .extension {
    display: flex;
    align-items: center;
    gap: var(--space2);
  }

  .chip {
    border: 0;
    cursor: pointer;
  }

  .chip:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .command {
    font-family: var(--fontFile);
    font-size: var(--fontSizeSm);
    resize: vertical;
  }

  .hint {
    margin: 0;
    color: var(--textFaint);
    font-size: var(--fontSizeSm);
  }

  code {
    font-family: var(--fontFile);
  }
</style>
