/*
==================================================
  SLAYER TERMINAL - THE SIDEBAR (components/layout/SideNav.tsx)

  The frame, direction B (Noah, 2026-09-05): the
  terminal's ONE SUBJECT sits first, before
  navigation; under it the groups and their pages,
  with the current product's pages nested; at the
  bottom the one honest line about the data and
  the clock.

  THE LOOK (Noah, 2026-09-06, the second reference —
  Tomasz Trefler's "Left Side Menu"): the sidebar
  HUGS THE SIDE — no inset, no floating card, a
  full-height panel with one hairline on its right.
  The mark and the wordmark on top, the subject
  dressed as the search field, one utility row
  (Alerts, with its count), then small uppercase
  section labels, tight icon + label rows, and the
  current product's pages on a TREE RAIL — a
  vertical line whose bright part fills down to the
  page you are on, "the completion bar feel". The
  current product is a soft pill with a silver bar
  on the panel's edge; a round notch on that edge
  collapses it to a 52px icon rail that keeps our
  ">_" mark (Noah: "i do love this logo though for
  the collapsed look").

  Why the edge bar is ONE element on the panel and
  not a pseudo-element on each row: the rows live
  inside a scroller that clips sideways, and a bar
  hung off a row would be cut at the padding. One
  bar, measured against the current row, glides
  between pages instead of blinking.
==================================================
*/

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import JingleBell from '../ui/JingleBell';
import { useMarketData } from '../../context/MarketDataContext';
import { useLaunch } from './LaunchTransition';
import CompanyLogo from '../ui/CompanyLogo';
import { NAV_GROUPS, NAV_GROUP_META, NAV_INK, itemsByGroup } from './nav';
import { GEX_SUBPAGES } from '../../pages/pinpoint/subnav';
import { RECORD_SUBPAGES } from '../../pages/record/subnav';
import { TRACE_SUBPAGES } from '../../pages/trace/subnav';
import { lookup } from '../../data/universe';
import { readSessionClock } from '../../data/moc';
import { useAllAlerts, useUnseenAll } from '../gex/alertStore';
import { toggleAlertsDrawer, useAlertsDrawer } from '../../data/alertsDrawer';
import { beginGlide, endGlide } from '../../core/glide';
import { alpha } from '../gex/paletteInk';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const COLLAPSED_KEY = 'slayer_sidenav_collapsed';
/** The panel's widths — open, and the icon rail */
export const SIDENAV_W = 236;
export const SIDENAV_RAIL_W = 52;
/** The edge bar's height */
const BAR_H = 18;
/** A nested page row's pitch — the tree fill is computed from it, not measured */
const SUB_H = 26;

/** The pages nested under a product while you are inside it */
const SUBPAGES: Record<string, { path: string; label: string }[]> = {
  '/pinpoint': GEX_SUBPAGES.map(p => ({ path: p.path, label: p.label })),
  '/record': RECORD_SUBPAGES.map(p => ({ path: p.path, label: p.label })),
  /* Trace's nine moved here from its fused strip (Noah, 2026-09-09: "should we
     have the different subtabs on the sub-bar or stay on the top section") */
  '/trace': TRACE_SUBPAGES.map(p => ({ path: p.path, label: p.label })),
};

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
};

interface SideNavProps {
  onOpenPalette: () => void;
}

interface Tip {
  label: string;
  x: number;
  y: number;
}

