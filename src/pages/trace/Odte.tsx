/*
==================================================
  SLAYER TERMINAL - 0DTE (Trace)
  The same-day money (Noah, 2026-08-30 — expansion
  page 6, from the reference's four fixed charts;
  Noah: "much more modern charts... 4 way 3 way
  2 way or just 1 chart kind of like our terrain
  page"). So: a PANE DESK — one to four NetFlowPanes,
  each with its own lens, moneyness cut and
  fullscreen door. Layout + lenses persist.

  TWO CONTROLS PER PANE (Noah, 2026-09-03, on the
  old six-way dropdown: "i am struggling to figure
  out the idea behind them"): a CUT of the book —
  by family (everything, stocks only, index funds
  only) or by sector — and a NAME SEARCH that puts
  one ticker on the pane. A cut asks which part of
  the book; a name asks which name. They no longer
  share a list, and no cut is called "single names".

  ONE JOB PER PAGE (Noah, same day: "is me picking a
  single stock name on the 0DTE subpage the same as
  me choosing a stock on the net flow page?" — it
  was: same generator, Net Flow's 0DTE clock). So
  the desk's search offers only the SAME-DAY COMPLEX
  — SPY, QQQ, IWM, the names 0DTE is made of and
  Net Flow's board of stocks does not rank — and
  its last row is a DOOR: any other name goes to
  Net Flow with the 0DTE clock set, one place for a
  stock's same-day lean, the board behind it.
==================================================
*/

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarketData } from '../../context/MarketDataContext';
import { LiveHold, useHold } from '../../components/trace/LiveHold';
import Simulator from '../../core/simulator';
import { buildFlowBook, buildNetFlowView, isNetSegment, type MoneynessKey, type NetFlowSegment } from '../../data/flowBook';
import { fmtUsd } from '../../data/gex';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import RichRead from '../../components/ui/RichRead';
import NetFlowPane, { paneTimes } from '../../components/trace/NetFlowPane';
import TraceBox, { Fact } from '../../components/trace/TraceBox';
import { OdteGuide } from '../../components/trace/TraceGuide';

const PANE_OPTIONS: DropdownOption<1 | 2 | 3 | 4>[] = [
  { value: 1, label: 'One pane', hint: 'One chart the width of the desk' },
  { value: 2, label: 'Two panes', hint: 'Side by side' },
  { value: 3, label: 'Three panes', hint: 'Two above, one across the bottom' },
  { value: 4, label: 'Four panes', hint: 'Two by two' },
];

const STORE_KEY = 'slayer_odte_v1';

interface PaneCfg {
  seg: NetFlowSegment;
  mny: MoneynessKey;
  /** A picked name — ticker mode; null = the cut */
  ticker: string | null;
}

interface OdteStore {
  count: 1 | 2 | 3 | 4;
  panes: PaneCfg[];
}

/* The default desk keeps its old four faces: the whole book, SPY, QQQ, the
   stocks alone — SPY and QQQ now as picked NAMES, which is what they were. */
const DEFAULT_STORE: OdteStore = {
  count: 4,
  panes: [
    { seg: 'all', mny: 'all', ticker: null },
    { seg: 'all', mny: 'all', ticker: 'SPY' },
    { seg: 'all', mny: 'all', ticker: 'QQQ' },
    { seg: 'stocks', mny: 'all', ticker: null },
  ],
};

const MNYS: MoneynessKey[] = ['all', 'itm', 'otm', 'atm'];

/** The same-day complex — the names a desk pane may be put on. */
const SAME_DAY_COMPLEX = new Set(['SPY', 'QQQ', 'IWM']);
const onTheComplex = (t: string) => SAME_DAY_COMPLEX.has(t);

/* Stored lenses from the six-way days migrate: SPY/QQQ were names, Tech was
   the Technology sector. */
