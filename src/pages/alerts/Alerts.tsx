import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellOff, RotateCcw, Trash2, X } from 'lucide-react';
import { NAV_INK } from '../../components/layout/nav';
import { Fact } from '../../components/trace/TraceBox';
import CompanyLogo from '../../components/ui/CompanyLogo';
import FilterTabs from '../../components/ui/FilterTabs';
import {
  clearAlerts, clearFiredLog, firedWords, markSeenAll, rearmFromRecord, removeAlert,
  useAllAlerts, waitingWords, type Alert, type FiredRecord,
} from '../../components/gex/alertStore';
import { spotOf } from '../../core/paper/market';

/*
==================================================
  SLAYER TERMINAL - THE ALERTS DESK
  (pages/alerts/Alerts.tsx)

  Everything set, everything that has gone off, and
  the record of both.
==================================================

  THE DRAWER IS FOR GLANCING; THIS IS FOR MANAGING. The bell opens a rail
  over whatever page you are on, which is right for "did anything fire" and
  wrong for "I have alerts on fourteen names and three of them are stale".
  A rail cannot hold a table, cannot sort, and closes the moment you look
  away from it.

  THREE SHELVES, AND THE ORDER IS THE QUESTION A READER ASKS:

    SET        what is still waiting, grouped by name — the thing you
               manage. Every row says what it is watching in words, not in
               a rule.
    ALERTED    what went off this session, newest first, each with the door
               back to the name and a way to set it again.
    EVERYTHING both, by name, so a reader deciding whether a name is
               over-watched can see the whole weight of it at once.

  NOTHING IS SENT ANYWHERE and the page says so where a reader will look
  rather than in a settings screen they will not. An alert desk that implies
  push notifications it does not have is worse than no alert desk.
*/

type Shelf = 'set' | 'alerted' | 'all';

const SHELVES = [
  { value: 'set' as const, label: 'Set' },
  { value: 'alerted' as const, label: 'Alerted' },
  { value: 'all' as const, label: 'Everything' },
];

