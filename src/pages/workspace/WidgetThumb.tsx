/*
==================================================
  SLAYER TERMINAL - WIDGET PREVIEW
  Not a drawing of the panel — the PANEL, rendered
  live at desk-size and scaled down into a tile.

  So the preview is the real component with the real
  session data in it: the candles are today's, the
  heat is today's heat. It cannot drift from the
  product the way an illustration or a captured
  screenshot would, because it IS the product.

  Pointer events are off and the whole thing is
  inert — it is a picture that happens to be alive.
==================================================
*/

import type { WidgetDef, WorkspaceCtx } from './registry';

/** Layout size the panel is rendered at before being scaled into the tile. */
const RENDER_W = 640;
const RENDER_H = 420;

interface WidgetThumbProps {
  def: WidgetDef;
  ctx: WorkspaceCtx | null;
  /** Tile width in px — height follows the panel's aspect */
  width?: number;
}

const WidgetThumb = ({ def, ctx, width = 116 }: WidgetThumbProps) => {
  const scale = width / RENDER_W;
  const height = Math.round(RENDER_H * scale);

  return (
    <span
      className="shrink-0 rounded border border-borderSubtle bg-inset overflow-hidden relative block"
      style={{ width, height }}
      aria-hidden
    >
      {ctx && (
        <span
          // A real panel brings real controls with it. pointer-events stops the
          // mouse, but `inert` is what keeps them out of the tab order and off
          // the accessibility tree — this is a picture, not a control surface.
          ref={el => el?.setAttribute('inert', '')}
          className="absolute top-0 left-0 origin-top-left pointer-events-none select-none block"
          style={{ width: RENDER_W, height: RENDER_H, transform: `scale(${scale})` }}
        >
          {def.render(ctx)}
        </span>
      )}
    </span>
  );
};

export default WidgetThumb;
