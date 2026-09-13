/*
==================================================
  SLAYER TERMINAL - ALL NEWS
  (components/record/NewsFeedTabs.tsx)

  Every headline on the wire, as a feed with tabs
  (Noah, 2026-09-13: "there's no section for all
  news, I don't see any headlines whatsoever … you
  should be able to choose which tickers' news to
  follow, have alerts on for specific tickers …
  each thing should have a tab like earnings news,
  data news, all finance news"):

    ALL FINANCE   every story, newest first
    FOLLOWING     the names you follow — pick them
                  here, ring the bell on any of them
    EARNINGS      prints and guidance
    DATA          the macro stories, and today's
                  prints as they land
    ANALYST       upgrades, downgrades, targets
    DEALS         M&A, product, regulatory

  A row is the wire's row; a click opens the story
  beside the map above.
==================================================
*/

import { useMemo, useRef, useState } from 'react';
import { Bell, BellOff, Plus, X } from 'lucide-react';
import type { EconEvent, GeoNewsEvent, NewsGrade } from '../../data/newsroom';
import { followName, setFollowAlerts, unfollowName, useFollows } from '../../data/newsFollows';
import { NEWS_ROW_H } from '../../pages/record/recordSkeletons';
import CatTag from '../news/CatTag';
import CardTabs from '../ui/CardTabs';
import CompanyLogo from '../ui/CompanyLogo';
import TickerLookup from '../ui/TickerLookup';
import { ImpactLegend, ImpactMark, tierOf } from './impactMark';

