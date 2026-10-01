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
==================================================
*/

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, X } from 'lucide-react';
import JingleBell from '../ui/JingleBell';
import useFocusTrap from '../ui/useFocusTrap';
import { NAV_GROUPS, NAV_GROUP_META, itemsByGroup, type NavGroup } from './nav';
import { subpagesFor } from './navTree';
import { useCompassView } from '../../data/compassView';
import { useAllAlerts, useUnseenAll } from '../gex/alertStore';
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
  const unseen = useUnseenAll();
  const setTotal = useAllAlerts().reduce((n, a) => n + a.alerts.filter(x => !x.firedAt).length, 0);
  const panel = useRef<HTMLDivElement | null>(null);
  /** the products whose pages the reader has opened by hand; the one they are inside is open without asking */
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  useFocusTrap(open, panel);

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
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', key);
    /* the page behind must not scroll under the sheet */
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', key);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

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
          <Link to="/" onClick={onClose} className="inline-flex items-center gap-2.5" aria-label="Slayer Terminal, the front page">
            <SlayerMark size={24} label="" />
            <Wordmark height={12} label="" />
          </Link>
          <button type="button" onClick={onClose} aria-label="Close the menu" className="ml-auto inline-flex items-center justify-center w-9 h-9 rounded-md text-textSecondary hover:text-textPrimary hover:bg-ink/[0.06]">
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
            className="w-full flex items-center gap-3 h-11 px-3 rounded-lg text-[14px] text-textSecondary hover:text-textPrimary hover:bg-ink/[0.04]"
            data-mobile-alerts
          >
            <JingleBell count={setTotal + unseen} lit={unseen > 0} glyph={20} />
            <span>Alerts</span>
            {(unseen > 0 || setTotal > 0) && <span className={`ml-auto font-mono text-[11px] tnum ${unseen > 0 ? 'text-select' : 'text-textMuted'}`}>{unseen > 0 ? `${unseen} alerted` : `${setTotal} set`}</span>}
          </button>

          {NAV_GROUPS.filter(g => g !== 'Home').map(groupBlock)}
        </nav>
        {/* the menu's foot: the signature, in the market's own word */}
        <div className="shrink-0 px-4 py-3 border-t border-borderSubtle">
          <Signature rule={false} className="text-[11px]" />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MobileMenu;
