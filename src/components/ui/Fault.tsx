/*
==================================================
  SLAYER TERMINAL - WHEN SOMETHING BREAKS
  (components/ui/Fault.tsx)

  What a reader is told when a page, or the whole app,
  stops — in plain words, with the way out first and
  the engineer's line last (2026-09-19).

  THREE FAULTS, AND THEY ARE NOT THE SAME NEWS:

    THE TERMINAL WAS UPDATED   the commonest one a
      single-page app has: a tab left open across a
      deploy asks for a page's code by its OLD name,
      and the server no longer has it. Nothing is
      wrong; a reload fixes it — so it reloads ITSELF,
      once (twice in half a minute would be a loop, so
      the second time it asks instead).
    YOU ARE OFFLINE   the same request failing because
      there is no network. A reload will not help and
      the page says so.
    SOMETHING BROKE   a real error. It says so, offers
      the reload and the way back, and gives the line
      to send us.

  TWO NETS:
    the page's   AppShell's RouteBoundary — the rail
                 stays up, the fault takes the page's
                 place, and the next page gets a clean
                 try.
    the app's    AppBoundary, around everything
                 (main.tsx). Until now an error in the
                 landing, the not-found page, the rail
                 or a provider had NO net: the screen
                 went blank. It uses plain links, not
                 the router's, because the router may
                 be the thing that broke.
==================================================
*/

import { Component, type ErrorInfo, type ReactNode } from 'react';
import BracketCard from '../../brand/BracketCard';
import SlayerMark from '../../brand/SlayerMark';
import Wordmark from '../../brand/Wordmark';

const STALE = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Unable to preload CSS/i;
/** A page's code asked for by a name the server no longer has (a deploy happened under an open tab) — or no network at all */
export const isLoadFault = (error: Error): boolean => STALE.test(`${error.name} ${error.message}`);

const RELOADED_AT = 'slayer_fault_reloaded_at';
/** Reload once for a stale build. False when it already did so moments ago — then the reader is asked, not looped. */
export function reloadOnceForStaleBuild(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT) ?? 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(RELOADED_AT, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

interface FaultViewProps {
  error: Error;
  /** 'page' sits inside the shell; 'app' is the whole screen */
  scope: 'page' | 'app';
  /** The way back, as the host can offer it (the shell passes a router link; the app's net cannot) */
  back?: ReactNode;
  /** Draw the panel again without reloading the terminal — the shell's boundary offers it ("Reload panel") */
  retry?: () => void;
}

/* THE WORDS ARE THE BRAND'S (Slayer Logo System, Web and App · System pages, 2026-10-01): "When it breaks, say so." A panel
   that broke says "That didn't go through." and that the rest of the desk still works; the whole terminal stopping is
   "Something broke on our side." Both offer the status page. The mark on the card says it too: still, without its
   cursor, for a fault; the pan at speed for a page being fetched again. */
export const FaultView = ({ error, scope, back, retry }: FaultViewProps) => {
  const load = isLoadFault(error);
  const offline = load && typeof navigator !== 'undefined' && navigator.onLine === false;
  const head = offline ? 'You’re offline.' : load ? 'The terminal was updated.' : scope === 'app' ? 'Something broke on our side.' : 'That didn’t go through.';
  const says = offline
    ? 'This page needs the connection to load. Pages you have already opened still work. Try again once you are back online.'
    : load
      ? 'A newer version was published while this tab was open, so this page has to be fetched again. Reload and you are back where you were.'
      : scope === 'app'
        ? 'Try again in a minute. Your desks, marks and settings are safe: they are kept on this machine.'
        : 'This panel hit an error. The rest of your desk still works.';
  const ghost = 'inline-flex items-center h-10 px-5 rounded-full border border-borderMuted text-[13.5px] font-medium text-textPrimary hover:bg-ink/[0.05]';
  const card = (
    <BracketCard className="w-full max-w-[560px] p-7 sm:p-9 flex flex-col items-start gap-3" label="fault">
      <div role="alert" className="contents" data-fault={offline ? 'offline' : load ? 'stale' : 'error'}>
        <SlayerMark size={48} state={load && !offline ? 'loading' : 'offline'} label="" />
        <h1 className="mt-4 text-[28px] font-light tracking-[-0.02em] text-textPrimary leading-tight">{head}</h1>
        <p className="text-[15px] text-textSecondary leading-relaxed">{says}</p>
        <div className="mt-3 flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => (retry && !load ? retry() : window.location.reload())}
            className="inline-flex items-center h-10 px-5 rounded-full bg-textPrimary text-canvas text-[13.5px] font-medium hover:bg-textPrimary/90"
            data-fault-reload
          >
            {offline ? 'Try again' : load ? 'Reload' : retry ? 'Reload panel' : 'Try again'}
          </button>
          <a href="/status" className={ghost} data-fault-status>
            Status
          </a>
          {back}
        </div>
        {!load && (
          <p className="mt-3 text-[12px] text-textMuted leading-relaxed">
            If it keeps happening, send this line to{' '}
            <a href={`mailto:info@slayerterminal.com?subject=${encodeURIComponent('A fault in the terminal')}&body=${encodeURIComponent(`${error.name}: ${error.message}\n${typeof location !== 'undefined' ? location.href : ''}`)}`} className="text-textSecondary underline decoration-borderMuted underline-offset-4 hover:text-textPrimary">
              info@slayerterminal.com
            </a>
            :
            <code className="mt-1.5 block font-code text-[11px] text-textSecondary break-all select-all" data-fault-line>
              {error.name}: {error.message}
            </code>
          </p>
        )}
      </div>
    </BracketCard>
  );
  if (scope === 'page') return card;
  return (
    <div className="min-h-screen bg-canvas text-textPrimary flex flex-col">
      <header className="shrink-0 h-[64px] flex items-center px-5 sm:px-8">
        <a href="/" className="inline-flex" aria-label="Slayer Terminal, the front page">
          <Wordmark height={14} cursor label="" />
        </a>
      </header>
      <main className="flex-1 flex items-center justify-center px-5 pb-[12vh]">{card}</main>
    </div>
  );
};

/** The net around everything. A stale build reloads itself once; anything else is said, full screen. */
export class AppBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[app boundary]', error, info.componentStack);
    if (isLoadFault(error) && navigator.onLine !== false) reloadOnceForStaleBuild();
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <FaultView
        error={this.state.error}
        scope="app"
        back={
          <a href="/" className="inline-flex items-center h-10 px-5 rounded-full border border-borderMuted text-[13.5px] font-medium text-textPrimary hover:bg-ink/[0.05]">
            Front page
          </a>
        }
      />
    );
  }
}
