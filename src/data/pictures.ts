/*
==================================================
  SLAYER TERMINAL - PICTURES, KEPT APART
  (data/pictures.ts)

  A screenshot is the most useful thing anyone
  attaches — to a post in the room, to a bug report
  — and the most expensive thing to keep. Two rules
  came out of measuring that (2026-09-13):

    SHRINK IT FIRST, which is ui/shrinkImage's job:
    a pasted retina screenshot arrives at 15MB as a
    data URL and no browser will keep it.

    KEEP IT ON ITS OWN KEY, which is this. A record
    stores picture IDS; the pictures live here. So a
    like does not rewrite every screenshot you ever
    posted, a quota failure on the pictures does not
    take the text with it, and the hot blob a store
    rewrites on every click stays small. Measured on
    the room: 754,100 characters -> 732.

  It is a factory rather than a module because there
  are two of them now, and the first one written by
  hand was already the second copy of a pattern —
  which is how a defect comes to exist twice.
==================================================
*/

import { readJson, writeKey } from './kept';

export interface PictureStore {
  /** Keep these data URLs; returns the ids the record should store instead */
  keep(dataUrls: readonly string[], prefix: string): string[];
  /** The pictures behind these ids. One storage has lost simply does not draw. */
  show(ids: readonly string[]): string[];
  /** Write to storage — false when the browser refused, which is worth saying */
  write(): boolean;
  /** A copy to put back when a write fails and the record is being rolled back */
  snapshot(): Record<string, string>;
  restore(snap: Record<string, string>): void;
  /** Forget every picture no record points at any more */
  sweep(live: Set<string>): void;
}

export function pictureStore(key: string): PictureStore {
  let blobs = readJson<Record<string, string>>(key, {});
  let seq = 0;
  return {
    keep(dataUrls, prefix) {
      const stamp = Date.now();
      const ids: string[] = [];
      const next = { ...blobs };
      for (const src of dataUrls) {
        const id = `${prefix}-${stamp}-${seq++}`;
        next[id] = src;
        ids.push(id);
      }
      blobs = next;
      return ids;
    },
    show(ids) {
      return ids.map(id => blobs[id]).filter((src): src is string => !!src);
    },
    write() {
      return writeKey(key, blobs);
    },
    snapshot() {
      return blobs;
    },
    restore(snap) {
      blobs = snap;
    },
    sweep(live) {
      const stale = Object.keys(blobs).filter(id => !live.has(id));
      if (stale.length === 0) return;
      const kept: Record<string, string> = {};
      for (const [id, src] of Object.entries(blobs)) if (live.has(id)) kept[id] = src;
      blobs = kept;
      writeKey(key, kept);
    },
  };
}
