/*
  THE RIGHT-CLICK ON A LEVEL (the owner's item 7, 2026-10-14: "right-click a level for 'alert on this level (follows
  it)'"): on Terrain's chart, a right-click within a few pixels of the flip, a wall, a ±σ line or one of the three
  heaviest strikes opens a card that turns that level's watch on or off for the name — the watch follows the level's
  identity as it moves (data/levelAlerts.ts). Anywhere else the chart's own card opens, as before.
*/
import { useEffect, useRef, useState } from 'react';
import type { ChartLayerApi } from '../gex/StrikeChart';
import { LEVEL_NAMES, setConfirmBars, setLevelWatch, useLevelWatches, type LevelId } from '../../data/levelAlerts';

interface Props {
  api: ChartLayerApi;
  ticker: string;
  levels: { callWall: number | null; putWall: number | null; flip: number | null };
  /** The three heaviest strikes, heaviest first */
  top: number[];
  /** ±1σ and ±2σ priced at the prior close */
  sigma: { prevClose: number; s: number } | null;
}

const NEAR_PX = 8;
const fmt = (k: number) => (Math.abs(k % 1) < 1e-9 ? k.toFixed(0) : k.toFixed(2));

const LevelAlertMenu = ({ api, ticker, levels, top, sigma }: Props) => {
  const watches = useLevelWatches();
  const [open, setOpen] = useState<{ x: number; y: number; id: LevelId; price: number; label: string } | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const inputs = useRef({ levels, top, sigma });
  inputs.current = { levels, top, sigma };

  useEffect(() => {
    const host = api.host();
    if (!host) return;
    const onMenu = (e: MouseEvent) => {
      const series = api.series();
      if (!series) return;
      const box = host.getBoundingClientRect();
      const y = e.clientY - box.top;
      const { levels: lv, top: tp, sigma: sg } = inputs.current;
      const cands: { id: LevelId; price: number; label: string }[] = [];
      if (lv.flip != null) cands.push({ id: 'flip', price: lv.flip, label: `The flip · ${lv.flip.toFixed(2)}` });
      if (lv.callWall != null) cands.push({ id: 'callWall', price: lv.callWall, label: `The call wall · ${fmt(lv.callWall)}` });
      if (lv.putWall != null) cands.push({ id: 'putWall', price: lv.putWall, label: `The put wall · ${fmt(lv.putWall)}` });
      for (const k of tp.slice(0, 3)) if (k !== lv.callWall && k !== lv.putWall) cands.push({ id: 'top3', price: k, label: `${fmt(k)} · one of the three heaviest strikes` });
      if (sg) for (const z of [2, 1, -1, -2]) cands.push({ id: 'sigma', price: sg.prevClose + z * sg.s, label: `${z > 0 ? '+' : '−'}${Math.abs(z)}σ · ${(sg.prevClose + z * sg.s).toFixed(2)}, priced at the prior close` });
      let best: (typeof cands)[number] | null = null;
      let bestD = NEAR_PX;
      for (const c of cands) {
        const cy = series.priceToCoordinate(c.price);
        if (cy == null) continue;
        const d = Math.abs(cy - y);
        if (d <= bestD) {
          bestD = d;
          best = c;
        }
      }
      if (!best) return;
      e.preventDefault();
      /* ONE CARD: the chart's reset card is this card's last line */
      e.stopPropagation();
      setOpen({ x: e.clientX - box.left, y, ...best });
    };
    host.addEventListener('contextmenu', onMenu);
    return () => host.removeEventListener('contextmenu', onMenu);
  }, [api]);

  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (cardRef.current && e.target instanceof Node && cardRef.current.contains(e.target)) return;
      setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(null);
      }
    };
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('wheel', away, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', away, true);
      window.removeEventListener('wheel', away, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  if (!open) return null;
  const host = api.host();
  const w = host?.clientWidth ?? 800;
  const h = host?.clientHeight ?? 500;
  const pos = { left: Math.max(8, Math.min(open.x + 4, w - 280)), top: Math.max(8, Math.min(open.y + 4, h - 200)) };
  const t = ticker.toUpperCase();
  const watch = watches[t];
  const on = !!watch?.ids.includes(open.id);
  const item = (label: string, hint: string, run: () => void, testId: string, pressed?: boolean) => (
    <button
      key={testId}
      type="button"
      aria-pressed={pressed}
      onClick={() => {
        run();
        setOpen(null);
      }}
      className="hit w-full flex flex-col items-start px-2 py-1.5 rounded-md text-left transition-colors hover:bg-ink/[0.06] text-textPrimary"
      data-chart-menu-item={testId}
    >
      <span className="text-[12px] leading-snug">{label}</span>
      <span className="text-[11px] leading-snug text-textMuted">{hint}</span>
    </button>
  );
  return (
    <div ref={cardRef} className="absolute z-[60] w-[272px] rounded-md border border-borderMuted bg-panel p-1.5 shadow-[0_14px_40px_rgba(0,0,0,0.5)] animate-soft-in" style={pos} onContextMenu={e => e.preventDefault()} data-chart-menu="level-alert" data-theme="dark">
      <div className="px-2 pt-1 pb-1.5 text-[12px] font-semibold text-textPrimary">{open.label}</div>
      {on
        ? item(`Stop the alert on ${LEVEL_NAMES[open.id]}`, `${t}'s watch lets ${LEVEL_NAMES[open.id]} go`, () => setLevelWatch(t, open.id, false), 'level-alert-off')
        : item(
            'Alert on this level (follows it)',
            open.id === 'flip'
              ? 'A notice once three minutes in a row close beyond the flip (the count is yours) — the flip as it moves'
              : open.id === 'callWall' || open.id === 'putWall'
                ? 'Rings when price touches the wall once it has stood 15 minutes; a move of two strikes or more is a notice'
                : open.id === 'top3'
                  ? 'A notice when a strike enters the three heaviest and holds'
                  : 'A notice when price touches ±1σ or ±2σ',
            () => setLevelWatch(t, open.id, true),
            'level-alert-on'
          )}
      {open.id === 'flip' && on && (
        <div className="mt-1 pt-1 border-t border-borderSubtle px-2 py-1.5 flex items-center gap-2">
          <span className="text-[11px] text-textMuted">Closed minutes beyond it</span>
          <span role="group" aria-label="Closed minutes beyond the flip before its notice" className="inline-flex items-center gap-0.5 rounded-[3px] border border-ink/[0.10] p-px">
            {[1, 2, 3].map(n => (
              <button key={n} type="button" aria-pressed={watch?.confirmBars === n} onClick={() => setConfirmBars(t, n)} className={`hit h-[18px] px-1.5 rounded-[2px] font-mono text-[11px] ${watch?.confirmBars === n ? 'bg-ink/[0.14] text-textPrimary font-semibold' : 'text-textMuted hover:text-textPrimary'}`}>
                {n}
              </button>
            ))}
          </span>
        </div>
      )}
      <div className="mt-1 pt-1 border-t border-borderSubtle">{item('Reset chart view · Alt+R', 'Back to how the chart first opened', () => api.reset(), 'reset-view')}</div>
    </div>
  );
};

export default LevelAlertMenu;
