/*
==================================================
  SLAYER TERMINAL - NOTHING AT THIS ADDRESS
  (pages/notFound/NotFound.tsx)

  The app is one page, so a wrong address never 404s
  at the server: the router matched nothing and drew
  NOTHING — a black screen, no menu, no way back
  (measured 2026-09-19: 0 characters). Two pages stand
  there now (Noah picked "C, and yes add the did you
  mean"):

    INSIDE THE TERMINAL   a wrong address UNDER a
      product (/pinpoint/ahed, /settings/a/b). The rail
      and the footer stay, because the reader is one
      click from where they meant to be: the address
      typed back, the nearest real page, the palette,
      and every product as a row.

    THE PROMPT   a wrong address under nothing we have
      (/pricing, /login — what people type by hand from
      a post on X). Nothing of the terminal is up yet,
      so it is the house's prompt, full screen: it
      types the address, answers "no such page", and
      offers the way in.

  BOTH say the nearest real page (suggest.ts) and take
  Enter for it. Both mark the page `noindex` and name
  the tab "Page not found" — a single-page app cannot
  send a 404 status, and this is the honest next best.
==================================================
*/

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, CornerDownLeft, Search } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import PageHeader from '../../components/ui/PageHeader';
import { NAV_ITEMS } from '../../components/layout/nav';
import { useLaunch } from '../../components/layout/LaunchTransition';
import { openPalette } from '../../components/layout/paletteDoor';
import { metaFor } from '../../components/layout/PageMeta';
import { productOf, suggest, type Suggestion } from './suggest';
import ProductGlyph from '../../brand/ProductGlyph';
import Wordmark from '../../brand/Wordmark';

/** The tab's name and a `noindex` mark, for as long as the page stands. `active` lets a page that is only SOMETIMES a
    dead end wear it (Compass's setup page, when the address names no setup). */
export const useNotFoundHead = (active = true) => {
  useEffect(() => {
    if (!active) return;
    document.title = 'Page not found · Slayer Terminal';
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    document.head.appendChild(robots);
    return () => {
      robots.remove();
      /* NOT "the title it had before": by the time this page leaves, PageMeta has already named the page being opened
         (measured: restoring the old one left /pinpoint/ahead called "Pinpoint"). Ask for the address's own title. */
      document.title = metaFor(window.location.pathname).title;
    };
  }, [active]);
};

/** Where a suggestion leads. A front-page section is a full address change, so the landing scrolls to it on arrival. */
const useGo = () => {
  const navigate = useNavigate();
  return (s: Suggestion) => navigate(s.path);
};

/** Enter takes the first suggestion — unless the reader is typing somewhere */
const useEnterFor = (target: Suggestion | undefined, go: (s: Suggestion) => void, armed = true) => {
  useEffect(() => {
    if (!target || !armed) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' || t.tagName === 'A' || t.isContentEditable)) return;
      e.preventDefault();
      go(target);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.path, armed]);
};

const EnterKey = () => (
  <kbd className="inline-flex items-center gap-1 h-5 px-1.5 rounded border border-borderSubtle bg-chip font-mono text-[9.5px] uppercase tracking-wider text-textMuted">
    <CornerDownLeft className="w-2.5 h-2.5" aria-hidden /> Enter
  </kbd>
);

// ---- inside the terminal ---------------------------------------------------------------------