const SideNav = ({ onOpenPalette }: SideNavProps) => {
  const { activeTicker, marketData } = useMarketData();
  const { launch } = useLaunch();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [clock, setClock] = useState(() => readSessionClock());
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('en-US', { hour12: false }));
  const asideRef = useRef<HTMLElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const [bar, setBar] = useState<{ top: number } | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  /* EVERY name's alerts (the rule, 2026-09-10: the bell counts across all
     names, not the subject's alone) — how many are set, how many fired
     unseen, and whether the drawer is open */
  const allAlerts = useAllAlerts();
  const setTotal = allAlerts.reduce((n, a) => n + a.alerts.filter(x => !x.firedAt).length, 0);
  const unseen = useUnseenAll();
  const drawerOpen = useAlertsDrawer();

  useEffect(() => {
    const id = window.setInterval(() => {
      setClock(readSessionClock());
      setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const toggleCollapsed = () => {
    /* The main column is told where it is going (core/glide.ts): its width
       once this panel has folded or opened — the desk lays its tiles out for
       that at once and rides the glide there; the charts that cannot afford a
       resize per frame size for it at the start. Measured off <main>, not the
       viewport, so a scrollbar or a drawer changes nothing. */
    const main = document.querySelector('main');
    const next = collapsed ? SIDENAV_W : SIDENAV_RAIL_W;
    const to = main ? { mainWidth: main.getBoundingClientRect().width + (width - next) } : null;
    beginGlide(700, 'frame', to);
    setCollapsed(c => {
      try {
        localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1');
      } catch {
        /* private mode — the choice lives for the session */
      }
      return !c;
    });
    setTip(null);
  };

  /* THE EDGE BAR follows the current product row: measured against the
     panel, so it rides the edge whatever the scroller is doing; hidden while
     the row is scrolled out of the nav's window. */
  const measure = useCallback(() => {
    const aside = asideRef.current;
    const nav = navRef.current;
    const row = aside?.querySelector<HTMLElement>('[data-nav-current]');
    if (!aside || !nav || !row) {
      setBar(null);
      return;
    }
    const a = aside.getBoundingClientRect();
    const n = nav.getBoundingClientRect();
    const r = row.getBoundingClientRect();
    const mid = r.top + r.height / 2;
    if (mid < n.top || mid > n.bottom) {
      setBar(null);
      return;
    }
    setBar({ top: Math.round(mid - a.top - BAR_H / 2) });
  }, []);
  /* A frame after the commit, never inside it (2026-09-06, the perf sweep):
     measured in a layout effect on every route change, the three rects
     forced the NEW page's whole layout early — 24ms of every page's open
     on the profiler, charged to the sidebar. The bar glides on a 300ms
     transition anyway; one frame is nothing to it. */
  useEffect(() => {
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, [measure, pathname, collapsed]);
  useEffect(() => {
    const nav = navRef.current;
    nav?.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      nav?.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  /* A hover tip for the rail — one fixed label beside the row, never clipped */
  const showTip = (e: MouseEvent<HTMLElement>, label: string) => {
    if (!collapsed) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ label, x: r.right + 10, y: r.top + r.height / 2 });
  };
  const hideTip = () => setTip(null);

  const name = lookup(activeTicker)?.name ?? null;
  const change = marketData?.changePercent ?? 0;
  const open = clock.phase === 'OPEN' || clock.phase === 'AUCTION';
  const priceText = marketData ? `$${marketData.spot.toFixed(2)}` : '—';
  const changeText = marketData ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : '';

  /* THE MARK AND THE WORDMARK — the door home */
  const brand = (
    <a
      href="/"
      onClick={e => {
        e.preventDefault();
        launch('/');
      }}
      onMouseEnter={e => showTip(e, 'Home')}
      onMouseLeave={hideTip}
      className={`shrink-0 flex items-center gap-2.5 h-[52px] select-none ${collapsed ? 'justify-center px-0' : 'px-3.5'}`}
      data-brand
    >
      <span className="holo-bg w-7 h-7 rounded-[8px] shrink-0 flex items-center justify-center font-mono text-[11px] font-bold text-[#0a0a0a]" aria-hidden>
        &gt;_
      </span>
      {!collapsed && <span className="font-mono text-[13px] font-bold tracking-tight holo-text whitespace-nowrap">slayer_terminal</span>}
    </a>
  );

  /* THE SUBJECT, dressed as the search field under the mark: the name you
     are on, its price and change, and the key that changes it. */
  const subject = collapsed ? (
    <button
      type="button"
      onClick={onOpenPalette}
      data-subject
      aria-label={`Watching ${activeTicker} ${priceText} — switch`}
      onMouseEnter={e => showTip(e, `${activeTicker} ${priceText} ${changeText} · ⌘K to switch`)}
      onMouseLeave={hideTip}
      className="mx-auto w-8 h-8 rounded-lg border border-ink/[0.08] bg-ink/[0.03] hover:border-silver/50 transition-colors flex items-center justify-center"
    >
      <CompanyLogo ticker={activeTicker} size={16} />
    </button>
  ) : (
    <button
      type="button"
      onClick={onOpenPalette}
      data-subject
      aria-label={`Watching ${activeTicker} — switch`}
      title={name ? `${name} · ⌘K to switch` : '⌘K to switch'}
      className="group w-full h-[34px] rounded-lg border border-ink/[0.08] bg-ink/[0.03] hover:border-silver/50 hover:bg-ink/[0.05] transition-colors flex items-center gap-2 pl-2 pr-2 text-left"
    >
      <CompanyLogo ticker={activeTicker} size={16} />
      <span className="text-[12px] font-semibold text-textPrimary" data-subject-ticker>
        {activeTicker}
      </span>
      <span className="font-mono text-[11px] tnum text-textPrimary" data-subject-price>
        {priceText}
      </span>
      {marketData && <span className={`font-mono text-[10px] tnum ${change >= 0 ? 'text-bull' : 'text-bear'}`}>{changeText}</span>}
      <span className="ml-auto inline-flex items-center gap-1 text-textMuted group-hover:text-textSecondary transition-colors">
        <Search className="w-3 h-3" />
        <kbd className="font-mono text-[9px] tracking-wide">⌘K</kbd>
      </span>
    </button>
  );

  /* THE UTILITY ROW — every alert, with the count: fired-and-unseen in lime
     (live), else how many are set. It used to be a link to the Targets page
     ("where the bell lives"); now it opens THE DRAWER at the right, over
     whatever page the reader is on (Noah, 2026-09-10: "why is the alerts
     page just the targets page?"). Silver while the drawer is open. */
  const alertsRow = (
    <button
      type="button"
      onClick={toggleAlertsDrawer}
      data-nav-alerts
      aria-expanded={drawerOpen}
      onMouseEnter={e => showTip(e, unseen > 0 ? `${unseen} alerted` : setTotal > 0 ? `${setTotal} alert${setTotal === 1 ? '' : 's'} set` : 'Alerts')}
      onMouseLeave={hideTip}
      /* A BUTTON, so it must be told to fill its row (an anchor with
         `flex` stretches on its own; a button hugs its content — Noah,
         2026-09-10: "the alerts button doesnt look like the rest"). Open
         wears the nav rows' own current-desk look: the pill, primary
         medium text, the bell in its ink. */
      className={`group relative flex items-center gap-2.5 h-[30px] rounded-lg text-[13px] text-left transition-colors ${
        collapsed ? 'w-8 mx-auto justify-center' : 'w-full px-2.5'
      } ${drawerOpen ? 'bg-ink/[0.06] text-textPrimary font-medium' : 'text-textSecondary hover:text-textPrimary hover:bg-ink/[0.04]'}`}
      aria-label="Alerts"
    >
      {/* jingles when an alert is set on any name and wears its ink while any is set (Noah, 2026-09-10) */}
      <JingleBell
        count={setTotal}
        ink={NAV_INK.alerts}
        lit={drawerOpen || unseen > 0}
        className={`w-4 h-4 shrink-0 ${drawerOpen ? 'text-[color:var(--ink)]' : 'text-textMuted group-hover:text-[color:var(--ink)]'}`}
        strokeWidth={drawerOpen ? 2 : 1.75}
        style={{ '--ink': NAV_INK.alerts } as CSSProperties}
      />
      {!collapsed && <span>Alerts</span>}
      {/* WHAT ALERTED AND WAS NOT LOOKED AT: the number in a small RED curved
          square (Noah, 2026-09-10: "i dont like the alert color lime … a
          little red [badge] with a number in it" → "add the curved square
          instead") — on the icon's corner when the rail is collapsed, at the
          row's end when open. */}
      {collapsed
        ? unseen > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-[3px] rounded-[4px] bg-[#FF3B30] text-white font-mono text-[8px] font-bold leading-[14px] text-center tnum" data-alerts-count>
              {unseen > 9 ? '9+' : unseen}
            </span>
          )
        : unseen > 0 ? (
            <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-md bg-[#FF3B30] text-white font-mono text-[10px] font-bold leading-[18px] text-center tnum" data-alerts-count>
              {unseen > 99 ? '99+' : unseen}
            </span>
          ) : setTotal > 0 ? (
            <span className="ml-auto font-mono text-[10px] tnum text-textMuted" data-alerts-count>
              {setTotal} set
            </span>
          ) : null}
    </button>
  );

  const groups = NAV_GROUPS.map((group, gi) => {
    const meta = NAV_GROUP_META[group];
    return (
      <div key={group} className={`flex flex-col gap-[2px] ${gi > 0 ? 'mt-5' : 'mt-1'}`} data-nav-group={group}>
        {!collapsed ? (
          <span className="px-2.5 pb-1 text-[10px] uppercase tracking-[0.1em] text-textMuted" title={meta.hint}>
            {group}
          </span>
        ) : (
          gi > 0 && <span className="mx-3 mb-2 border-t border-ink/[0.08]" aria-hidden />
        )}
        {itemsByGroup(group).map(item => {
          const inside = pathname.startsWith(item.path);
          const subs = !collapsed && inside ? SUBPAGES[item.path] : undefined;
          const activeIdx = subs ? subs.findIndex(s => pathname.startsWith(s.path)) : -1;
          const link = (
            <NavLink
              key={item.path}
              to={item.path}
              data-nav-item={item.path}
              data-nav-current={inside || undefined}
              onMouseEnter={e => showTip(e, item.label)}
              onMouseLeave={hideTip}
              className={`group relative flex items-center gap-2.5 h-[30px] rounded-lg text-[13px] transition-colors ${
                collapsed ? 'w-8 mx-auto justify-center' : 'px-2.5'
              } ${inside ? 'bg-ink/[0.06] text-textPrimary font-medium' : 'text-textSecondary hover:text-textPrimary hover:bg-ink/[0.04]'}`}
              title={collapsed ? undefined : item.description}
              aria-label={item.label}
            >
              {/* Each desk's icon takes its own ink (nav.ts NAV_INK) on hover and on the desk you are on;
                  at rest it is the muted grey (Noah, 2026-09-09: thirteen inks at once was "too much color") */}
              <item.icon
                className={`w-4 h-4 shrink-0 transition-colors duration-200 ${inside ? 'text-[color:var(--ink)]' : 'text-textMuted group-hover:text-[color:var(--ink)]'}`}
                strokeWidth={inside ? 2 : 1.75}
                style={{ '--ink': item.ink } as CSSProperties}
                data-nav-icon
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
          if (!subs) return link;
          /* THE TREE RAIL: a dim track down the nested pages, and a bright
             fill from its top to the page you are on — the completion bar. */
          const fillTo = activeIdx >= 0 ? activeIdx * SUB_H + SUB_H / 2 : 0;
          return (
            <div key={item.path} className="flex flex-col" data-nav-open={item.path}>
              {link}
              <div className="relative ml-[23px] mt-1 mb-1" data-nav-tree>
                <span className="absolute left-0 top-0 bottom-0 w-px bg-ink/[0.12]" aria-hidden />
                {activeIdx >= 0 && (
                  <>
                    <span
                      data-nav-fill
                      aria-hidden
                      className="absolute -left-px top-0 w-[2px] rounded-full transition-[height] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                      style={{ height: fillTo, background: SILVER, boxShadow: `0 0 6px ${alpha(SILVER, 0.6)}` }}
                    />
                    <span
                      data-nav-fill-dot
                      aria-hidden
                      className="absolute w-[7px] h-[7px] rounded-full transition-[top] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                      style={{ left: -3.5, top: fillTo - 3.5, background: SILVER, boxShadow: `0 0 8px ${SILVER}` }}
                    />
                  </>
                )}
                <div className="flex flex-col pl-3">
                  {subs.map((s, i) => {
                    const active = i === activeIdx;
                    return (
                      <NavLink
                        key={s.path}
                        to={s.path}
                        data-nav-sub={s.path}
                        style={{ height: SUB_H }}
                        className={`flex items-center px-2 rounded-md text-[12px] transition-colors ${
                          active ? 'text-textPrimary font-medium' : 'text-textSecondary hover:text-textPrimary hover:bg-ink/[0.04]'
                        }`}
                      >
                        {s.label}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  });

  const width = collapsed ? SIDENAV_RAIL_W : SIDENAV_W;

  return (
    <>
      {/* THE PANEL, hugging the left edge from tablet width up */}
      <aside
        ref={asideRef}
        onMouseLeave={hideTip}
        onTransitionEnd={e => {
          measure();
          /* Two frames on: the desk's grid measures its new width on the
             frame after the aside settles and lays its items out on the next */
          if (e.target === asideRef.current && e.propertyName === 'width') requestAnimationFrame(() => requestAnimationFrame(endGlide));
        }}
        className="relative hidden md:flex shrink-0 h-full flex-col bg-panel border-r border-ink/[0.07] transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ width }}
        data-sidenav
        data-collapsed={collapsed || undefined}
      >
        {/* The collapse notch, on the edge */}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Open the sidebar' : 'Collapse the sidebar to icons'}
          title={collapsed ? 'Open the sidebar' : 'Collapse to icons'}
          data-sidenav-toggle
          className="absolute -right-[11px] top-[15px] z-10 w-[22px] h-[22px] rounded-full border border-ink/[0.12] bg-card text-textMuted hover:text-textPrimary hover:border-silver/60 shadow-md shadow-black/50 flex items-center justify-center transition-colors"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>

        {/* The edge bar — one, on the edge, gliding to the current product */}
        {bar && (
          <span
            data-nav-accent
            aria-hidden
            className="absolute -right-px w-[3px] rounded-full transition-[top] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ top: bar.top, height: BAR_H, background: SILVER, boxShadow: `0 0 8px ${alpha(SILVER, 0.4)}` }}
          />
        )}

        {brand}
        <div className={`shrink-0 flex flex-col gap-1 pb-1 ${collapsed ? 'px-0' : 'px-3'}`}>
          {subject}
          <div className={collapsed ? '' : '-mx-1'}>{alertsRow}</div>
        </div>
        <nav ref={navRef} className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-1 flex flex-col ${collapsed ? 'px-0' : 'px-2'}`} aria-label="Terminal">
          {groups}
        </nav>
        <div
          className={`shrink-0 flex items-center gap-2 border-t border-ink/[0.07] bg-ink/[0.02] ${collapsed ? 'justify-center px-0 py-3' : 'px-3.5 py-3'}`}
          title={collapsed ? `${clock.label} · ${time}` : undefined}
          onMouseEnter={e => showTip(e, `Simulated data · ${clock.label} · ${time}`)}
          onMouseLeave={hideTip}
        >
          <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-warn border border-warn/60 rounded px-1.5 py-0.5">Sim</span>
          {!collapsed && (
            <>
              <span className="min-w-0 truncate font-mono text-[10px] tnum text-textSecondary" title={clock.label} data-session-line>
                {open ? clock.label : clock.label.toLowerCase()}
              </span>
              <span className="ml-auto font-mono text-[10px] tnum text-textMuted select-none">{time}</span>
            </>
          )}
        </div>
      </aside>

      {/* The rail's hover tip — portalled so no scroller clips it */}
      {tip &&
        collapsed &&
        createPortal(
          <div
            data-nav-tip
            role="tooltip"
            style={{ position: 'fixed', left: tip.x, top: tip.y }}
            className="z-[90] -translate-y-1/2 pointer-events-none whitespace-nowrap px-2 py-1 rounded-md border border-ink/[0.1] bg-card/95 backdrop-blur-md text-[11px] text-textPrimary shadow-lg shadow-black/50 animate-fade-in"
          >
            {tip.label}
          </div>,
          document.body
        )}

      {/* THE PHONE STRIP — the subject and the search, nothing else */}
      <div className="md:hidden fixed inset-x-0 top-0 z-40 h-12 flex items-center gap-3 px-3 bg-canvas/80 backdrop-blur-md border-b border-borderSubtle">
        <span className="holo-bg w-6 h-6 rounded-md flex items-center justify-center font-mono text-[10px] font-bold text-[#0a0a0a]">&gt;_</span>
        <button onClick={onOpenPalette} className="inline-flex items-center gap-2 rounded-md border border-borderMuted bg-chip px-2.5 py-1">
          <CompanyLogo ticker={activeTicker} size={16} />
          <span className="text-[12px] font-semibold text-textPrimary">{activeTicker}</span>
          {marketData && <span className="font-mono text-[11px] tnum text-textPrimary">${marketData.spot.toFixed(2)}</span>}
        </button>
        <button onClick={onOpenPalette} aria-label="Search or jump to…" className="ml-auto p-1.5 rounded-md border border-borderSubtle text-textMuted">
          <Search className="w-3.5 h-3.5" />
        </button>
      </div>
    </>
  );
};

export default SideNav;
