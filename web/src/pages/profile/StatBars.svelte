<script lang="ts" module>
  export interface StatBar {
    label: string;
    count: number;
    /** Mean score out of 100; 0 or absent when nothing was scored. */
    meanScore?: number;
    href?: string;
  }
</script>

<script lang="ts">
  interface Props {
    bars: StatBar[];
  }

  let { bars }: Props = $props();

  const maxCount = $derived(Math.max(1, ...bars.map((bar) => bar.count)));
  const describe = (bar: StatBar) => `${bar.label} : ${bar.count.toLocaleString('fr-FR')}${bar.meanScore ? ` · note moyenne ${bar.meanScore.toFixed(0)}` : ''}`;
</script>

<!-- Une barre par ligne, longueur relative à la plus grande ; le chiffre reste écrit à côté -->
<ul>
  {#each bars as bar (bar.label)}
    <li title={describe(bar)}>
      {#if bar.href}
        <a class="label" href={bar.href}>{bar.label}</a>
      {:else}
        <span class="label">{bar.label}</span>
      {/if}
      <span class="track"><span class="fill" style:width="{(bar.count / maxCount) * 100}%"></span></span>
      <span class="value">
        {bar.count.toLocaleString('fr-FR')}
        {#if bar.meanScore}<small>★ {bar.meanScore.toFixed(0)}</small>{/if}
      </span>
    </li>
  {/each}
</ul>

<style>
  ul {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    grid-template-columns: minmax(0, 9rem) minmax(0, 1fr) 5.5rem;
    align-items: center;
    gap: var(--space3);
    min-height: 26px;
    padding: 0 var(--space1);
    border-radius: var(--radiusSmall);
  }

  li:hover {
    background: var(--colorSunken);
  }

  .label {
    overflow: hidden;
    font-size: var(--fontSizeSm);
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  a.label:hover {
    color: var(--textSoft);
  }

  .track {
    height: 12px;
  }

  .fill {
    display: block;
    min-width: 4px;
    height: 100%;
    border-radius: 0 4px 4px 0;
    background: var(--colorMauve);
  }

  .value {
    font-family: var(--fontFile);
    font-size: var(--fontSizeSm);
    text-align: right;
  }

  small {
    color: var(--textFaint);
  }
</style>