export const NotFoundInside = () => {
  useNotFoundHead();
  const { pathname } = useLocation();
  const go = useGo();
  const found = useMemo(() => suggest(pathname), [pathname]);
  const product = productOf(pathname);
  useEnterFor(found[0], go);

  return (
    <div className="flex flex-col gap-5" data-not-found="inside">
      <PageHeader breadcrumb={['Terminal', 'Not found']} title="Nothing at this address" subtitle={product ? `${product.label} has no page here. The address may be mistyped, or the page may have moved.` : 'The address may be mistyped, or the page may have moved.'} />

      <div className="border border-borderSubtle rounded-md bg-panel">
        <div className="px-4 py-3 border-b border-borderSubtle flex items-center gap-3 min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-widest text-textMuted shrink-0">You asked for</span>
          <code className="min-w-0 truncate font-mono text-[12.5px] text-textPrimary" data-not-found-address>
            {pathname}
          </code>
        </div>

        {found.length > 0 ? (
          <div className="px-4 py-4" data-not-found-suggest>
            <span className="font-mono text-[10px] uppercase tracking-widest text-textMuted">Did you mean</span>
            <div className="mt-2 flex flex-col">
              {found.map((s, i) => (
                <Link
                  key={s.path}
                  to={s.path}
                  className={`group flex items-center gap-3 py-2.5 ${i > 0 ? 'border-t border-borderSubtle/60' : ''}`}
                  data-not-found-link={s.path}
                >
                  <span className={`${i === 0 ? 'text-[20px] font-semibold tracking-tight' : 'text-[14px] font-medium'} text-textPrimary group-hover:text-silver transition-colors`}>{s.label}</span>
                  {s.where && <span className="font-mono text-[10px] uppercase tracking-widest text-textMuted">{s.where}</span>}
                  <code className="hidden sm:inline font-mono text-[11px] text-textMuted">{s.path}</code>
                  <span className="ml-auto inline-flex items-center gap-2 text-textMuted group-hover:text-textPrimary transition-colors">
                    {i === 0 && <EnterKey />}
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden />
                  </span>
                </Link>
              ))}
            </div>
            {found[0].note && <p className="mt-1 text-[12px] text-textSecondary">{found[0].note}</p>}
          </div>
        ) : (
          <div className="px-4 py-4 text-[12.5px] text-textSecondary" data-not-found-suggest="none">
            Nothing we have is close to that{product ? (
              <>
                . <Link to={product.path} className="text-textPrimary underline decoration-borderMuted underline-offset-4 hover:decoration-textPrimary">Back to {product.label}</Link>, or pick a page below.
              </>
            ) : (
              '. Pick a page below, or search.'
            )}
          </div>
        )}

        <div className="px-4 py-3 border-t border-borderSubtle">
          <button
            type="button"
            onClick={openPalette}
            className="w-full sm:w-auto inline-flex items-center gap-2.5 h-8 pl-2.5 pr-2 rounded-md border border-borderSubtle bg-chip hover:border-borderMuted text-[12px] text-textSecondary hover:text-textPrimary transition-colors"
            data-not-found-search
          >
            <Search className="w-3.5 h-3.5" aria-hidden />
            Search every page and every name
            <kbd className="ml-4 font-mono text-[9.5px] text-textMuted">Ctrl K</kbd>
          </button>
        </div>
      </div>

      <div className="border border-borderSubtle rounded-md bg-panel">
        <div className="px-4 py-2.5 border-b border-borderSubtle font-mono text-[10px] uppercase tracking-widest text-textMuted">Every product</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {NAV_ITEMS.map(item => (
            <Link key={item.path} to={item.path} className="group flex items-center gap-3 h-11 px-4 border-b border-borderSubtle/60 hover:bg-ink/[0.03] transition-colors" data-not-found-product={item.path}>
              {item.glyph ? (
                <ProductGlyph name={item.glyph} size={18} bare className="shrink-0" />
              ) : (
                <item.icon className="w-4 h-4 shrink-0 text-textMuted group-hover:text-[color:var(--ink)] transition-colors" strokeWidth={1.75} style={{ '--ink': item.ink } as CSSProperties} />
              )}
              <span className="text-[13px] text-textPrimary">{item.label}</span>
              <code className="ml-auto font-mono text-[10.5px] text-textMuted">{item.path}</code>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---- the prompt ------------------------------------------------------------------------------------

export const NotFoundPrompt = () => {
  useNotFoundHead();
  const { pathname } = useLocation();
  const { launch } = useLaunch();
  const go = useGo();
  const calm = useReducedMotion();
  const found = useMemo(() => suggest(pathname), [pathname]);
  const command = `cd ${pathname}`;
  /* THE PROMPT TYPES THE ADDRESS, then answers. How far it has typed; past the end = the answer is up. Still under reduced motion. */
  const [typed, setTyped] = useState(calm ? command.length + 1 : 0);
  useEffect(() => {
    if (calm) {
      setTyped(command.length + 1);
      return;
    }
    setTyped(0);
    let ticking: number | undefined;
    /* a beat before the first letter; the whole address in under a second however long it is */
    const started = window.setTimeout(() => {
      ticking = window.setInterval(() => {
        setTyped(n => {
          if (n > command.length) window.clearInterval(ticking);
          return n + 1;
        });
      }, Math.max(14, Math.min(42, 900 / command.length)));
    }, 350);
    return () => {
      window.clearTimeout(started);
      window.clearInterval(ticking);
    };
  }, [command, calm]);
  const answered = typed > command.length;
  useEnterFor(found[0], go, answered);

  return (
    <div className="min-h-screen bg-canvas text-textPrimary flex flex-col" data-not-found="prompt">
      <header className="shrink-0 h-[64px] flex items-center px-5 sm:px-8">
        <Link to="/" className="inline-flex" aria-label="Slayer Terminal, the front page">
          <Wordmark height={14} cursor label="" />
        </Link>
      </header>

      <main className="flex-1 flex items-center px-5 sm:px-8 pb-[12vh]">
        <div className="w-full max-w-[760px] mx-auto">
          <h1 className="sr-only">Page not found</h1>
          <div className="font-mono text-[clamp(1.05rem,2.6vw,1.6rem)] leading-[1.7] break-all" aria-hidden={!answered}>
            <p>
              <span className="text-textMuted">slayer:~ $ </span>
              {command.slice(0, typed)}
              {answered && <span className="text-textSecondary" data-not-found-answer> → no such page.</span>}
              {!answered && <span className="inline-block w-[0.55em] h-[1.05em] ml-0.5 bg-textPrimary align-[-0.15em] animate-cursor-blink" />}
            </p>
            {answered && (
              <div className="animate-fade-in">
                {found[0] && (
                  <p className="mt-1" data-not-found-suggest>
                    <span className="text-textMuted">did you mean </span>
                    <Link to={found[0].path} className="text-textPrimary underline decoration-borderMuted underline-offset-[6px] hover:decoration-textPrimary" data-not-found-link={found[0].path}>
                      {found[0].path}
                    </Link>
                    <span className="text-textMuted"> ?</span>
                  </p>
                )}
                <p>
                  <span className="text-textMuted">slayer:~ $ </span>
                  <span className="inline-block w-[0.55em] h-[1.05em] bg-textPrimary align-[-0.15em] animate-cursor-blink" />
                </p>
              </div>
            )}
          </div>

          {answered && (
            <div className="mt-10 animate-fade-in">
              {found[0] ? (
                <p className="text-[15px] text-textSecondary leading-relaxed">
                  That looks like <span className="text-textPrimary font-medium">{found[0].label}</span>
                  {found[0].where ? `, on the ${found[0].where === 'Front page' ? 'front page' : `${found[0].where} page`}` : ''}. {found[0].note ?? ''}
                  <span className="ml-2 align-middle">
                    <EnterKey />
                  </span>
                </p>
              ) : (
                <p className="text-[15px] text-textSecondary leading-relaxed">Nothing we have is close to that address. It may be mistyped, or the page may have moved.</p>
              )}
              {found.length > 1 && (
                <p className="mt-2 text-[13px] text-textMuted">
                  Or{' '}
                  {found.slice(1).map((s, i) => (
                    <span key={s.path}>
                      {i > 0 && ', '}
                      <Link to={s.path} className="text-textSecondary underline decoration-borderMuted underline-offset-4 hover:text-textPrimary">
                        {s.label}
                        {s.where ? ` (${s.where})` : ''}
                      </Link>
                    </span>
                  ))}
                  .
                </p>
              )}
              <div className="mt-7 flex items-center gap-3 flex-wrap">
                <a
                  href="/pulse"
                  onClick={e => {
                    e.preventDefault();
                    launch('/pulse');
                  }}
                  className="launch-pill h-12 px-6 inline-flex items-center rounded-full text-[14.5px] font-medium"
                  data-not-found-door="launch"
                >
                  Launch terminal
                </a>
                <Link to="/" className="h-12 px-5 inline-flex items-center rounded-full border border-borderMuted text-[14.5px] font-medium text-textPrimary hover:bg-ink/[0.05] transition-colors" data-not-found-door="front">
                  Front page
                </Link>
              </div>
              <p className="mt-3 text-[12px] text-textMuted">Opens the demo on simulated data.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