const LEGACY: Record<string, Partial<PaneCfg>> = {
  spy: { seg: 'all', ticker: 'SPY' },
  qqq: { seg: 'all', ticker: 'QQQ' },
  tech: { seg: 'sector:Technology' },
};

function loadStore(): OdteStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return DEFAULT_STORE;
    const p = JSON.parse(raw) as Partial<OdteStore>;
    const count = ([1, 2, 3, 4] as const).includes(p.count as 1) ? (p.count as OdteStore['count']) : 4;
    const panes = DEFAULT_STORE.panes.map((d, i) => {
      const cfg = Array.isArray(p.panes) ? (p.panes[i] as Partial<PaneCfg> & { seg?: string }) : undefined;
      if (!cfg) return d;
      const legacy = typeof cfg.seg === 'string' ? LEGACY[cfg.seg] : undefined;
      const seg: NetFlowSegment = legacy?.seg ?? (isNetSegment(cfg.seg) ? cfg.seg : d.seg);
      const ticker =
        legacy?.ticker ?? (typeof cfg.ticker === 'string' && /^[A-Z0-9.]{1,6}$/.test(cfg.ticker) ? cfg.ticker : null);
      return {
        seg,
        mny: MNYS.includes(cfg.mny as MoneynessKey) ? (cfg.mny as MoneynessKey) : d.mny,
        ticker,
      };
    });
    return { count, panes };
  } catch {
    return DEFAULT_STORE;
  }
}

