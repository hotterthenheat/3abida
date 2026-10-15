/*
==================================================
  SLAYER TERMINAL - THE UPDATE-DEPTH TRAP (development only)
  (src/dev/depthTrap.ts)

  2026-10-14 — the owner: "Phone 'Maximum update depth
  exceeded': log the component and state when it
  fires, find the loop, fix it, report the cause."
  The warning was seen ONCE on a phone run that day
  and did not come back in seven runs with a hook in
  place (four plain, three CPU-throttled with the
  viewport turning — scripts/_tmp of that day). Until
  it does, this trap stands in every development load:
  when React prints "Maximum update depth exceeded"
  (or "Too many re-renders") it keeps the component
  stack React hands the console, the moment, and every
  state snapshot a page registered (registerDepthState
  — Terrain's panes register their measured widths and
  plan), prints them as one block, and keeps them at
  window.__slayerDepth for a copy. Nothing of it runs
  in production.
  2026-10-15: fourteen runs on four phone sizes, the
  CPU slowed four times, without a hit. A phone has no
  console, so a hit is also posted to the dev server
  (vite.config.ts depthLog: .feed-cache/
  depth-trap.ndjson on the machine serving the page)
  and a small banner says so at the foot of the page.
==================================================
*/

type Snapshot = () => Record<string, unknown>;
const snaps = new Map<string, Snapshot>();

/** A page's own state, read when the trap fires — returns the un-register */
export function registerDepthState(name: string, snap: Snapshot): () => void {
  snaps.set(name, snap);
  return () => {
    if (snaps.get(name) === snap) snaps.delete(name);
  };
}

export interface DepthHit {
  at: string;
  message: string;
  componentStack: string;
  states: Record<string, unknown>;
}

/** A plain DOM line at the page's foot — React is the thing looping, so none of it is used */
function showBanner(count: number): void {
  try {
    let el = document.getElementById('slayer-depth-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'slayer-depth-banner';
      el.setAttribute('role', 'status');
      el.style.cssText =
        'position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483647;padding:8px 10px;border-radius:6px;font:12px/1.4 var(--font-sans, Helvetica, Arial, sans-serif);background:rgb(var(--panel));color:rgb(var(--text-primary));border:1px solid rgb(var(--warn));pointer-events:none';
      document.body.appendChild(el);
    }
    el.textContent = `Update loop caught (${count}) — kept in .feed-cache/depth-trap.ndjson on the machine serving this page`;
  } catch {
    /* no body yet */
  }
}

export function installDepthTrap(): void {
  if (typeof window === 'undefined') return;
  const w = window as Window & { __slayerDepth?: DepthHit[]; __slayerDepthInstalled?: boolean };
  if (w.__slayerDepthInstalled) return;
  w.__slayerDepthInstalled = true;
  const hits: DepthHit[] = (w.__slayerDepth = []);
  const orig = console.error;
  console.error = function (...args: unknown[]) {
    try {
      const text = args.map(a => (typeof a === 'string' ? a : a instanceof Error ? a.message : '')).join(' ');
      if (/Maximum update depth exceeded|Too many re-renders/.test(text)) {
        /* React's effect warning carries the component stack as its own string argument ("\n    in Pane (at …)"); the thrown
           kind carries an Error */
        const stackArg = args.find(a => typeof a === 'string' && /^\s*(at |in )/.test(a)) as string | undefined;
        const err = args.find(a => a instanceof Error) as Error | undefined;
        const states: Record<string, unknown> = {};
        for (const [k, s] of snaps) {
          try {
            states[k] = s();
          } catch (e) {
            states[k] = `snapshot failed: ${String(e)}`;
          }
        }
        const hit: DepthHit = {
          at: new Date().toISOString(),
          message: text.slice(0, 600),
          componentStack: (stackArg ?? err?.stack ?? new Error().stack ?? '').slice(0, 4000),
          states,
        };
        hits.push(hit);
        void fetch('/__slayer/depth', { method: 'POST', body: JSON.stringify(hit), keepalive: true }).catch(() => undefined);
        showBanner(hits.length);
        orig.call(console, `[slayer depth trap] ${hit.at}\n${hit.message}\n--- component stack ---\n${hit.componentStack}\n--- registered states ---\n${JSON.stringify(states, null, 1)}`);
      }
    } catch {
      /* the trap never throws */
    }
    return orig.apply(console, args as []);
  };
}
