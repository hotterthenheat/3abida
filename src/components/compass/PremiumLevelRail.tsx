/*
==================================================
  SLAYER TERMINAL - THE PREMIUM LEVEL RAIL
  (components/compass/PremiumLevelRail.tsx)

  The setup's levels BESIDE the premium chart, on
  its own price axis — the way a Terrain pane's
  panel hangs its capsules off the chart (Noah,
  2026-09-12: "the tp1 2 3 4 floor and all the
  other information isn't shown on the side tab
  like this — it should be shown the way terrain
  has those led exposure cause I feel like its
  nice and clean that way"). One column, one
  capsule per level at the exact height the chart
  puts that premium: the targets in the bull
  family (banked solid, working bright, pending
  quiet), the stop in the warning ink, the entry
  as a white rule, NOW in the house silver. A
  level above the frame is pinned at the top with
  ▲; a level below it is pinned at the foot with
  ▼; two that would overlap are eased apart, so
  nothing is ever drawn over anything.

  Placed in a frame loop off the chart's own
  projection (the ProfilePanel's rule): the axis
  moves on autoscale, drag and resize, none of
  which are React renders. The pills are DOM, so
  they stay crisp text; only their transforms are
  written per frame, and only when they moved.
==================================================
*/

import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Check } from 'lucide-react';
import type { TrackLevel } from './trackModel';
import type { PremiumProjectionApi } from '../gex/ContractPremiumPane';

/** The band the head owns — no capsule is drawn in it */
const HEAD_BAND = 26;
/** Two capsules never sit closer than this */
const PITCH = 22;
const CAPSULE_H = 18;

interface Placed {
  key: string;
  y: number;
  /** pinned at an edge — the level is off the frame */
  edge: 'up' | 'down' | null;
}

interface PremiumLevelRailProps {
  levels: TrackLevel[];
  /** The chart's projection — read in the frame loop, never a render */
  projection: MutableRefObject<PremiumProjectionApi | null>;
  /** The floor broke — the ladder freezes; targets stop being "working" */
  retired?: boolean;
  width?: number;
  className?: string;
}

const inkFor = (status: TrackLevel['status'], retired: boolean): { box: string; dot: string } => {
  switch (status) {
    case 'HIT':
      return { box: 'bg-bull text-[#0a0a0a] border-bull', dot: 'bg-[#0a0a0a]/40' };
    case 'IN PROGRESS':
      return retired ? { box: 'border-bull/40 text-bull/70 bg-bull/[0.05]', dot: 'bg-bull/60' } : { box: 'border-bull text-bull bg-bull/[0.10]', dot: 'bg-bull' };
    case 'PENDING':
      return { box: 'border-bull/40 text-bull/80 bg-bull/[0.04]', dot: 'bg-bull/50' };
    case 'STOP':
      return { box: 'border-warn text-warn bg-warn/[0.10]', dot: 'bg-warn' };
    case 'REF':
    default:
      return { box: 'border-textPrimary/40 text-textPrimary bg-ink/[0.05]', dot: 'bg-textPrimary/70' };
  }
};

const wordsFor = (l: TrackLevel): string => {
  const name = l.label.replace(/^TP(\d)/, 'Target $1').replace(/^REF$/i, 'Entry').replace(/^STOP$/i, 'Stop');
  return name;
};

