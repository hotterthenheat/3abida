/*
==================================================
  SLAYER TERMINAL - THE PHONE'S MENU
  (components/layout/MobileMenu.tsx)

  Under 768px the side rail is off, and until
  2026-09-19 nothing stood in for it: the phone strip
  held the subject and the search, so the ONLY way
  from one page to another on a phone was to know the
  command palette and type a page's name. The paid
  traffic arrives on phones.

  This is the rail, as a sheet from the left: the same
  groups, the same products in the same order (nav.ts),
  the same pages under each (navTree.ts) — read from
  the same lists, so the phone cannot fall behind the
  desk. A product with pages under it opens them with
  its arrow; the one you are inside opens itself. The
  bell is here too, with its count.

  It closes on a pick, on the glass behind it, on
  Escape, and whenever the page changes under it.

  Since 2026-10-09 it carries what the rail's foot
  carries (the audit's SH-13): who is at the desk, a
  door to the account, and where New York's day
  stands with the clock; the bell counts the rail's
  way (alerts/AlertCount.tsx), and the mark goes home
  through the launch gate, as the rail's does (SH-15).
==================================================
*/

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, X } from 'lucide-react';
import JingleBell from '../ui/JingleBell';
import { useOverlay } from '../ui/layers';
import Avatar from '../ui/Avatar';
import { useProfile } from '../../data/profile';
import { useDeskPrefs } from '../../data/deskPrefs';
import { useLaunch } from './LaunchTransition';
import { AlertBadge, useAlertCounts } from '../alerts/AlertCount';
import SessionStrip, { railClock, readDay } from './SessionStrip';
import { useShellPrefs } from './shellPrefs';
import { NAV_GROUPS, NAV_GROUP_META, itemsByGroup, type NavGroup } from './nav';
import { subpagesFor } from './navTree';
import { useCompassView } from '../../data/compassView';
import { toggleAlertsDrawer } from '../../data/alertsDrawer';
import ProductGlyph from '../../brand/ProductGlyph';
import SlayerMark from '../../brand/SlayerMark';
import Wordmark from '../../brand/Wordmark';
import Signature from '../../brand/Signature';

interface Props {
  open: boolean;
  onClose: () => void;
}