type Tab = 'all' | 'following' | 'earnings' | 'data' | 'analyst' | 'deals';
const TABS = [
  { value: 'all', label: 'All finance news' },
  { value: 'following', label: 'Following' },
  { value: 'earnings', label: 'Earnings news' },
  { value: 'data', label: 'Data news' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'deals', label: 'Deals & product' },
] as const;
const GRADE_INK: Record<NewsGrade, string> = { THREAT: 'text-bear', ALLY: 'text-bull', WATCH: 'text-textSecondary' };
const GRADE_WORD: Record<NewsGrade, string> = { THREAT: 'negative', ALLY: 'positive', WATCH: 'neutral' };
const COLS = '72px 104px 96px 72px minmax(0, 1fr) 76px 72px';
const signed = (v: number, d = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`;
let tabMemory: Tab = 'all';

interface Props {
  events: GeoNewsEvent[];
  calendar: EconEvent[];
  selectedId: string | null;
  onPick: (id: string) => void;
}

const NewsFeedTabs = ({ events, calendar, selectedId, onPick }: Props) => {
  const [tab, setTabState] = useState<Tab>(tabMemory);
  const setTab = (t: Tab) => {
    tabMemory = t;
    setTabState(t);
  };
  const follows = useFollows();
  const followed = useMemo(() => new Set(follows.map(f => f.ticker)), [follows]);
  const [adding, setAdding] = useState(false);
  const addRef = useRef<HTMLDivElement | null>(null);

  const rows = useMemo(() => {
    const newest = [...events].sort((a, b) => a.item.minutesAgo - b.item.minutesAgo);
    switch (tab) {
      case 'following':
        return newest.filter(e => e.item.ticker && followed.has(e.item.ticker));
      case 'earnings':
        return newest.filter(e => e.item.category === 'Earnings' || e.item.category === 'Guidance');
      case 'data':
        return newest.filter(e => e.item.category === 'Macro');
      case 'analyst':
        return newest.filter(e => e.item.category === 'Analyst');
      case 'deals':
        return newest.filter(e => e.item.category === 'M&A' || e.item.category === 'Product' || e.item.category === 'Regulatory');
      default:
        return newest;
    }
  }, [events, tab, followed]);
  /* the prints that already landed today, on the Data tab */
  const printed = useMemo(() => (tab === 'data' ? calendar.filter(c => c.inMinutes < 0).sort((a, b) => b.inMinutes - a.inMinutes) : []), [calendar, tab]);
  const counts = useMemo(() => {
    const c = { all: events.length, following: 0, earnings: 0, data: 0, analyst: 0, deals: 0 };
    for (const e of events) {
      if (e.item.ticker && followed.has(e.item.ticker)) c.following++;
      const k = e.item.category;
      if (k === 'Earnings' || k === 'Guidance') c.earnings++;
      else if (k === 'Macro') c.data++;
      else if (k === 'Analyst') c.analyst++;
      else c.deals++;
    }
    return c;
  }, [events, followed]);
  const tabOptions = useMemo(() => TABS.map(t => ({ value: t.value, label: `${t.label} · ${counts[t.value]}` })), [counts]);

  return (
    <div data-news-feed data-tab={tab}>
      {/* THE TABS */}
      <div className="px-5 py-2 border-b border-borderSubtle flex items-center gap-4 flex-wrap">
        <CardTabs options={tabOptions} value={tab} onChange={setTab} ariaLabel="Which news" />
      </div>

      {/* THE NAMES YOU FOLLOW — on the Following tab: the chips, the bell, the door to add one */}
      {tab === 'following' && (
        <div className="px-5 py-2 border-b border-borderSubtle/60 flex items-center gap-2 flex-wrap" data-news-follows>
          <span className="font-mono text-[9px] uppercase tracking-widest text-textSecondary mr-1">Following</span>
          {follows.length === 0 && <span className="text-[11px] text-textSecondary">no names yet — add one and its stories gather here</span>}
          {follows.map(f => (
            <span key={f.ticker} className="inline-flex items-center gap-1 h-7 pl-2 pr-1 rounded-md border border-borderSubtle bg-chip font-mono text-[11px] font-semibold text-textPrimary" data-follow={f.ticker} data-alerts={f.alerts || undefined}>
              <CompanyLogo ticker={f.ticker} size={12} />
              {f.ticker}
              <button
                type="button"
                onClick={() => setFollowAlerts(f.ticker, !f.alerts)}
                title={f.alerts ? `The bell rings on ${f.ticker} news — click to silence it` : `Ring the bell on ${f.ticker} news`}
                aria-pressed={f.alerts}
                className={`ml-1 inline-flex items-center justify-center w-5 h-5 rounded transition-colors ${f.alerts ? 'text-warn bg-warn/10' : 'text-textMuted hover:text-textPrimary hover:bg-ink/[0.06]'}`}
                data-follow-bell
              >
                {f.alerts ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
              </button>
              <button type="button" onClick={() => unfollowName(f.ticker)} title={`Stop following ${f.ticker}`} aria-label={`Stop following ${f.ticker}`} className="inline-flex items-center justify-center w-5 h-5 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] transition-colors" data-follow-remove>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <div ref={addRef} className="relative">
            <button
              type="button"
              onClick={() => setAdding(v => !v)}
              aria-expanded={adding}
              className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border bg-chip transition-colors font-mono select-none ${adding ? 'border-silver/50' : 'border-borderSubtle hover:border-borderMuted'}`}
              data-follow-add
            >
              <Plus className="w-3 h-3 text-textMuted" />
              <span className="text-[11px] font-semibold text-textPrimary">Follow a name</span>
            </button>
            {adding && (
              <div role="dialog" aria-label="Follow a name" className="absolute left-0 top-full mt-1 z-[60] w-72 max-h-[320px] border border-borderMuted bg-panel/95 backdrop-blur-xl rounded-md shadow-2xl shadow-black/60 overflow-y-auto overscroll-contain animate-slide-in" data-follow-menu>
                <div className="px-2.5 py-1.5 border-b border-borderSubtle text-[10px] text-textSecondary">Its stories gather on this tab — ring the bell to be told of each one</div>
                <TickerLookup
                  onPick={sym => {
                    followName(sym);
                    setAdding(false);
                  }}
                />
              </div>
            )}
          </div>
          <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-textSecondary">the bell rings in the alerts drawer on a new headline</span>
        </div>
      )}

      {/* THE ROWS */}
      <div className="px-5 h-[22px] grid items-center gap-x-3 text-[9px] uppercase tracking-widest text-textSecondary" style={{ gridTemplateColumns: COLS }}>
        <span>Time</span>
        <span>Name</span>
        <span>Kind</span>
        <span>Reads</span>
        <span className="flex items-center gap-4">
          <span>Headline</span>
          <ImpactLegend />
        </span>
        <span className="text-right">1-day</span>
        <span className="text-right">Sure</span>
      </div>
      {printed.map(p => (
        <div key={p.id} className="px-5 grid items-center gap-x-3 border-t border-borderSubtle/40" style={{ height: NEWS_ROW_H, gridTemplateColumns: COLS }} data-news-print-row={p.id}>
          <span className="font-mono text-[10px] tnum text-textSecondary">{p.timeLabel}</span>
          <span className="font-mono text-[11px] font-bold text-textSecondary">{p.region}</span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-textSecondary">print</span>
          <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-textSecondary">landed</span>
          <span className="min-w-0 flex items-center gap-2">
            <ImpactMark tier={p.impact} />
            <span className="min-w-0 truncate text-[12px] text-textPrimary">{p.title}</span>
            {p.forecast && (
              <span className="font-mono text-[10px] tnum text-textSecondary whitespace-nowrap">
                fcst <span className="text-textPrimary">{p.forecast}</span>
                {p.previous ? (
                  <>
                    {' '}
                    · prev <span className="text-textPrimary">{p.previous}</span>
                  </>
                ) : null}
              </span>
            )}
          </span>
          <span />
          <span />
        </div>
      ))}
      {rows.length === 0 && printed.length === 0 && (
        <div className="px-5 py-6 text-center font-mono text-[10px] uppercase tracking-widest text-textSecondary">{tab === 'following' ? 'Nothing yet on the names you follow' : 'Nothing on the wire here today'}</div>
      )}
      {rows.map(e => {
        const open = e.id === selectedId;
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => onPick(e.id)}
            className={`group w-full text-left px-5 grid items-center gap-x-3 border-t border-borderSubtle/40 transition-colors ${open ? 'bg-silver/[0.06] shadow-[inset_2px_0_0_0_rgba(199,211,232,0.7)]' : 'hover:bg-silver/[0.05]'}`}
            style={{ height: NEWS_ROW_H, gridTemplateColumns: COLS }}
            data-news-feed-row={e.id}
            data-open={open || undefined}
          >
            <span className="font-mono text-[10px] tnum text-textSecondary">{e.item.time}</span>
            <span className="min-w-0 inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-textPrimary">
              {e.item.ticker ? (
                <>
                  <CompanyLogo ticker={e.item.ticker} size={14} />
                  {e.item.ticker}
                  {followed.has(e.item.ticker) && <Bell className="w-2.5 h-2.5 text-warn" aria-label="a name you follow" />}
                </>
              ) : (
                <span className="text-textSecondary">MACRO</span>
              )}
            </span>
            <span className="min-w-0">
              <CatTag category={e.item.category} size={9} />
            </span>
            <span className={`font-mono text-[9px] font-semibold uppercase tracking-widest ${GRADE_INK[e.grade]}`}>{GRADE_WORD[e.grade]}</span>
            <span className="min-w-0 flex items-center gap-2">
              <ImpactMark tier={tierOf(e.severity)} />
              <span className={`min-w-0 truncate text-[12px] ${open ? 'text-textPrimary' : 'text-textPrimary/85 group-hover:text-textPrimary'} transition-colors`}>{e.item.headline}</span>
              <span className="font-mono text-[9px] text-textSecondary whitespace-nowrap">{e.item.source}</span>
            </span>
            <span className={`text-right font-mono text-[11px] font-semibold tnum ${e.item.prediction.expMove1dPct >= 0 ? 'text-bull' : 'text-bear'}`}>{signed(e.item.prediction.expMove1dPct)}</span>
            <span className="text-right font-mono text-[10px] tnum text-textSecondary">{Math.round(e.item.prediction.confidencePct)}%</span>
          </button>
        );
      })}
    </div>
  );
};

export default NewsFeedTabs;
