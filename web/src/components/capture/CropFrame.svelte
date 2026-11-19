<script lang="ts">
  import { moveRect, resizeRect, ratioInFractions, type CropHandle, type CropRect } from '../../lib/cropRect';

  interface Props {
    src: string;
    crop: CropRect;
    /** Width / height in pixels the crop must keep; null leaves it free. */
    ratio: number | null;
    naturalWidth: number;
    naturalHeight: number;
  }

  let { src, crop = $bindable(), ratio, naturalWidth = $bindable(), naturalHeight = $bindable() }: Props = $props();

  type DragKind = 'move' | CropHandle;
  interface Drag {
    kind: DragKind;
    startX: number;
    startY: number;
    origin: CropRect;
  }

  const cornerHandles: CropHandle[] = ['nw', 'ne', 'se', 'sw'];
  const allHandles: CropHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  const handlePositions: Record<CropHandle, [number, number]> = {
    nw: [0, 0],
    n: [50, 0],
    ne: [100, 0],
    e: [100, 50],
    se: [100, 100],
    s: [50, 100],
    sw: [0, 100],
    w: [0, 50],
  };

  let stage = $state<HTMLDivElement>();
  let drag: Drag | null = null;

  const fractionRatio = $derived(ratio && naturalWidth ? ratioInFractions(ratio, naturalWidth, naturalHeight) : null);
  const handles = $derived(fractionRatio === null ? allHandles : cornerHandles);

  function begin(event: PointerEvent, kind: DragKind) {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag = { kind, startX: event.clientX, startY: event.clientY, origin: crop };
  }

  function update(event: PointerEvent) {
    if (!drag || !stage) return;
    const box = stage.getBoundingClientRect();
    const deltaX = (event.clientX - drag.startX) / box.width;
    const deltaY = (event.clientY - drag.startY) / box.height;
    crop = drag.kind === 'move' ? moveRect(drag.origin, deltaX, deltaY) : resizeRect(drag.origin, drag.kind, deltaX, deltaY, fractionRatio);
  }

  function end() {
    drag = null;
  }
</script>

<!-- Image figée du lecteur, avec un cadre à déplacer et à tirer par ses poignées -->
<div class="stage" bind:this={stage}>
  <img {src} alt="Moment figé de l’épisode" draggable="false" bind:naturalWidth bind:naturalHeight />
  <div
    class="crop"
    role="presentation"
    style:left="{crop.x * 100}%"
    style:top="{crop.y * 100}%"
    style:width="{crop.width * 100}%"
    style:height="{crop.height * 100}%"
    onpointerdown={(event) => begin(event, 'move')}
    onpointermove={update}
    onpointerup={end}
    onpointercancel={end}
  >
    {#each handles as handle (handle)}
      <span
        class="handle h-{handle}"
        role="presentation"
        style:left="{handlePositions[handle][0]}%"
        style:top="{handlePositions[handle][1]}%"
        onpointerdown={(event) => begin(event, handle)}
        onpointermove={update}
        onpointerup={end}
        onpointercancel={end}
      ></span>
    {/each}
  </div>
</div>

<style>
  /* <-- La scène colle à l'image : les pourcentages du cadre sont ceux de l'image --> */
  .stage {
    position: relative;
    width: fit-content;
    max-width: 100%;
    margin: 0 auto;
    overflow: hidden;
    border: var(--outline);
    border-radius: var(--radiusSmall);
    background: var(--scrim);
    line-height: 0;
    touch-action: none;
    user-select: none;
  }

  img {
    display: block;
    max-width: 100%;
    max-height: 46vh;
  }

  /* <-- Cadre de recadrage : le reste de l'image est voilé --> */
  .crop {
    position: absolute;
    border: 2px solid var(--onImage);
    box-shadow: 0 0 0 100vmax color-mix(in srgb, var(--scrim) 62%, transparent);
    cursor: move;
  }

  .handle {
    position: absolute;
    width: 14px;
    height: 14px;
    border: var(--outlineThin);
    border-radius: 50%;
    background: var(--colorStar);
    transform: translate(-50%, -50%);
  }

  .h-nw,
  .h-se {
    cursor: nwse-resize;
  }

  .h-ne,
  .h-sw {
    cursor: nesw-resize;
  }

  .h-n,
  .h-s {
    cursor: ns-resize;
  }

  .h-e,
  .h-w {
    cursor: ew-resize;
  }
</style>
