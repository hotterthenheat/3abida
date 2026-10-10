/*
==================================================
  SLAYER TERMINAL - THE SIDEBAR (components/layout/SideNav.tsx)

  The frame, direction B (Noah, 2026-09-05): the
  terminal's ONE SUBJECT sits first, before
  navigation; under it the groups and their pages,
  with the current product's pages nested; at the
  bottom the signature, where New York's day
  stands, and the clock.

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
  collapses it to a 52px icon rail that keeps the
  mark (Noah: "i do love this logo though for the
  collapsed look").

  THE BRAND (Slayer Logo System, 2026-09-30): the
  mark is the living >S| (brand/SlayerMark — it says
  what the terminal is doing: idle, loading, closed,
  an alert), the wordmark beside it is drawn, every
  product wears its glyph, and the foot is the
  signature, "slayer:~ $ ● live" (or "closed").

  SETTINGS STAYS IN REACH (the audit's SH-2): it
  was the last group in the scroller, at its foot,
  and fell out of sight on a short screen or under
  an open tree with no sign the list scrolled. It
  is pinned under the scroller now, and the
  scroller fades at an edge that has more behind it.

  Why the edge bar is ONE element on the panel and
  not a pseudo-element on each row: the rows live
  inside a scroller that clips sideways, and a bar
  hung off a row would be cut at the padding. One
  bar, measured against the current row, glides
  between pages instead of blinking.
==================================================
*/

import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, Menu, Search } from 'lucide-react';
import JingleBell from '../ui/JingleBell';
import { AlertBadge, useAlertCounts } from '../alerts/AlertCount';
import { PALETTE_KEY } from './keys';
import { TOGGLE_RAIL_EVENT } from './paletteDoor';
import SessionStrip, { railClock, readDay } from './SessionStrip';
import { useShellPrefs } from './shellPrefs';
import { useDeskPrefs } from '../../data/deskPrefs';
import { dirOf } from '../../theme/theme';
import Fold from '../ui/Fold';
import Avatar from '../ui/Avatar';
import { useProfile } from '../../data/profile';
import { useActiveTicker, useNow, useQuote, useSpot } from '../../context/MarketDataContext';
import { useLaunch } from './LaunchTransition';
import CompanyLogo from '../ui/CompanyLogo';
import { NAV_GROUPS, NAV_GROUP_META, NAV_INK, itemsByGroup } from './nav';
import { subpagesFor } from './navTree';
import MobileMenu from './MobileMenu';
import { useCompassView } from '../../data/compassView';
import { lookup } from '../../data/universe';
import { readSessionClock } from '../../data/sessionClock';
import { toggleAlertsDrawer, useAlertsDrawer } from '../../data/alertsDrawer';
import { beginGlide, endGlide } from '../../core/glide';
import { alpha } from '../gex/paletteInk';
import { EMBEDDED } from '../../embed';
import SlayerMark from '../../brand/SlayerMark';
import Wordmark from '../../brand/Wordmark';
import Signature, { SignatureDot } from '../../brand/Signature';
import { readMarketState } from '../../data/marketState';
import ProductGlyph from '../../brand/ProductGlyph';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const COLLAPSED_KEY = 'slayer_sidenav_collapsed';
/** The panel's widths — open, and the icon rail */
export const SIDENAV_W = 236;
export const SIDENAV_RAIL_W = 52;
/** The edge bar's height */
const BAR_H = 18;
/** A nested page row's pitch — the tree fill is computed from it, not measured */
const SUB_H = 26;

/* which pages sit under each product is navTree.ts — the phone's menu reads the same list */

