/*
==================================================
  SLAYER TERMINAL - THE WATCHLIST (components/layout/WatchlistDrawer.tsx)

  One watchlist of NAMES for the whole shell (the ideas
  report, 2026-10-10: the Weigher's contracts, Trace's
  bookmarks and Compass's Tracker were three separate
  "keep an eye on it" lists, none of them of names).
  The rail's Watchlist door opens it at the right, the
  alerts drawer's glass and grammar; the command line
  adds to it ("watch NVDA" — data/nameWatch.ts
  `watchName`).

  A ROW is a name: its mark, its price and the day's
  change (the market store's one quote), and where it
  stands against Pinpoint's book — the nearest of the
  call wall, the put wall and the flip, and how far
  (data/pinpointBook.ts, the same scan every Pinpoint
  page reads). A press sets the terminal's name, or a
  link group's when one is picked at the head. A
  flag, a section, a place in it; the contract lists
  stay where they are, and the row links to them when
  they hold something on the name.

  Kept on this machine. Esc closes it (ui/layers.ts).
==================================================
*/

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, Eye, Flag, FolderPlus, MoreHorizontal, Plus, X } from 'lucide-react';
import Simulator from '../../core/simulator';
import { changeTicker, setLinkGroup, useActiveTicker, useLinkGroups, useNow, useQuote, LINK_GROUPS, type LinkGroup } from '../../context/marketStore';
import { useWatch } from '../../context/WatchContext';
import { useTracker } from '../../context/TrackerContext';
import { useWatchlist } from '../../data/watchlist';
import { profileOf, scanOf, type Scan } from '../../data/pinpointBook';
import {
  MAX_NAMES, addSection, closeWatchlist, moveName, nudgeName, removeSection, renameSection, restoreName, restoreSection, setNameFlag, unwatchName, useNameWatch, useWatchlistOpen,
  watchName, type WatchSection, type WatchedName,
} from '../../data/nameWatch';
import { pctSigned, usd } from '../../core/format';
import { dirOf } from '../../theme/theme';
import CompanyLogo from '../ui/CompanyLogo';
import DropdownSelect, { type DropdownOption } from '../ui/DropdownSelect';
import TickerLookup from '../ui/TickerLookup';
import { useOverlay } from '../ui/layers';
import { undoable } from '../ui/undo';

type Target = 'name' | LinkGroup;
const fmtLevel = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));

/** Where a name stands against Pinpoint's book: the nearest of the walls and the flip, and how far, in percent of price */
function nearestLevel(scan: Scan | null, spot: number | null): { word: string; at: number; pct: number } | null {
  if (!scan || spot == null || !(spot > 0)) return null;
  const lv = profileOf(scan.snap).levels;
  const marks = [
    { word: 'call wall', at: lv.callWall },
    { word: 'put wall', at: lv.putWall },
    { word: 'flip', at: lv.flip },
  ].filter(m => Number.isFinite(m.at) && m.at > 0);
  if (!marks.length) return null;
  const near = marks.reduce((a, b) => (Math.abs(b.at - spot) < Math.abs(a.at - spot) ? b : a));
  return { ...near, pct: ((near.at - spot) / spot) * 100 };
}

const IconButton = ({ onClick, label, title, pressed, children, testId }: { onClick: () => void; label: string; title?: string; pressed?: boolean; children: ReactNode; testId?: string }) => (
  <button
    type="button"
    onClick={e => {
      e.stopPropagation();
      onClick();
    }}
    aria-label={label}
    title={title ?? label}
    aria-pressed={pressed}
    className={`hit shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md transition-colors ${pressed ? 'text-silver' : 'text-textMuted hover:text-textPrimary'} hover:bg-ink/[0.06]`}
    data-watch-action={testId}
  >
    {children}
  </button>
);

