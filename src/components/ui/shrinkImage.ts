/*
==================================================
  SLAYER TERMINAL - A PICKED IMAGE, MADE KEEPABLE
  (components/ui/shrinkImage.ts)

  A screenshot is the most useful thing anyone
  attaches — to a post in the room, to a bug report
  — and the one thing the browser cannot keep at the
  size it arrives. Measured (2026-09-13): two
  retina screenshots of a chart pasted into the
  composer came to 15MB each as a data URL, the
  write to localStorage threw QuotaExceeded, the
  catch swallowed it, and the post was gone on the
  next reload with nothing said.

  So every picked image comes through here first:
  drawn down to fit MAX_EDGE and re-encoded as JPEG,
  which takes a 15MB screenshot to about 150KB and
  keeps a chart legible at the size a feed shows it.

  PNG IS NOT KEPT. A screenshot of a terminal is a
  photograph of text, and PNG's lossless promise on
  that content is what costs the two orders of
  magnitude. Transparency goes with it, so the
  canvas is painted on a ground first — an alpha PNG
  re-encoded to JPEG without one comes out black.
==================================================
*/

/** The longest edge an attachment is kept at. A 4K screenshot lands here. */
export const MAX_EDGE = 1280;
/** JPEG quality — chart text stays legible, the bytes fall ~100x. */
export const QUALITY = 0.72;
/** The ground painted under a transparent image before it becomes JPEG. */
const GROUND = '#0a0a0a';

/**
 * A picked file as a data URL small enough to keep, or null when it is not an
 * image the browser can decode. Never throws — a file that will not decode is
 * a null the caller skips, not a broken attachment.
 */
export function shrinkImage(file: File, maxEdge = MAX_EDGE, quality = QUALITY): Promise<string | null> {
  return new Promise(resolve => {
    if (!file.type.startsWith('image/')) {
      resolve(null);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.fillStyle = GROUND;
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        /* a tainted canvas, or no 2d context — no attachment rather than a broken one */
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/** Every image among the picked files, shrunk, in the order they were picked. */
export async function shrinkAll(files: Iterable<File>, limit = 4): Promise<string[]> {
  const picked = [...files].filter(f => f.type.startsWith('image/')).slice(0, limit);
  const out = await Promise.all(picked.map(f => shrinkImage(f)));
  return out.filter((s): s is string => !!s);
}

/** Roughly how many bytes a data URL costs in storage (base64 is 4 chars per 3 bytes). */
export const dataUrlBytes = (dataUrl: string): number => Math.round((dataUrl.length - (dataUrl.indexOf(',') + 1)) * 0.75);