const Odte = () => {
  const { marketData, activeTicker } = useMarketData();
  const navigate = useNavigate();
  const [store, setStore] = useState<OdteStore>(loadStore);
  const [fsIdx, setFsIdx] = useState<number | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch {
      /* private mode — layout just doesn't persist */
    }
  }, [store]);

  // Fullscreen: Esc exits, page scroll locks underneath.
  useEffect(() => {
    if (fsIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setFsIdx(null);
    };
    window.addEventListener('keydown', onKey, true);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = '';
    };
  }, [fsIdx]);

  const liveBook = useMemo(
    () => buildFlowBook(Simulator.universeQuotes(activeTicker)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTicker, marketData]
  );
  // The shared hold (see LiveHold): book and tick freeze together while
  // paused, so every pane stops on the same bar.
  const hold = useHold(useMemo(() => ({ book: liveBook, tick: marketData }), [liveBook, marketData]), activeTicker);
  const { book, tick } = hold.value;
  const [guideOpen, setGuideOpen] = useState(false);

  /* The whole same-day book, once, for the head's facts and the sentence */
  const view = useMemo(() => buildNetFlowView(book, 'all', 'all', paneTimes('SPY')), [book]);
  const awake = view.points.length > 0;
  const bullish = view.ncp - view.npp >= 0;
  // Signed on purpose — RichRead inks +$/-$ by direction (2026-08-30).
  const signed = (v: number) => `${v >= 0 ? '+' : ''}${fmtUsd(v)}`;
  const read = awake ? `The same-day money leans ${bullish ? 'bullish' : 'bearish'} — net calls ${signed(view.ncp)} against net puts ${signed(view.npp)} across ${view.count} contracts expiring today or tomorrow.` : 'The same-day book is still waking up.';

  const setPane = (i: number, patch: Partial<PaneCfg>) =>
    setStore(s => ({ ...s, panes: s.panes.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));

  /* THE DOOR (see the header): the typed name, if the book knows it, rides
     to Net Flow with the 0DTE clock; an unknown or empty query opens Net
     Flow on that clock with its leader up. */
  const known = useMemo(() => new Set(book.map(r => r.ticker)), [book]);
  const door = useMemo(
    () => ({
      label: (q: string) => (q && known.has(q) ? `${q} — on Net Flow's 0DTE clock` : "Any other name — on Net Flow's 0DTE clock"),
      onOpen: (q: string) =>
        navigate('/trace/net-flow', { state: { ticker: q && known.has(q) ? q : null, tenor: 'odte' } }),
    }),
    [known, navigate]
  );

  /* The desk fills the frame: the grid takes every pixel down to the viewport
     floor and splits it EQUALLY — 2×2 for four panes, halves for two, one tall
     pane alone (Noah, 2026-08-30: "touch the bottom and in a 4 way split
     equally"). min-h-0 on the cells or the charts refuse to shrink. */
  const gridClass =
    store.count === 1
      ? 'grid grid-cols-1 grid-rows-1'
      : store.count === 2
        ? 'grid grid-cols-1 lg:grid-cols-2 grid-rows-1'
        : 'grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-2';

  const pane = (i: number, expanded = false) => {
    const cfg = store.panes[i];
    return (
      <NetFlowPane
        book={book}
        seg={cfg.seg}
        mny={cfg.mny}
        // Picking a cut is a way back from a name too: the pane returns to the book.
        onSeg={seg => setPane(i, { seg, ticker: null })}
        onMny={mny => setPane(i, { mny })}
        ticker={cfg.ticker ?? undefined}
        onTicker={ticker => setPane(i, { ticker })}
        searchNames={onTheComplex}
        searchDoor={door}
        tick={tick}
        onExpand={() => setFsIdx(expanded ? null : i)}
        expanded={expanded}
      />
    );
  };

  // Keyed by count too: a layout switch REMOUNTS the pane so the chart
  // re-fits its new frame instead of hugging the old one's view.
  const renderPane = (i: number, extraClass = '') => (
    <div key={`${store.count}-${i}`} className={`min-h-0 ${extraClass}`}>
      {pane(i)}
    </div>
  );

  return (
    <>
      <TraceBox
        title="The same-day money"
        sub="Net call and put premium flowing through the session — one to four panes, each with its own cut, name, money and clock · double-click a pane to reset its view"
        testId="odte"
        className="flex-1 min-h-0"
        data={{ panes: store.count }}
        guide={{ title: 'How to read the desk', door: 'What the lines, the floor and the panes mean', body: <OdteGuide />, testId: 'odte-guide', open: guideOpen, onOpen: setGuideOpen }}
        facts={
          <>
            <Fact label="Leans" testId="lean">
              <span className={!awake ? 'text-textMuted' : bullish ? 'text-bull' : 'text-bear'}>{awake ? (bullish ? 'bullish' : 'bearish') : '—'}</span>
            </Fact>
            <Fact label="Net calls" testId="calls">
              <span className={view.ncp >= 0 ? 'text-bull' : 'text-bear'}>{awake ? signed(view.ncp) : '—'}</span>
            </Fact>
            <Fact label="Net puts" testId="puts">
              <span className={view.npp >= 0 ? 'text-bear' : 'text-bull'}>{awake ? signed(view.npp) : '—'}</span>
            </Fact>
            <Fact label="Contracts" testId="contracts">
              {awake ? view.count : '—'} <span className="text-textMuted">· expiring today or tomorrow</span>
            </Fact>
          </>
        }
        controls={
          <>
            <LiveHold paused={hold.paused} onToggle={hold.toggle} heldAt={hold.heldAt} />
            <DropdownSelect label="Panes" value={store.count} options={PANE_OPTIONS} onChange={n => setStore(s => ({ ...s, count: n }))} title="How many charts on the desk" testId="odte-panes" />
          </>
        }
        sentence={<RichRead text={read} />}
      >
        <div className={`${gridClass} gap-2 flex-1 min-h-0 border-t border-borderSubtle p-2`} data-odte-desk>
          {Array.from({ length: store.count }, (_, i) =>
            // Three panes: the last one stretches the full row.
            renderPane(i, store.count === 3 && i === 2 ? 'lg:col-span-2' : '')
          )}
        </div>
      </TraceBox>

      {fsIdx !== null && <div className="fixed inset-0 z-[80] bg-canvas p-3">{pane(fsIdx, true)}</div>}
    </>
  );
};

export default Odte;