/** One name's row — its own quote, so a row renders when ITS name moves */
const NameRow = ({
  n, section, sections, on, onPick, links, scanAt,
}: {
  n: WatchedName;
  section: WatchSection;
  sections: WatchSection[];
  on: boolean;
  onPick: (symbol: string) => void;
  links: { label: string; to: string }[];
  /** the scan's clock, so the book's read moves with it */
  scanAt: number;
}) => {
  const q = useQuote(n.symbol);
  /* the room's scan of the name — the book's levels, and the price for a name the feed has not seeded */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const scan = useMemo(() => scanOf(n.symbol), [n.symbol, scanAt]);
  const cfg = q ? null : Simulator.TICKERS[n.symbol];
  const spot = q?.spot ?? cfg?.currentPrice ?? scan?.snap.spot ?? null;
  const change = q?.changePct ?? (cfg ? Simulator.dayChangePct(n.symbol) : (scan?.snap.changePercent ?? null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const near = useMemo(() => nearestLevel(scan, spot), [scan, spot != null]);
  const [more, setMore] = useState(false);
  const navigate = useNavigate();
  const index = section.names.indexOf(n);
  const take = () => {
    const back = unwatchName(n.symbol);
    if (back) undoable({ label: `Took ${n.symbol} off the watchlist`, undo: () => restoreName(back), key: `watch-off-${n.symbol}` });
  };
  const sectionOptions: DropdownOption<string>[] = sections.map(s => ({ value: s.id, label: s.name, hint: `${s.names.length} name${s.names.length === 1 ? '' : 's'}` }));
  return (
    <li className={`group rounded-md border ${on ? 'border-silver/50 bg-ink/[0.035]' : 'border-transparent hover:bg-ink/[0.03]'} transition-colors`} data-watch-name={n.symbol} data-on={on || undefined}>
      <div className="flex items-center gap-1 pr-1.5">
        <button
          type="button"
          onClick={() => onPick(n.symbol)}
          className="hit min-w-0 flex-1 flex items-center gap-2 pl-2 py-1.5 text-left rounded-md outline-none focus-visible:ring-2 focus-visible:ring-silver/60"
          aria-label={`${n.symbol}${spot != null ? ` at ${usd(spot)}` : ''}${change != null ? `, ${pctSigned(change)} today` : ''}${near ? `, the ${near.word} ${fmtLevel(near.at)} ${pctSigned(near.pct)} away` : ''} — set it as the name`}
          data-watch-pick={n.symbol}
        >
          <CompanyLogo ticker={n.symbol} size={16} />
          <span className="min-w-0 flex flex-col leading-tight">
            <span className="flex items-center gap-1.5">
              <span className={`text-[13px] font-semibold ${on ? 'text-silver' : 'text-textPrimary'}`}>{n.symbol}</span>
              {n.flagged && <Flag className="w-3 h-3 text-silver" fill="currentColor" aria-label="flagged" />}
            </span>
            <span className="text-[11px] text-textMuted truncate" data-watch-near>
              {near ? (
                <>
                  {near.word} {fmtLevel(near.at)} <span className="tnum">· {pctSigned(near.pct)}</span>
                </>
              ) : (
                'no book on hand'
              )}
            </span>
          </span>
          <span className="ml-auto flex flex-col items-end leading-tight font-mono tnum">
            <span className="text-[12px] text-textPrimary">{spot != null ? usd(spot) : '—'}</span>
            {change != null && (
              <span className={`text-[11px] ${change >= 0 ? 'text-bull' : 'text-bear'}`} data-dir={dirOf(change)}>
                {pctSigned(change)}
              </span>
            )}
          </span>
        </button>
        <span className="flex items-center opacity-70 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          <IconButton onClick={() => setNameFlag(n.symbol, !n.flagged)} pressed={n.flagged} label={n.flagged ? `Take the flag off ${n.symbol}` : `Flag ${n.symbol}`} testId="flag">
            <Flag className="w-3 h-3" fill={n.flagged ? 'currentColor' : 'none'} />
          </IconButton>
          <IconButton onClick={() => setMore(v => !v)} pressed={more} label={`Move ${n.symbol} — its place and its section`} title="Move" testId="more">
            <MoreHorizontal className="w-3 h-3" />
          </IconButton>
          <IconButton onClick={take} label={`Take ${n.symbol} off the watchlist`} title="Take it off" testId="remove">
            <X className="w-3 h-3" />
          </IconButton>
        </span>
      </div>
      {/* where the name stands in the list — opened by the row's ⋯ */}
      {more && (
        <div className="flex items-center gap-1 pl-8 pr-1.5 pb-1.5 text-[11px] text-textMuted" data-watch-move={n.symbol}>
          <IconButton onClick={() => nudgeName(n.symbol, -1)} label={`Move ${n.symbol} up`} testId="up">
            <ArrowUp className={`w-3 h-3 ${index <= 0 ? 'opacity-30' : ''}`} />
          </IconButton>
          <IconButton onClick={() => nudgeName(n.symbol, 1)} label={`Move ${n.symbol} down`} testId="down">
            <ArrowDown className={`w-3 h-3 ${index >= section.names.length - 1 ? 'opacity-30' : ''}`} />
          </IconButton>
          {sections.length > 1 ? (
            <span className="ml-1">
              <DropdownSelect label="In" value={section.id} options={sectionOptions} onChange={id => moveName(n.symbol, id)} size="sm" title={`The section ${n.symbol} stands in`} />
            </span>
          ) : (
            <span className="ml-1">One section so far — a new one at the foot of the list takes names too</span>
          )}
        </div>
      )}
      {/* the contract lists that hold something on this name */}
      {links.length > 0 && (
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap pl-8 pr-1.5 pb-1.5 text-[11px]">
        {links.map(l => (
          <button
            key={l.to}
            type="button"
            onClick={() => {
              if (!on) onPick(n.symbol);
              navigate(l.to);
              closeWatchlist();
            }}
            className="hit text-textSecondary hover:text-textPrimary underline decoration-borderMuted underline-offset-2"
            data-watch-link={l.to}
          >
            {l.label}
          </button>
        ))}
      </div>
      )}
    </li>
  );
};

/** A section's head: its name (a press renames it), its count, and the way to take it off */
const SectionHead = ({ s, removable }: { s: WatchSection; removable: boolean }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(s.name);
  const take = () => {
    const back = removeSection(s.id);
    if (back) undoable({ label: `Took the section ${s.name} off${s.names.length ? `, ${s.names.length} name${s.names.length === 1 ? '' : 's'} with it` : ''}`, undo: () => restoreSection(back), key: `watch-section-${s.id}` });
  };
  return (
    <div className="flex items-center gap-2 px-2 pt-3 pb-1" data-watch-section={s.id}>
      {editing ? (
        <input
          autoFocus
          value={draft}
          maxLength={32}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => {
            renameSection(s.id, draft);
            setEditing(false);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              e.stopPropagation();
              setDraft(s.name);
              setEditing(false);
            }
          }}
          aria-label="The section's name"
          className="h-6 w-40 px-1.5 rounded border border-borderMuted bg-inputBg text-[12px] text-textPrimary outline-none focus:border-silver/60"
        />
      ) : (
        <button type="button" onClick={() => setEditing(true)} title="Rename the section" className="hit text-[12px] font-semibold text-textSecondary hover:text-textPrimary">
          {s.name}
        </button>
      )}
      <span className="font-mono text-[11px] tnum text-textMuted">{s.names.length}</span>
      {removable && (
        <span className="ml-auto">
          <IconButton onClick={take} label={`Take the section ${s.name} off`} title="Take the section off" testId="section-remove">
            <X className="w-3 h-3" />
          </IconButton>
        </span>
      )}
    </div>
  );
};

