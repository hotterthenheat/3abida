import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Antenna, Check, CircleSlash, Loader2, TriangleAlert } from 'lucide-react';
import {
  CAPABILITIES,
  PROVIDER_META,
  capabilitiesFor,
  checkProvider,
  feedsFor,
  isProxied,
  providerStatuses,
  surfacesFor,
  type Capability,
  type ProviderId,
  type ProviderStatus,
} from '../../providers';
import { NAV_ITEMS } from '../../components/layout/nav';

/*
==================================================
  SLAYER TERMINAL - DATA SOURCES
  (pages/settings/DataSources.tsx)

  What each key buys, and what is still the
  simulator.
==================================================

  A READER PAYING FOR FOUR PLANS HAS ONE QUESTION and no page in the
  terminal answered it: what am I getting for this. So this lists every
  capability the two vendors publish, which plan carries it, which surface
  it feeds — and, plainly, whether it is connected right now.

  IT DOES NOT PRINT A KEY, ever, not masked and not partially. A masked
  secret is still a secret on screen and still lands in a screenshot; the
  only honest thing to show is WHETHER one is present. Setting one is a
  deployment act, not a settings toggle, so the page tells you which
  variable to set and stops there.

  THE CAVEATS SIT AT THE SAME SIZE AS THE PROMISE. "Real-time greeks" and
  "except on the contracts where the vendor omits them" are the same fact,
  and splitting them across a headline and a footnote is how a desk ends up
  trusting a number it should not.
*/

const STATE_INK: Record<ProviderStatus['state'], string> = {
  live: 'text-bull',
  checking: 'text-textSecondary',
  refused: 'text-bear',
  error: 'text-warn',
  unconfigured: 'text-textMuted',
};

const STATE_WORD: Record<ProviderStatus['state'], string> = {
  live: 'connected',
  checking: 'checking',
  refused: 'refused',
  error: 'no answer',
  unconfigured: 'no key',
};

const StateIcon = ({ state }: { state: ProviderStatus['state'] }) => {
  const cls = `w-3.5 h-3.5 ${STATE_INK[state]}`;
  if (state === 'live') return <Check className={cls} aria-hidden="true" />;
  if (state === 'checking') return <Loader2 className={`${cls} animate-spin`} aria-hidden="true" />;
  if (state === 'unconfigured') return <CircleSlash className={cls} aria-hidden="true" />;
  return <TriangleAlert className={cls} aria-hidden="true" />;
};

const labelFor = (path: string): string => {
  const top = `/${path.split('/')[1] ?? ''}`;
  return NAV_ITEMS.find(i => i.path === top)?.label ?? top.replace('/', '') ?? path;
};

const CapRow = ({ c }: { c: Capability }) => (
  <div className="px-5 py-2.5 border-t border-borderSubtle/60 grid gap-x-4 gap-y-1 items-baseline" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,0.7fr) minmax(0,1fr)' }} data-capability={c.id}>
    <div className="min-w-0">
      <div className="text-[12px] text-textPrimary">{c.what}</div>
      <div className="font-mono text-[10px] text-textMuted truncate" title={c.endpoint}>{c.endpoint}</div>
      {c.caveat && (
        <div className="mt-1 text-[10.5px] leading-snug text-warn/90">{c.caveat}</div>
      )}
    </div>
    <div className="font-mono text-[10px] uppercase tracking-wider text-textSecondary whitespace-nowrap">
      {c.transport === 'ws' ? 'socket' : 'rest'} · {c.plan}
    </div>
    <div className="flex flex-wrap gap-1">
      {c.surfaces.length === 0 ? (
        <span className="text-[10.5px] text-textMuted">no surface yet</span>
      ) : (
        c.surfaces.map(s => (
          <Link key={s} to={s} className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors whitespace-nowrap">
            {labelFor(s)}
          </Link>
        ))
      )}
    </div>
  </div>
);

