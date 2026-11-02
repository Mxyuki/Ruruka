<script lang="ts">
  interface Props {
    columns: { label: string; count: number }[];
    /** Read in the tooltip after the count, such as "anime". */
    unit: string;
  }

  let { columns, unit }: Props = $props();

  const maxCount = $derived(Math.max(1, ...columns.map((column) => column.count)));
  // <-- Avec beaucoup de colonnes (les années), seule une étiquette sur quelques-unes reste lisible -->
  const labelStep = $derived(Math.max(1, Math.ceil(columns.length / 12)));
</script>

<!-- Histogramme : une colonne par note ou par année -->
<div class="chart" style:--columnCount={columns.length}>
  {#each columns as column, index (column.label)}
    <div class="column" title="{column.label} : {column.count.toLocaleString('fr-FR')} {unit}">
      <span class="bar" style:height="{(column.count / maxCount) * 100}%"></span>
      <span class="label">{index % labelStep === 0 ? column.label : ''}</span>
    </div>
  {/each}
</div>

<style>
  .chart {
    display: grid;
    grid-template-columns: repeat(var(--columnCount), minmax(0, 1fr));
    align-items: end;
    gap: 2px;
    height: 160px;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--colorLine);
  }

  .column {
    position: relative;
    display: flex;
    align-items: flex-end;
    height: 100%;
  }

  .column:hover .bar {
    background: var(--colorPlum);
  }

  .bar {
    width: 100%;
    min-height: 2px;
    border-radius: 4px 4px 0 0;
    background: var(--colorMauve);
  }

  .label {
    position: absolute;
    top: 100%;
    left: 50%;
    padding-top: 4px;
    color: var(--textFaint);
    font-family: var(--fontFile);
    font-size: var(--fontSizeXs);
    white-space: nowrap;
    transform: translateX(-50%);
  }
</style>