const WatchlistDrawer = () => {
  const open = useWatchlistOpen();
  const list = useNameWatch();
  const active = useActiveTicker();
  const groups = useLinkGroups();
  const [target, setTarget] = useState<Target>('name');
  const [only, setOnly] = useState<'all' | 'flagged'>('all');
  const [adding, setAdding] = useState(false);
  const [into, setInto] = useState<string>('');
  const [said, setSaid] = useState('');
  /* a word said about the last add is for that visit to the list */
  useEffect(() => {
    if (!open) setSaid('');
  }, [open]);
  /* the book's reads move with the room's ten-second scan */
  const now = useNow(10_000);
  const scanAt = open ? Math.floor(now / 10_000) : 0;

  /* the contract lists, by name — the row links to the ones that hold something */
  const weigher = useWatchlist();
  const { watched } = useWatch();
  const { trackedSetups } = useTracker();
  const linksFor = (symbol: string) => {
    const out: { label: string; to: string }[] = [];
    const w = weigher.filter(c => c.ticker === symbol).length;
    const b = watched.filter(x => x.ticker === symbol).length;
    const t = trackedSetups.filter(x => x.ticker === symbol).length;
    if (w) out.push({ label: `${w} in the Weigher`, to: '/weigher' });
    if (b) out.push({ label: `${b} bookmarked in Trace`, to: '/trace/tracker' });
    if (t) out.push({ label: `${t} on Compass's Tracker`, to: '/compass/tracker' });
    return out;
  };

  const box = useRef<HTMLElement | null>(null);
  useOverlay({ open, ref: box, onClose: closeWatchlist, initialFocus: 'container' });
  const reduce = useReducedMotion();
  const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];
  const glideIn = { x: 0, opacity: 1, transition: { duration: reduce ? 0 : 0.5, ease: EASE } };
  const glideOut = { x: 48, opacity: 0, transition: { duration: reduce ? 0 : 0.36, ease: EASE } };

  const total = list.sections.reduce((n, s) => n + s.names.length, 0);
  const flagged = list.sections.reduce((n, s) => n + s.names.filter(x => x.flagged).length, 0);
  const onName = target === 'name' ? active : (groups[target] ?? active);
  const pick = (symbol: string) => {
    if (target === 'name') changeTicker(symbol);
    else setLinkGroup(target, symbol);
  };
  const add = (symbol: string) => {
    const r = watchName(symbol, into || undefined);
    setSaid(r === 'added' ? `${symbol.toUpperCase()} is on the list` : r === 'already' ? `${symbol.toUpperCase()} is on the list already` : r === 'full' ? `The list holds ${MAX_NAMES} names` : 'That is not a name');
    if (r === 'added') setAdding(false);
  };

  const targetOptions: DropdownOption<Target>[] = [
    { value: 'name', label: "The terminal's name", hint: `Now ${active}` },
    ...LINK_GROUPS.map(g => ({ value: g as Target, label: `Link group ${g}`, hint: groups[g] ? `Now ${groups[g]}` : 'No panel has joined it yet' })),
  ];
  const sectionOptions: DropdownOption<string>[] = list.sections.map(s => ({ value: s.id, label: s.name }));

  return (
    <AnimatePresence>
      {open && <div key="scrim" className="fixed inset-0 z-[87]" onClick={closeWatchlist} aria-hidden data-watchlist-scrim />}
      {open && (
        <motion.aside
          key="drawer"
          ref={box}
          role="dialog"
          aria-modal="true"
          aria-labelledby="watchlist-title"
          tabIndex={-1}
          initial={{ x: 48, opacity: 0 }}
          animate={glideIn}
          exit={glideOut}
          className="fixed top-0 right-0 bottom-0 z-[88] w-[400px] max-w-[92vw] border-l border-borderMuted bg-panel/[0.92] backdrop-blur-lg backdrop-saturate-150 flex flex-col shadow-[-16px_0_48px_rgba(0,0,0,0.45)] outline-none"
          data-watchlist-drawer
        >
          <div className="h-12 shrink-0 flex items-center gap-2.5 px-3.5 border-b border-borderSubtle/70">
            <span className="w-6 h-6 rounded-md border border-borderSubtle bg-ink/[0.03] flex items-center justify-center shrink-0" aria-hidden>
              <Eye className="w-3.5 h-3.5 text-textSecondary" strokeWidth={1.75} />
            </span>
            <h2 id="watchlist-title" className="text-[14px] font-semibold text-textPrimary">
              Watchlist
            </h2>
            <span className="font-mono text-[11px] tnum text-textMuted" data-watchlist-facts>
              <span className="text-textSecondary">{total}</span> {total === 1 ? 'name' : 'names'} · <span className={flagged ? 'text-textSecondary' : ''}>{flagged}</span> flagged
            </span>
            <button type="button" onClick={closeWatchlist} aria-label="Close the watchlist" title="Close (Esc)" className="hit ml-auto shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* WHAT A PRESS SETS — the terminal's name, or a link group's — and what is shown */}
          <div className="shrink-0 flex items-center gap-2 flex-wrap px-3.5 py-2 border-b border-borderSubtle/60">
            <DropdownSelect<Target> label="Sets" value={target} options={targetOptions} onChange={setTarget} title="What a press on a name sets — the terminal's name, or a link group's" testId="watchlist-target" />
            <DropdownSelect<'all' | 'flagged'>
              label="Show"
              value={only}
              options={[
                { value: 'all', label: 'Every name' },
                { value: 'flagged', label: 'Flagged', hint: `${flagged} flagged` },
              ]}
              onChange={setOnly}
              testId="watchlist-show"
            />
            <button
              type="button"
              onClick={() => setAdding(v => !v)}
              aria-expanded={adding}
              className="hit ml-auto inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-borderSubtle text-[12px] text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors"
              data-watchlist-add
            >
              <Plus className="w-3.5 h-3.5" /> Add a name
            </button>
          </div>
          {adding && (
            <div className="shrink-0 px-3.5 py-2 border-b border-borderSubtle/60 flex flex-col gap-2" data-watchlist-adding>
              {list.sections.length > 1 && <DropdownSelect label="Into" value={into || list.sections[0].id} options={sectionOptions} onChange={setInto} size="sm" />}
              <div className="rounded-md border border-borderSubtle bg-panel">
                <TickerLookup onPick={add} limit={8} />
              </div>
            </div>
          )}
          {said && (
            <p className="shrink-0 px-3.5 py-1.5 text-[11px] text-textMuted border-b border-borderSubtle/60" role="status">
              {said}
            </p>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto px-1.5 pb-4" data-watchlist-body>
            {total === 0 ? (
              <p className="px-3 py-6 text-[12px] leading-relaxed text-textMuted">
                No names yet. Add one here, or on the command line — “watch NVDA”. A name's row carries its price, the day's change and the nearest wall or
                flip on its book; a press sets it as the terminal's name.
              </p>
            ) : (
              list.sections.map(s => {
                const shown = only === 'flagged' ? s.names.filter(n => n.flagged) : s.names;
                return (
                  <section key={s.id} aria-label={s.name}>
                    <SectionHead s={s} removable={list.sections.length > 1} />
                    {shown.length === 0 ? (
                      <p className="px-2 py-1.5 text-[11px] text-textMuted">{only === 'flagged' ? 'Nothing flagged here' : 'Nothing here yet'}</p>
                    ) : (
                      <ul className="flex flex-col gap-0.5">
                        {shown.map(n => (
                          <NameRow key={n.symbol} n={n} section={s} sections={list.sections} on={n.symbol === onName} onPick={pick} links={linksFor(n.symbol)} scanAt={scanAt} />
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })
            )}
            <button
              type="button"
              onClick={() => addSection('')}
              className="hit mt-3 mx-2 inline-flex items-center gap-1.5 text-[12px] text-textMuted hover:text-textPrimary"
              data-watchlist-new-section
            >
              <FolderPlus className="w-3.5 h-3.5" /> New section
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};

export default WatchlistDrawer;