const MobileMenu = ({ open, onClose }: Props) => {
  const { pathname } = useLocation();
  const { chosenId } = useCompassView();
  const counts = useAlertCounts();
  const profile = useProfile();
  const desk = useDeskPrefs();
  const shell = useShellPrefs();
  const { launch } = useLaunch();
  const panel = useRef<HTMLDivElement | null>(null);
  /** the products whose pages the reader has opened by hand; the one they are inside is open without asking */
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  /* the dialog contract (ui/layers.ts): focus in, Tab kept inside, Esc as the top layer, focus back to the menu button */
  useOverlay({ open, ref: panel, onClose });
  /* the clock under the signature, a step a second while the menu is open */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  /* the page changed under it — a pick from the menu, or Back */
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    /* the page behind must not scroll under the sheet */
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  /* ONE GROUP OF THE MENU — Home (Pulse) stands above the Alerts row, the captioned groups under it, More last (the rail's order, nav.ts) */
  const groupBlock = (group: NavGroup) => (
        <div key={group} className={group === 'Home' ? '' : 'mt-4'} data-mobile-group={group}>
          {NAV_GROUP_META[group].caption && <span className="block px-3 pb-1 text-[10px] uppercase tracking-[0.1em] text-textMuted">{NAV_GROUP_META[group].caption}</span>}
          {itemsByGroup(group).map(item => {
            const inside = pathname.startsWith(item.path);
            const subs = subpagesFor(item.path, pathname, chosenId);
            const isOpen = !!subs && (opened[item.path] ?? inside);
            /* the page you are on is the LONGEST nested path the address starts with (the rail's own rule) */
            const activeIdx = subs ? subs.reduce((best, s, i) => (pathname.startsWith(s.path) && (best < 0 || s.path.length > subs[best].path.length) ? i : best), -1) : -1;
            return (
              <div key={item.path}>
                <div className={`flex items-stretch rounded-lg ${inside ? 'bg-ink/[0.06]' : ''}`}>
                  <NavLink
                    to={item.path}
                    onClick={onClose}
                    className={`min-w-0 flex-1 flex items-center gap-3 h-11 pl-3 text-[14px] ${inside ? 'text-textPrimary font-medium' : 'text-textSecondary'}`}
                    data-mobile-item={item.path}
                  >
                    {/* the product's glyph, as on the rail (brand/ProductGlyph); Settings keeps its line icon */}
                    {item.glyph ? (
                      <ProductGlyph name={item.glyph} size={20} bare className="shrink-0" />
                    ) : (
                      <item.icon className={`w-[18px] h-[18px] shrink-0 ${inside ? 'text-[color:var(--ink)]' : 'text-textMuted'}`} strokeWidth={inside ? 2 : 1.75} style={{ '--ink': item.ink } as CSSProperties} />
                    )}
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                  {subs && (
                    <button
                      type="button"
                      onClick={() => setOpened(o => ({ ...o, [item.path]: !isOpen }))}
                      aria-expanded={isOpen}
                      aria-label={`${item.label}: ${isOpen ? 'hide' : 'show'} its pages`}
                      className="shrink-0 w-11 inline-flex items-center justify-center text-textMuted hover:text-textPrimary"
                      data-mobile-more={item.path}
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>
                {isOpen && subs && (
                  <div className="ml-[21px] my-1 pl-3 border-l border-ink/[0.1] flex flex-col">
                    {subs.map((s, i) => (
                      <Link
                        key={s.path}
                        to={s.path}
                        onClick={onClose}
                        aria-current={i === activeIdx ? 'page' : undefined}
                        className={`h-10 flex items-center px-2.5 rounded-md text-[13.5px] ${i === activeIdx ? 'text-textPrimary font-medium bg-ink/[0.05]' : 'text-textSecondary'}`}
                        data-mobile-sub={s.path}
                      >
                        {s.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
  );

  return createPortal(
    <div className="md:hidden fixed inset-0 z-[70]" data-mobile-menu>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-fade-in" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        tabIndex={-1}
        className="absolute inset-y-0 left-0 w-[min(86vw,320px)] flex flex-col bg-panel border-r border-borderSubtle shadow-2xl shadow-black/60 animate-slide-in outline-none"
      >
        <div className="shrink-0 h-12 flex items-center gap-2 pl-4 pr-2 border-b border-borderSubtle">
          <a
            href="/"
            onClick={e => {
              e.preventDefault();
              onClose();
              launch('/');
            }}
            className="inline-flex items-center gap-2.5 h-11"
            aria-label="Slayer Terminal, the front page"
          >
            <SlayerMark size={20} bare label="" />
            <Wordmark height={12} label="" />
          </a>
          <button type="button" onClick={onClose} aria-label="Close the menu" className="ml-auto inline-flex items-center justify-center w-11 h-11 rounded-md text-textSecondary hover:text-textPrimary hover:bg-ink/[0.06]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-2" aria-label="Terminal">
          {groupBlock('Home')}
          <button
            type="button"
            onClick={() => {
              onClose();
              toggleAlertsDrawer();
            }}
            aria-label={counts.label}
            aria-haspopup="dialog"
            className="w-full flex items-center gap-3 h-11 px-3 rounded-lg text-[14px] text-textSecondary hover:text-textPrimary hover:bg-ink/[0.04]"
            data-mobile-alerts
          >
            <JingleBell count={counts.set} lit={counts.unseen > 0} glyph={20} />
            <span>Alerts</span>
            <AlertBadge counts={counts} className="ml-auto" />
          </button>

          {NAV_GROUPS.filter(g => g !== 'Home').map(groupBlock)}
        </nav>
        {/* WHO IS AT THE DESK — a door to the account, as on the rail's foot */}
        <Link to="/settings/account" onClick={onClose} className="shrink-0 flex items-center gap-3 min-h-[52px] px-4 py-2 border-t border-borderSubtle hover:bg-ink/[0.03]" data-mobile-me>
          <Avatar profile={profile} size={28} />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[13px] font-semibold text-textPrimary">{profile.name}</span>
            <span className="block truncate font-mono text-[11px] text-textMuted">@{profile.handle} · your account</span>
          </span>
        </Link>
        {/* the menu's foot: the signature, in the market's own word, and where the day stands */}
        <div className="shrink-0 px-4 py-3 border-t border-borderSubtle" data-mobile-foot>
          <Signature rule={false} className="text-[11px]" />
          {shell.sessionStrip ? (
            <SessionStrip read={readDay(now)} time={railClock(desk.clock, now)} />
          ) : (
            <span className="mt-1.5 block text-[11px] tnum text-textMuted">{railClock(desk.clock, now)}</span>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MobileMenu;