const ProviderCard = ({ id, status, onCheck }: { id: ProviderId; status: ProviderStatus; onCheck: (id: ProviderId) => void }) => {
  const meta = PROVIDER_META[id];
  const caps = useMemo(() => capabilitiesFor(id), [id]);
  const surfaces = useMemo(() => surfacesFor(id), [id]);
  const feeds = useMemo(() => feedsFor(id), [id]);
  const [open, setOpen] = useState(false);

  return (
    <section className="border border-borderSubtle rounded-md bg-panel overflow-clip" data-provider={id}>
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold leading-tight text-textPrimary">{meta.label}</h2>
            <span className={`inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest ${STATE_INK[status.state]}`} data-provider-state={status.state}>
              <StateIcon state={status.state} />
              {STATE_WORD[status.state]}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-textSecondary">{status.note}</p>
          <p className="mt-1 text-[11px] text-textMuted">
            {caps.length} capabilities · feeds {feeds.size === 0 ? 'nothing yet' : [...feeds.keys()].join(', ')} · {surfaces.length} surfaces
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onCheck(id)}
            disabled={!status.configured || status.state === 'checking'}
            className="px-2.5 h-7 inline-flex items-center rounded-md border border-borderSubtle text-[11px] font-semibold text-textPrimary hover:border-borderMuted transition-colors"
            data-provider-check={id}
          >
            Test
          </button>
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            aria-expanded={open}
            className="px-2.5 h-7 inline-flex items-center rounded-md border border-borderSubtle text-[11px] text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors"
            data-provider-expand={id}
          >
            {open ? 'Hide' : `Show ${caps.length}`}
          </button>
        </div>
      </div>

      {!status.configured && (
        <div className="px-5 py-2.5 border-t border-borderSubtle/60 bg-inset">
          <p className="text-[11px] text-textSecondary">
            Set <code className="font-mono text-[10.5px] text-textPrimary">{meta.envVar}</code> in a local <code className="font-mono text-[10.5px] text-textPrimary">.env</code> and rebuild — or point{' '}
            <code className="font-mono text-[10.5px] text-textPrimary">VITE_DATA_PROXY</code> at a server that holds the key, which is the one that keeps it secret.
          </p>
        </div>
      )}

      {open && caps.map(c => <CapRow key={c.id} c={c} />)}
    </section>
  );
};

const DataSources = () => {
  const [statuses, setStatuses] = useState<ProviderStatus[]>(() => providerStatuses());

  const check = useCallback(async (id: ProviderId) => {
    setStatuses(prev => prev.map(s => (s.id === id ? { ...s, state: 'checking', note: 'Asking the provider…' } : s)));
    const next = await checkProvider(id);
    setStatuses(prev => prev.map(s => (s.id === next.id ? next : s)));
  }, []);

  /* A configured provider is probed once on arrival: a page that claims to
     say whether a key works should not need to be asked. An unconfigured one
     is never probed — there is nothing to ask with. */
  useEffect(() => {
    const ac = new AbortController();
    for (const s of providerStatuses()) {
      if (!s.configured) continue;
      checkProvider(s.id, ac.signal).then(next =>
        setStatuses(prev => prev.map(p => (p.id === next.id ? next : p)))
      );
    }
    return () => ac.abort();
  }, []);

  const configured = statuses.filter(s => s.configured).length;
  const connected = statuses.filter(s => s.state === 'live').length;

  return (
    <div className="flex flex-col gap-4" data-data-sources>
      <section className="border border-borderSubtle rounded-md bg-panel overflow-clip">
        <div className="px-5 pt-4 pb-3">
          <h2 className="text-[15px] font-semibold leading-tight text-textPrimary">Data sources</h2>
          <p className="mt-0.5 text-[11px] text-textSecondary">
            Every capability the two providers publish, which plan carries it, and where it lands in the terminal.
          </p>
        </div>
        <div className="px-5 py-3 border-t border-borderSubtle/60 flex items-start gap-2.5">
          <Antenna className="w-3.5 h-3.5 mt-0.5 shrink-0 text-textMuted" aria-hidden="true" />
          <p className="text-[11px] leading-relaxed text-textSecondary">
            {connected > 0 ? (
              <>
                <span className="text-bull">{connected} of {statuses.length} connected.</span>{' '}
                The surfaces they feed now say so on their own provenance chips; everything else is still the simulator, and says that instead.
              </>
            ) : configured > 0 ? (
              <>A key is present but nothing has answered yet. Until one does, every number in the terminal is the simulator&apos;s and every chip says so.</>
            ) : (
              <>
                No provider is configured, so the whole terminal is running on its simulator — which is what every provenance chip in the app already reports. Nothing below is switched on by this page; it is switched on by a key.
              </>
            )}
          </p>
        </div>
        <div className="px-5 py-3 border-t border-borderSubtle/60">
          <div className="text-[12px] text-textPrimary">{isProxied() ? 'Proxied' : 'Direct from the browser'}</div>
          <p className="text-[11px] text-textSecondary">
            {isProxied()
              ? 'Requests route through VITE_DATA_PROXY, which holds the keys. The browser never sees a secret.'
              : 'Vite inlines a VITE_ key into the shipped bundle, so anyone who opens the network tab can read it. That is fine for a key you are willing to expose and fatal for one you are not — set VITE_DATA_PROXY to keep it server-side.'}
          </p>
        </div>
      </section>

      {statuses.map(s => (
        <ProviderCard key={s.id} id={s.id} status={s} onCheck={check} />
      ))}

      <p className="px-1 text-[10.5px] leading-relaxed text-textMuted">
        {CAPABILITIES.length} capability groups, generated from each vendor&apos;s own published catalog rather than transcribed — Unusual Whales&apos; endpoint catalog and Polygon&apos;s OpenAPI spec. Anything neither spec stated is absent here rather than guessed.
      </p>
    </div>
  );
};

export default DataSources;