const fmtWhen = (at: number): string => {
  const d = new Date(at);
  const mins = Math.round((Date.now() - at) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const Row = ({ children, onEnd, endLabel, endIcon: EndIcon }: {
  children: React.ReactNode; onEnd: () => void; endLabel: string; endIcon: typeof X;
}) => (
  <div className="group flex items-center gap-2.5 px-3 py-2 border-b border-borderSubtle/50 last:border-0 hover:bg-ink/[0.02] transition-colors">
    <div className="min-w-0 flex-1">{children}</div>
    <button
      type="button"
      onClick={onEnd}
      aria-label={endLabel}
      title={endLabel}
      className="shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 w-6 h-6 inline-flex items-center justify-center rounded text-textMuted hover:text-textPrimary transition-all"
    >
      <EndIcon className="w-3 h-3" />
    </button>
  </div>
);

const NameHead = ({ ticker, count, onClear }: { ticker: string; count: number; onClear: () => void }) => (
  <div className="flex items-center gap-2 px-3 py-1.5 bg-inset border-b border-borderSubtle">
    <CompanyLogo ticker={ticker} size={14} />
    <Link to="/weigher" className="text-[12px] font-semibold text-textPrimary hover:underline">{ticker}</Link>
    <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">{count} set</span>
    <button
      type="button"
      onClick={onClear}
      className="ml-auto font-mono text-[9px] uppercase tracking-widest text-textMuted hover:text-bear transition-colors"
      data-alerts-clear={ticker}
    >
      Clear
    </button>
  </div>
);

const Alerts = () => {
  const names = useAllAlerts();
  const [shelf, setShelf] = useState<Shelf>('set');

  const waiting = useMemo(
    () => names.map(n => ({ ticker: n.ticker, alerts: n.alerts.filter(a => a.firedAt === 0) })).filter(n => n.alerts.length > 0),
    [names]
  );
  const fired = useMemo(
    () =>
      names
        .flatMap(n => n.fired.map(f => ({ ...f, ticker: n.ticker })))
        .sort((a, b) => b.at - a.at),
    [names]
  );

  /* Re-arming needs the name's spot, because a price alert's crossing side
     is fixed at arming — the store cannot know which way the reader meant
     without it, and guessing would arm something that never fires. A name
     the feed has not seeded is refused rather than armed blind. */
  const reArm = (ticker: string, key: string): void => {
    const spot = spotOf(ticker);
    if (spot == null) return;
    rearmFromRecord(ticker, key, spot, Date.now());
  };

  const setCount = waiting.reduce((a, n) => a + n.alerts.length, 0);
  const unseen = names.reduce((a, n) => a + n.unseen, 0);

  const empty =
    (shelf === 'set' && setCount === 0) ||
    (shelf === 'alerted' && fired.length === 0) ||
    (shelf === 'all' && setCount === 0 && fired.length === 0);

  return (
    <div className="flex flex-col gap-3" data-alerts-page>
      <header className="flex items-start gap-6 flex-wrap pb-3 border-b border-borderSubtle" data-shell>
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-2.5" data-shell-page>
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-borderSubtle text-textSecondary shrink-0" aria-hidden="true" style={{ '--ink': NAV_INK.alerts } as CSSProperties}>
              <Bell className="w-3.5 h-3.5" />
            </span>
            <h1 className="text-[15px] font-semibold leading-tight text-textPrimary">Alerts</h1>
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">
            Everything you set, everything that has gone off, and the record of both — the bell is for glancing, this is for managing.
          </p>
        </div>
        <dl className="flex flex-wrap items-start gap-x-6 gap-y-1" data-shell-facts>
          <Fact label="Set" testId="al-set">{setCount}</Fact>
          <Fact label="Names" testId="al-names">{waiting.length}</Fact>
          <Fact label="Alerted" testId="al-fired">{fired.length}</Fact>
          <Fact label="Unseen" testId="al-unseen">
            <span className={unseen > 0 ? 'text-warn' : undefined}>{unseen}</span>
          </Fact>
        </dl>
      </header>

      <div className="flex items-center gap-2 flex-wrap">
        <FilterTabs ariaLabel="Which shelf" options={SHELVES} value={shelf} onChange={setShelf} />
        {unseen > 0 && (
          <button type="button" onClick={markSeenAll} className="h-7 px-2.5 rounded-md border border-borderSubtle text-[11px] text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors" data-alerts-seen>
            Mark all seen
          </button>
        )}
        {fired.length > 0 && (shelf === 'alerted' || shelf === 'all') && (
          <button type="button" onClick={() => names.forEach(n => clearFiredLog(n.ticker))} className="h-7 px-2.5 rounded-md border border-borderSubtle text-[11px] text-textSecondary hover:text-bear hover:border-borderMuted transition-colors" data-alerts-clear-log>
            Clear the log
          </button>
        )}
        <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-textMuted">
          Runs while this tab is open · nothing is sent anywhere
        </span>
      </div>

      {empty ? (
        <div className="border border-borderSubtle rounded-md px-3 py-12 flex flex-col items-center gap-2" data-alerts-empty>
          <BellOff className="w-6 h-6 text-textMuted" aria-hidden="true" />
          <p className="text-[12px] text-textPrimary">
            {shelf === 'alerted' ? 'Nothing has alerted yet' : 'Nothing is set'}
          </p>
          <p className="text-[11px] text-textMuted text-center max-w-sm">
            {shelf === 'alerted'
              ? 'Alerts that go off while this tab is open land here, newest first.'
              : 'Set one from the bell in the sidebar, or from the surface that shows the thing — a price off the chart, a wall off the levels.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {(shelf === 'set' || shelf === 'all') && waiting.map(n => (
            <div key={n.ticker} className="border border-borderSubtle rounded-md overflow-hidden" data-alerts-name={n.ticker}>
              <NameHead ticker={n.ticker} count={n.alerts.length} onClear={() => clearAlerts(n.ticker)} />
              {n.alerts.map((a: Alert) => (
                <Row key={a.id} onEnd={() => removeAlert(n.ticker, a.id)} endLabel="Take this alert off" endIcon={X}>
                  <div className="text-[12px] text-textPrimary">{waitingWords(a)}</div>
                  {a.setAt != null && (
                    <div className="font-mono text-[10px] text-textMuted">set {fmtWhen(a.setAt)}</div>
                  )}
                </Row>
              ))}
            </div>
          ))}

          {(shelf === 'alerted' || shelf === 'all') && fired.length > 0 && (
            <div className="border border-borderSubtle rounded-md overflow-hidden" data-alerts-log>
              <div className="px-3 py-1.5 bg-inset border-b border-borderSubtle">
                <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">Alerted this session</span>
              </div>
              {fired.map((f: FiredRecord & { ticker: string }) => (
                <Row key={f.key} onEnd={() => reArm(f.ticker, f.key)} endLabel="Set it again" endIcon={RotateCcw}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <CompanyLogo ticker={f.ticker} size={13} />
                    <span className="text-[12px] text-textPrimary truncate">{firedWords(f.alert, f.ticker)}</span>
                  </div>
                  <div className="font-mono text-[10px] text-warn">{fmtWhen(f.at)}</div>
                </Row>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Alerts;
