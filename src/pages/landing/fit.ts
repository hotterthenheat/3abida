/* A PANEL IS SHOWN WHOLE (2026-10-07 — the owner: "we're having a problem with my landing page's recordings and the aspect
   ratios"). A panel is filmed round one whole part of its page — the Weigher's contract card from its title, a column of
   Compass's cards, the strike ladder with its head — so its shape is that part's own, not the window's 1440 × 1000. The
   window shows it whole, in the middle, on its own ground (object-contain), and never cuts it to fill the window; the
   desk's and the phone's pictures keep the window's shape and fill it as before. */

/** a panel's picture or film, by its address (TerminalWindow shotFor / filmFor: `<page>-<theme>-panel`) */
export const isPanel = (src: string | null | undefined): boolean => !!src && /-panel(\.(webp|mp4)|$)/.test(src);

const sizeOf = (pic: CanvasImageSource): [number, number] => {
  if (pic instanceof HTMLVideoElement) return [pic.videoWidth, pic.videoHeight];
  if (pic instanceof HTMLImageElement) return [pic.naturalWidth, pic.naturalHeight];
  const p = pic as { width: number; height: number };
  return [p.width, p.height];
};

/** where a picture of w × h stands, whole and in the middle, in a box of W × H */
export const containIn = (w: number, h: number, W: number, H: number): { x: number; y: number; w: number; h: number } => {
  if (w < 1 || h < 1) return { x: 0, y: 0, w: W, h: H };
  const k = Math.min(W / w, H / h);
  return { x: (W - w * k) / 2, y: (H - h * k) / 2, w: w * k, h: h * k };
};

/** draw a picture over the whole of a W × H canvas: a panel whole in the middle on the ground (when one is given), anything
    else stretched to the box as it always was (its shape is the box's) */
export const drawFit = (ctx: CanvasRenderingContext2D, pic: CanvasImageSource, W: number, H: number, panel: boolean, ground?: string): void => {
  if (!panel) {
    ctx.drawImage(pic, 0, 0, W, H);
    return;
  }
  if (ground) {
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, W, H);
  }
  const [w, h] = sizeOf(pic);
  const r = containIn(w, h, W, H);
  ctx.drawImage(pic, r.x, r.y, r.w, r.h);
};
