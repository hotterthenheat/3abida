/*
  A browser floor, so the proofs can drive the real modules.

  The engine, the simulator and every store in this build are written for a
  tab: they set timers on `window`, persist through `localStorage`, and hang
  listeners off `document`. None of that is incidental — it is what the code
  under test actually does — so the proofs give it somewhere to do it rather
  than a parallel implementation to be tested instead.

  IMPORTED FIRST, ALWAYS. ES modules evaluate in import order, so this has to
  be the first line of any proof that touches a stateful module; an engine
  imported above it reads `window` while running its own module body and
  throws before a single assertion has been made.
*/

const store = new Map<string, string>();
const storage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
};

const g = globalThis as Record<string, unknown>;
const listeners = new Map<string, Set<(e: unknown) => void>>();
const noop = () => {};
const target = {
  addEventListener: (type: string, fn: (e: unknown) => void) => {
    (listeners.get(type) ?? listeners.set(type, new Set()).get(type)!).add(fn);
  },
  removeEventListener: (type: string, fn: (e: unknown) => void) => void listeners.get(type)?.delete(fn),
  dispatchEvent: (e: { type: string }) => {
    listeners.get(e.type)?.forEach(fn => fn(e));
    return true;
  },
};

g.localStorage ??= storage;
g.sessionStorage ??= storage;
g.window ??= {
  ...target,
  localStorage: storage,
  sessionStorage: storage,
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis),
  setInterval: globalThis.setInterval.bind(globalThis),
  clearInterval: globalThis.clearInterval.bind(globalThis),
  requestAnimationFrame: (fn: (t: number) => void) => globalThis.setTimeout(() => fn(Date.now()), 16) as unknown as number,
  cancelAnimationFrame: (id: number) => globalThis.clearTimeout(id),
  matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop }),
  devicePixelRatio: 1,
  innerWidth: 1440,
  innerHeight: 900,
  location: { href: 'http://localhost/', pathname: '/', search: '', hash: '' },
  navigator: { userAgent: 'slayer-proof', language: 'en-US' },
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
};
g.document ??= {
  ...target,
  documentElement: { style: { setProperty: noop, getPropertyValue: () => '' }, classList: { add: noop, remove: noop, contains: () => false }, dataset: {} },
  body: { classList: { add: noop, remove: noop, contains: () => false }, style: {} },
  createElement: () => ({ style: {}, setAttribute: noop, appendChild: noop, remove: noop, classList: { add: noop, remove: noop } }),
  querySelector: () => null,
  querySelectorAll: () => [],
  visibilityState: 'visible',
  hidden: false,
};
g.navigator ??= { userAgent: 'slayer-proof', language: 'en-US' };
g.requestAnimationFrame ??= (fn: (t: number) => void) => globalThis.setTimeout(() => fn(Date.now()), 16) as unknown as number;
g.cancelAnimationFrame ??= (id: number) => globalThis.clearTimeout(id);
g.matchMedia ??= () => ({ matches: false, addEventListener: noop, removeEventListener: noop });

export const shimmed = true;