const PremiumLevelRail = ({ levels, projection, retired = false, width = 168, className = '' }: PremiumLevelRailProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pillRefs = useRef(new Map<string, HTMLDivElement>());
  const [placed, setPlaced] = useState<Placed[]>([]);
  const placedRef = useRef<Placed[]>([]);
  const [nowPx, setNowPx] = useState<number | null>(null);
  const [foot, setFoot] = useState(0);

  /* THE FRAME LOOP — place every capsule where the chart puts its premium,
     ease overlaps apart, pin the off-frame ones at the edges; write the
     transforms straight to the DOM and re-render React only when a set
     changed (an edge flipped, a level came or went). */
  useEffect(() => {
    let raf = 0;
    let lastKey = '';
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const p = projection.current;
      const root = rootRef.current;
      if (!p || !root) return;
      const H = p.plotHeight();
      if (!H || H < 60) return;
      const footY = H; // the time-axis band starts here
      const last = p.last();
      const now = last != null ? p.yFor(last) : null;

      type Row = { key: string; y: number; edge: 'up' | 'down' | null };
      const rows: Row[] = [];
      for (const l of levels) {
        const y = p.yFor(l.premium);
        if (y == null || !Number.isFinite(y)) {
          /* docked or unprojectable: pinned above */
          rows.push({ key: l.key, y: HEAD_BAND + CAPSULE_H / 2, edge: 'up' });
          continue;
        }
        if (y < HEAD_BAND + CAPSULE_H / 2) rows.push({ key: l.key, y: HEAD_BAND + CAPSULE_H / 2, edge: 'up' });
        else if (y > footY - CAPSULE_H / 2 - 2) rows.push({ key: l.key, y: footY - CAPSULE_H / 2 - 2, edge: 'down' });
        else rows.push({ key: l.key, y, edge: null });
      }
      if (now != null && Number.isFinite(now)) {
        const y = Math.min(footY - CAPSULE_H / 2 - 2, Math.max(HEAD_BAND + CAPSULE_H / 2, now));
        rows.push({ key: 'now', y, edge: now < HEAD_BAND ? 'up' : now > footY ? 'down' : null });
      }
      /* Ease overlaps apart: top to bottom, each at least PITCH below the last */
      rows.sort((a, b) => a.y - b.y);
      for (let i = 1; i < rows.length; i++) if (rows[i].y - rows[i - 1].y < PITCH) rows[i].y = rows[i - 1].y + PITCH;
      /* …and back up from the foot if the stack ran past it */
      for (let i = rows.length - 1; i >= 0; i--) {
        const cap = i === rows.length - 1 ? footY - CAPSULE_H / 2 - 2 : rows[i + 1].y - PITCH;
        if (rows[i].y > cap) rows[i].y = cap;
      }

      for (const r of rows) {
        const el = pillRefs.current.get(r.key);
        if (el) el.style.transform = `translateY(${Math.round(r.y - CAPSULE_H / 2)}px)`;
      }
      const key = rows.map(r => `${r.key}:${r.edge ?? ''}`).join('|') + `|${Math.round(footY)}|${now != null ? 1 : 0}`;
      if (key !== lastKey) {
        lastKey = key;
        placedRef.current = rows;
        setPlaced(rows.map(r => ({ key: r.key, y: r.y, edge: r.edge })));
        setFoot(Math.round(footY));
        setNowPx(now);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [levels, projection]);

  const byKey = new Map(levels.map(l => [l.key, l]));
  const lastPremium = projection.current?.last() ?? null;

  return (
    <div ref={rootRef} className={`relative shrink-0 select-none border-l border-borderSubtle overflow-hidden ${className}`} style={{ width }} data-premium-rail aria-label="The setup's levels on the premium axis">
      {/* THE HEAD — the column's one word */}
      <div className="absolute inset-x-0 top-0 flex items-center px-2 text-[10px] text-textSecondary" style={{ height: HEAD_BAND }}>
        Levels <span className="ml-1 text-textMuted">· premium</span>
      </div>
      {/* THE CAPSULES */}
      {[...levels.map(l => l.key), 'now'].map(key => {
        const l = byKey.get(key);
        const row = placed.find(r => r.key === key);
        if (key === 'now' && nowPx == null) return null;
        const ink = key === 'now' ? { box: 'bg-silverFill text-[#0a0a0a] border-silverFill', dot: 'bg-[#0a0a0a]/40' } : inkFor(l!.status, retired);
        const words = key === 'now' ? 'Now' : wordsFor(l!);
        const price = key === 'now' ? lastPremium : l!.premium;
        const edge = row?.edge ?? null;
        return (
          <div
            key={key}
            ref={el => {
              if (el) pillRefs.current.set(key, el);
              else pillRefs.current.delete(key);
            }}
            className="absolute left-2 right-2 will-change-transform"
            style={{ top: 0, height: CAPSULE_H, opacity: row ? 1 : 0 }}
            data-premium-level={key}
            data-edge={edge ?? undefined}
            title={l ? `${words} · $${l.premium.toFixed(2)} · ${l.fromRefPct >= 0 ? '+' : ''}${l.fromRefPct.toFixed(0)}% from entry${l.spotNeeded != null ? ` · needs ${l.spotNeeded.toFixed(2)}` : ''}${l.docked ? ' · above the frame' : ''}` : undefined}
          >
            <span className={`flex items-center gap-1.5 h-full px-1.5 rounded-[4px] border font-mono text-[10px] font-semibold tnum whitespace-nowrap ${ink.box} ${edge ? 'opacity-80' : ''}`}>
              {/* the LED — a lit bar at the capsule's leading edge, the Terrain panel's end cap */}
              <span aria-hidden className={`w-[3px] h-[10px] rounded-full ${ink.dot}`} />
              {edge === 'up' && <span aria-hidden>▲</span>}
              {edge === 'down' && <span aria-hidden>▼</span>}
              {l?.status === 'HIT' && <Check className="w-3 h-3" aria-hidden />}
              <span className="truncate">{words}</span>
              <span className="ml-auto">{price != null ? `$${price.toFixed(2)}` : '—'}</span>
            </span>
          </div>
        );
      })}
      {/* THE FOOT — the time-axis band, so the column ends where the chart's plot does */}
      {foot > 0 && <div className="absolute inset-x-0 border-t border-borderSubtle" style={{ top: foot }} aria-hidden />}
    </div>
  );
};

export default PremiumLevelRail;
