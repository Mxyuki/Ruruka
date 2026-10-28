<script lang="ts">
  import { aboutSyntaxGroups, type AboutSyntax } from './aboutSyntax';

  interface Props {
    oninsert: (syntax: AboutSyntax) => void;
  }

  let { oninsert }: Props = $props();

  const exampleOf = (syntax: AboutSyntax) => `${syntax.before}${syntax.placeholder}${syntax.after}`.trim();
</script>

<div class="guide">
  <p class="tip">
    Entrée revient à la ligne, une ligne vide commence un nouveau paragraphe. Sélectionne du texte avant de cliquer sur « Insérer » pour
    l’entourer.
  </p>

  {#each aboutSyntaxGroups as group (group.title)}
    <section>
      <h3>{group.title}</h3>
      <ul>
        {#each group.entries as syntax (syntax.name)}
          <li>
            <div class="text">
              <strong>{syntax.name}</strong>
              <span>{syntax.description}</span>
              <code>{exampleOf(syntax)}</code>
            </div>
            <button class="btn btn-sm" type="button" onclick={() => oninsert(syntax)}>Insérer</button>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</div>

<style>
  .guide {
    display: flex;
    flex-direction: column;
    gap: var(--space5);
  }

  .tip {
    padding: var(--space3) var(--space4);
    border: var(--outlineThin);
    border-radius: var(--radiusSmall);
    background: var(--colorBlond);
    font-family: var(--fontHand);
    font-size: var(--fontSizeMd);
    transform: rotate(-0.6deg);
  }

  h3 {
    margin-bottom: var(--space2);
    font-size: var(--fontSizeMd);
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: var(--space2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    align-items: center;
    gap: var(--space3);
    padding: var(--space2) var(--space3);
    border-bottom: 1px dashed var(--colorLineStrong);
  }

  .text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .text span {
    color: var(--textFaint);
    font-size: var(--fontSizeSm);
  }

  code {
    align-self: flex-start;
    max-width: 100%;
    padding: 1px 8px;
    overflow-wrap: anywhere;
    border-radius: 4px;
    background: var(--colorSunken);
    color: var(--textSoft);
  }

  button {
    flex-shrink: 0;
  }
</style>