const readCollapsed = () => {
  /* in the landing's window the rail opens folded, so the page has the width — and unwritten (embed.ts) */
  if (EMBEDDED) return true;
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

/* THE RAIL READS THE TICK IN ITS SMALL PARTS (2026-10-10, the speed store): the subject's price and the signature's
   clock render on their own beats — the whole rail, a hundred and more rows, rendered on every tick and every second. */

/** THE SUBJECT, dressed as the search field under the mark: the name you are on, its price and change, and the key
    that changes it */
const RailSubject = ({
  collapsed,
  onOpenPalette,
  tipProps,
}: {
  collapsed: boolean;
  onOpenPalette: () => void;
  tipProps: (label: string) => Record<string, unknown>;
}) => {
  const activeTicker = useActiveTicker();
  const quote = useQuote();
  const name = lookup(activeTicker)?.name ?? null;
  const change = quote?.changePct ?? 0;
  const priceText = quote ? `$${quote.spot.toFixed(2)}` : '—';
  const changeText = quote ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : '';
  /* THE SUBJECT, dressed as the search field under the mark: the name you
     are on, its price and change, and the key that changes it. */
  return collapsed ? (
    <button
      type="button"
      onClick={onOpenPalette}
      data-subject
      aria-label={`Watching ${activeTicker} ${priceText} — switch`}
      {...tipProps(`${activeTicker} ${priceText} ${changeText} · ${PALETTE_KEY} to switch`)}
      className="ml-[10px] w-8 h-8 rounded-lg border border-ink/[0.08] bg-ink/[0.03] hover:border-silver/50 transition-colors flex items-center justify-center"
    >
      <CompanyLogo ticker={activeTicker} size={16} />
    </button>
  ) : (
    <button
      type="button"
      onClick={onOpenPalette}
      data-subject
      aria-label={`Watching ${activeTicker} — switch`}
      title={name ? `${name} · ${PALETTE_KEY} to switch` : `${PALETTE_KEY} to switch`}
      className="group w-full h-[34px] rounded-lg border border-ink/[0.08] bg-ink/[0.03] hover:border-silver/50 hover:bg-ink/[0.05] transition-colors flex items-center gap-2 pl-2 pr-2 text-left"
    >
      <CompanyLogo ticker={activeTicker} size={16} />
      <span className="text-[12px] font-semibold text-textPrimary" data-subject-ticker>
        {activeTicker}
      </span>
      <span className="font-mono text-[11px] tnum text-textPrimary" data-subject-price>
        {priceText}
      </span>
      {quote && (
        <span className={`font-mono text-[10px] tnum ${change >= 0 ? 'text-bull' : 'text-bear'}`} data-dir={dirOf(change)}>
          {changeText}
        </span>
      )}
      <span className="ml-auto inline-flex items-center gap-1 text-textMuted group-hover:text-textSecondary transition-colors">
        <Search className="w-3 h-3" />
        <kbd className="font-mono text-[10px]">{PALETTE_KEY}</kbd>
      </span>
    </button>
  );
};

/** The phone strip's subject: the name and its price */
const PhoneSubject = ({ onOpenPalette }: { onOpenPalette: () => void }) => {
  const activeTicker = useActiveTicker();
  const spot = useSpot();
  const priceText = spot != null ? `$${spot.toFixed(2)}` : '—';
  return (
    <button type="button" onClick={onOpenPalette} aria-label={`Watching ${activeTicker} ${priceText} — switch`} className="inline-flex items-center gap-2 h-11 rounded-md border border-borderMuted bg-chip px-3" data-mobile-subject>
      <CompanyLogo ticker={activeTicker} size={16} />
      <span className="text-[12px] font-semibold text-textPrimary">{activeTicker}</span>
      {spot != null && <span className="font-mono text-[11px] tnum text-textPrimary">${spot.toFixed(2)}</span>}
    </button>
  );
};

/** THE SIGNATURE (Slayer Logo System): "slayer:~ $ ● live" — the market's own word, live while it is open and closed
    when it is shut — over the session's own line and the clock, on the terminal's one second (useNow) */
const RailSignature = ({
  collapsed,
  showTip,
  hideTip,
  sessionStrip,
  deskClock,
}: {
  collapsed: boolean;
  showTip: (e: MouseEvent<HTMLElement>, label: string) => void;
  hideTip: () => void;
  sessionStrip: boolean;
  deskClock: Parameters<typeof railClock>[0];
}) => {
  const now = useNow(1000);
  const clock = readSessionClock();
  const time = railClock(deskClock, now);
  const day = readDay(now);
  const open = clock.phase === 'OPEN' || clock.phase === 'AUCTION';
  /* the signature's word, read on the clock's own tick so the dot and the line never disagree */
  const marketWord = readMarketState().word;
  return (
    <div
      className={`shrink-0 border-t border-ink/[0.07] bg-ink/[0.02] ${collapsed ? 'pl-[22px] pr-0 py-3.5' : 'px-3.5 py-2.5'}`}
      title={collapsed ? `slayer:~ $ ${marketWord} · ${day.name} · ${time}` : undefined}
      onMouseEnter={e => showTip(e, `slayer:~ $ ${marketWord} · ${day.name}${day.next ? ` · ${day.next}` : ''} · ${time}`)}
      onMouseLeave={hideTip}
      data-sidenav-signature
    >
      {collapsed ? (
        <SignatureDot state={marketWord} className="w-2 h-2" label={`slayer:~ $ ${marketWord}`} />
      ) : (
        <>
          <Signature state={marketWord} rule={false} className="text-[10.5px]" />
          {/* WHERE THE DAY STANDS (SessionStrip.tsx; Settings › The desk turns it off) — else the session's own line */}
          {sessionStrip ? (
            <SessionStrip read={day} time={time} />
          ) : (
            <span className="mt-1.5 flex items-center gap-2 text-[10px] tnum">
              <span className="min-w-0 truncate text-textSecondary" title={clock.label} data-session-line>
                {open ? clock.label : clock.label.toLowerCase()}
              </span>
              <span className="ml-auto text-textMuted select-none">{time}</span>
            </span>
          )}
        </>
      )}
    </div>
  );
};

const SideNav = ({ onOpenPalette }: SideNavProps) => {
  /* the contract the reader is inside — Compass's tree keeps its row (see subpagesFor) */
  const { chosenId } = useCompassView();
  const profile = useProfile();
  const { launch } = useLaunch();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const desk = useDeskPrefs();
  const shell = useShellPrefs();
  const asideRef = useRef<HTMLElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const [bar, setBar] = useState<{ top: number } | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  /* EVERY name's alerts (the rule, 2026-09-10: the bell counts across all
     names, not the subject's alone) — how many are set, how many fired
     unseen, and whether the drawer is open */
  const counts = useAlertCounts();
  const { set: setTotal, unseen } = counts;
  const drawerOpen = useAlertsDrawer();

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
      if (!EMBEDDED) {
        try {
          localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1');
        } catch {
          /* private mode — the choice lives for the session */
        }
      }
      return !c;
    });
    setTip(null);
  };

  /* the command line's "Fold the rail" (paletteDoor.ts) */
  const toggleRef = useRef(toggleCollapsed);
  toggleRef.current = toggleCollapsed;
  useEffect(() => {
    const on = () => toggleRef.current();
    window.addEventListener(TOGGLE_RAIL_EVENT, on);
    return () => window.removeEventListener(TOGGLE_RAIL_EVENT, on);
  }, []);

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
  /* …and on focus too (the audit's X6.6): the keys get the tip the pointer gets */
  const tipProps = (label: string) => ({
    onMouseEnter: (e: MouseEvent<HTMLElement>) => showTip(e, label),
    onMouseLeave: hideTip,
    onFocus: (e: React.FocusEvent<HTMLElement>) => showTip(e as unknown as MouseEvent<HTMLElement>, label),
    onBlur: hideTip,
  });


  /* THE MARK AND THE WORDMARK — the door home. The mark brightens as the pointer nears it (the Logo System's own rule) */
  const brand = (
    <a
      href="/"
      onClick={e => {
        e.preventDefault();
        launch('/');
      }}
      {...tipProps('Home')}
      aria-label="Slayer Terminal — home"
      className={`shrink-0 flex items-center gap-2.5 h-[52px] select-none ${collapsed ? 'pl-3 pr-0' : 'px-3.5'}`}
      data-brand
    >
      <SlayerMark size={24} bare near label="" />
      {!collapsed && <Wordmark height={12} label="" className="translate-y-[1px]" />}
    </a>
  );

  /* THE SUBJECT, dressed as the search field under the mark (RailSubject below) */
  const subject = <RailSubject collapsed={collapsed} onOpenPalette={onOpenPalette} tipProps={tipProps} />;

  /* THE UTILITY ROW — every alert, with the count: fired-and-unseen in the red
     badge, else how many are set. It used to be a link to the Targets page
     ("where the bell lives"); now it opens THE DRAWER at the right, over
     whatever page the reader is on (Noah, 2026-09-10: "why is the alerts
     page just the targets page?"). Silver while the drawer is open. */
  const alertsRow = (
    <button
      type="button"
      onClick={toggleAlertsDrawer}
      data-nav-alerts
      aria-expanded={drawerOpen}
      aria-haspopup="dialog"
      {...tipProps(counts.label)}
      /* A BUTTON, so it must be told to fill its row (an anchor with
         `flex` stretches on its own; a button hugs its content — Noah,
         2026-09-10: "the alerts button doesnt look like the rest"). Open
         wears the nav rows' own current-desk look: the pill, primary
         medium text, the bell in its ink. */
      className={`group relative flex items-center gap-2.5 h-[30px] rounded-lg text-[13px] text-left transition-colors ${
        collapsed ? 'w-8 ml-[10px] justify-center' : 'w-full px-2.5'
      } ${drawerOpen ? 'bg-ink/[0.06] text-textPrimary font-medium' : 'text-textSecondary hover:text-textPrimary hover:bg-ink/[0.04]'}`}
      aria-label={counts.label}
    >
      {/* jingles when an alert is set on any name and wears its ink while any is set (Noah, 2026-09-10) */}
      <JingleBell count={setTotal} ink={NAV_INK.alerts} lit={drawerOpen || unseen > 0} glyph={17} />
      {!collapsed && <span>Alerts</span>}
      {/* WHAT ALERTED AND WAS NOT LOOKED AT: the number in a small RED curved
          square (Noah, 2026-09-10: "i dont like the alert color lime … a
          little red [badge] with a number in it" → "add the curved square
          instead") — on the icon's corner when the rail is collapsed, at the
          row's end when open. */}
      {collapsed
        ? unseen > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-[3px] rounded-[4px] bg-bear text-white font-mono text-[9px] font-bold leading-[14px] text-center tnum" data-alerts-count aria-hidden>
              {unseen > 9 ? '9+' : unseen}
            </span>
          )
        : <AlertBadge counts={counts} className="ml-auto" />}
    </button>
  );

  /* THE TREE FOLDS (Noah, 2026-09-28: "clicking it once gives a dropdown but when you click it again it should bring it
     back up"): a section's pages drop down when you enter it; a click on the section's row while you are inside folds
     them, another unfolds them — no navigation on those clicks. A section you leave forgets the fold, so coming back
     opens it again. */
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setFolded(f => {
      const next = Object.fromEntries(Object.entries(f).filter(([path]) => pathname.startsWith(path)));
      return Object.keys(next).length === Object.keys(f).length ? f : next;
    });
  }, [pathname]);

  /* THE RAIL'S ORDER (2026-09-28, nav.ts): Home (Pulse) stands ABOVE the Alerts row with no caption; the captioned
     groups scroll under; More (Settings) is pinned to the foot of the list with no caption */
  const groupBlocks = NAV_GROUPS.map((group, gi) => {
    const meta = NAV_GROUP_META[group];
    const first = gi === 1;
    const last = gi === NAV_GROUPS.length - 1;
    return (
      <div key={group} className={`flex flex-col gap-[2px] ${gi === 0 || last ? '' : first ? 'mt-1' : 'mt-5'}`} data-nav-group={group}>
        {!collapsed ? (
          meta.caption && (
            <span className="px-2.5 pb-1 text-[10px] uppercase tracking-[0.1em] text-textMuted" title={meta.hint}>
              {meta.caption}
            </span>
          )
        ) : (
          gi > 1 && !last && <span className="mx-3 mb-2 border-t border-ink/[0.08]" aria-hidden />
        )}
        {itemsByGroup(group).map(item => {
          const inside = pathname.startsWith(item.path);
          const tree = !collapsed && inside ? subpagesFor(item.path, pathname, chosenId) : undefined;
          const open = !!tree && !folded[item.path];
          const subs = tree;
          /* the page you are on is the LONGEST nested path the pathname starts with — The board (/compass) is a prefix of every
             Compass page, so the first match lit it on a contract's page and on the Tracker (Noah, 2026-09-13) */
          const activeIdx = subs ? subs.reduce((best, s, i) => (pathname.startsWith(s.path) && (best < 0 || s.path.length > subs[best].path.length) ? i : best), -1) : -1;
          const link = (
            <NavLink
              key={item.path}
              to={item.path}
              data-nav-item={item.path}
              data-nav-current={inside || undefined}
              /* ONE "YOU ARE HERE" (the audit's SH-14): a section's row is where you are in the terminal, its page's row is
                 the page — "true" here, "page" on the leaf under it */
              aria-current={inside ? (tree ? 'true' : 'page') : undefined}
              {...tipProps(item.label)}
              onClick={e => {
                /* inside a section with pages: the row folds and unfolds its tree instead of leaving the page */
                if (!tree) return;
                e.preventDefault();
                setFolded(f => ({ ...f, [item.path]: !f[item.path] }));
              }}
              aria-expanded={tree ? open : undefined}
              className={`group relative flex items-center gap-2.5 h-[30px] rounded-lg text-[13px] transition-colors ${
                collapsed ? 'w-8 ml-[10px] justify-center' : 'px-2.5'
              } ${inside ? 'bg-ink/[0.06] text-textPrimary font-medium' : 'text-textSecondary hover:text-textPrimary hover:bg-ink/[0.04]'}`}
              title={collapsed ? undefined : tree ? `${item.description} — click to ${open ? 'fold' : 'unfold'} its pages` : item.description}
              aria-label={item.label}
            >
              {/* EACH PRODUCT WEARS ITS GLYPH (Slayer Logo System, 2026-09-30): silver with ONE part in its desk's ink — the
                  brand's answer to "thirteen inks at once was too much color" (Noah, 2026-09-09), which was thirteen
                  whole icons in colour. Settings, a door and not a product, keeps its line icon: muted at rest, its ink on
                  hover and while you are in it. */}
              {item.glyph ? (
                <ProductGlyph name={item.glyph} size={17} bare className="shrink-0" />
              ) : (
                <item.icon
                  className={`w-4 h-4 shrink-0 transition-colors duration-200 ${inside ? 'text-[color:var(--ink)]' : 'text-textMuted group-hover:text-[color:var(--ink)]'}`}
                  strokeWidth={inside ? 2 : 1.75}
                  style={{ '--ink': item.ink } as CSSProperties}
                  data-nav-icon
                />
              )}
              {!collapsed && <span className="truncate">{item.label}</span>}
              {/* the fold's chevron — only on a section with pages, only while you are in it */}
              {tree && <ChevronDown className={`ml-auto w-3 h-3 shrink-0 text-textMuted transition-transform duration-200 ${open ? '' : '-rotate-90'}`} aria-hidden data-nav-fold={open ? 'open' : 'folded'} />}
            </NavLink>
          );
          if (!subs) return link;
          /* THE TREE RAIL: a dim track down the nested pages, and a bright
             fill from its top to the page you are on — the completion bar. */
          const fillTo = activeIdx >= 0 ? activeIdx * SUB_H + SUB_H / 2 : 0;
          return (
            <div key={item.path} className="flex flex-col" data-nav-open={item.path}>
              {link}
              {/* THE FOLD GLIDES (Noah, 2026-09-28: "dropdown and back up should also be smoother"): the house's Fold —
                  the rows' height and opacity over 220ms, nothing mounted or unmounted on a click */}
              <Fold axis="y" open={open} testId="data-nav-tree-fold">
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
                        end
                        aria-current={active ? 'page' : undefined}
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
              </Fold>
            </div>
          );
        })}
      </div>
    );
  });
  const home = groupBlocks[0];
  const groups = groupBlocks.slice(1, -1);
  const more = groupBlocks[groupBlocks.length - 1];

  /* THE SCROLLER'S EDGES: a fade where more of the list is behind the edge (the audit's SH-2) */
  const [edges, setEdges] = useState({ top: false, bottom: false });
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const read = () => {
      const top = nav.scrollTop > 2;
      const bottom = nav.scrollTop + nav.clientHeight < nav.scrollHeight - 2;
      setEdges(e => (e.top === top && e.bottom === bottom ? e : { top, bottom }));
    };
    read();
    nav.addEventListener('scroll', read, { passive: true });
    const ro = new ResizeObserver(read);
    ro.observe(nav);
    if (nav.firstElementChild) ro.observe(nav.firstElementChild);
    return () => {
      nav.removeEventListener('scroll', read);
      ro.disconnect();
    };
  }, [collapsed, pathname]);

  const width = collapsed ? SIDENAV_RAIL_W : SIDENAV_W;
  /* ANCHORED TO THE LEFT CORNER THROUGH THE GLIDE (Noah, 2026-09-14: the collapse "jitters
     super fast and leaves its corner really quickly before returning back to it"): the rail's
     rows used to CENTRE their icon (`mx-auto`, `justify-center`) — and the classes flip the
     moment the width starts its 300ms glide, so every icon leapt to the middle of a bar still
     236 wide and slid back as it narrowed. Each row now sets a fixed left inset that centres
     its box in the 52px rail — the mark at 12, a 32px box at 10, the 24px picture at 14 — and
     nothing depends on the width in flight. Opening was always fine: the open rows sit at the
     left by nature. */

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
          <div className={collapsed ? '' : '-mx-1'}>
            {home}
            {alertsRow}
          </div>
        </div>
        <div className="relative flex-1 min-h-0 flex flex-col">
          <nav ref={navRef} className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-1 ${collapsed ? 'px-0' : 'px-2'}`} aria-label="Terminal">
            <div className="flex flex-col">{groups}</div>
          </nav>
          {/* the fades say the list goes on past the edge — the panel's own ground, no colour */}
          <span className={`pointer-events-none absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-panel to-transparent transition-opacity duration-200 ${edges.top ? 'opacity-100' : 'opacity-0'}`} aria-hidden />
          <span className={`pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-panel to-transparent transition-opacity duration-200 ${edges.bottom ? 'opacity-100' : 'opacity-0'}`} aria-hidden data-nav-more-below={edges.bottom || undefined} />
        </div>
        {/* SETTINGS, PINNED (the audit's SH-2) — under the list, never scrolled away */}
        <nav className={`shrink-0 py-1.5 border-t border-ink/[0.07] ${collapsed ? 'px-0' : 'px-2'}`} aria-label="Settings" data-nav-pinned>
          {more}
        </nav>
        {/* WHO IS AT THE DESK (2026-09-12): the reader's picture and name at the
            foot, a door to their account; the rail keeps the picture alone */}
        {/* a door to the account, not a place: Settings' row says where you are (the audit's SH-14) */}
        <Link
          to="/settings/account"
          title={collapsed ? undefined : 'Your account'}
          {...tipProps(`${profile.name} · @${profile.handle} · your account`)}
          className={`shrink-0 flex items-center gap-2.5 border-t border-ink/[0.07] transition-colors hover:bg-ink/[0.03] ${collapsed ? 'pl-[14px] pr-0 py-2' : 'px-3.5 py-2'}`}
          data-sidenav-me
        >
          <Avatar profile={profile} size={24} />
          {!collapsed && (
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[12px] font-semibold text-textPrimary">{profile.name}</span>
              <span className="block truncate font-mono text-[10px] text-textMuted">@{profile.handle}</span>
            </span>
          )}
        </Link>
        {/* THE SIGNATURE (Slayer Logo System): "slayer:~ $ ● live" — the market's own word, live while it is open and
            closed when it is shut — over the session's own line and the clock. The rail, folded, keeps the state's dot. */}
        <RailSignature collapsed={collapsed} showTip={showTip} hideTip={hideTip} sessionStrip={shell.sessionStrip} deskClock={desk.clock} />
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

      {/* THE PHONE STRIP — the menu, the subject and the search. THE MENU (2026-09-19): the rail is off under 768px and nothing
          stood in for it — the only way between pages on a phone was to know the palette and type a page's name. The house
          mark opens it: the same groups, products and pages as the rail, as a sheet (MobileMenu.tsx). */}
      <div className="md:hidden fixed inset-x-0 top-0 z-40 h-12 flex items-center gap-2.5 px-2.5 bg-canvas/80 backdrop-blur-md border-b border-borderSubtle">
        {/* EVERY CONTROL ON THE STRIP IS A FINGER WIDE (the audit's X3.2): 44px boxes in the 48px strip */}
        <button type="button" onClick={() => setMenuOpen(true)} aria-label="Menu" aria-haspopup="dialog" aria-expanded={menuOpen} className="inline-flex items-center justify-center w-11 h-11 rounded-md border border-borderSubtle text-textSecondary" data-mobile-menu-door>
          <Menu className="w-4 h-4" />
        </button>
        <PhoneSubject onOpenPalette={onOpenPalette} />
        <button type="button" onClick={onOpenPalette} aria-label="Search a name or a page" className="ml-auto inline-flex items-center justify-center w-11 h-11 rounded-md border border-borderSubtle text-textMuted" data-mobile-search>
          <Search className="w-4 h-4" />
        </button>
      </div>
      <MobileMenu open={menuOpen} onClose={closeMenu} />
    </>
  );
};

export default SideNav;
