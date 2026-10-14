/*
==================================================
  SLAYER TERMINAL - A SESSION'S RECAP IN THE JOURNAL
  (components/review/SessionRecap.tsx)

  The owner's item 9: what the session did against what
  the terminal drew, posted at 4:05 pm New York (the
  watcher: components/review/RecapWatcher.tsx; the figures:
  data/feed/sessionRecap.ts) — opened with the day it
  belongs to, one tab a name:
    the picture   the house's chart of the session, its
                  field, ±σ and regime strip
    the close     against ±1σ and ±2σ priced at the prior
                  close, the farthest it went, and from
                  10:00 am
    the flip      each crossing
    the walls     each move that held
    the levels    the track record's own rows for the day —
                  a touch and what followed at +15 and +30,
                  the strike-matched levels the same day
                  beside; never a rate
    the alerts    what fired, and what followed
    the regime    the net each half hour against the same
                  half hour before, and where its sign turned
  Reads, never instructions: what the price did at a level,
  nothing about what to do.
==================================================
*/

import { useState } from 'react';
import CardTabs from '../ui/CardTabs';
import { headWord } from './DeskShell';
import { DASH, isoDayLabel, num, numSigned, usd, usdCompactSigned } from '../../core/format';
import { clock, nyWallTime, viewerDay } from '../../core/nyTime';
import { dirOf } from '../../theme/theme';
import { ordinal } from '../../data/feed/trailModel';
import { LEVEL_KINDS, type LevelKind } from '../../data/feed/trackRecord';
import { useDayRecaps, useRecapPicture, type PostedRecap, type RecapAlert } from '../../data/review/recaps';

const KIND_WORDS: Record<LevelKind, string> = { 'call wall': 'Call wall', 'put wall': 'Put wall', flip: 'Flip', 'top strike': 'Heaviest strikes' };
const STRADDLE_FROM: Record<string, string> = {
  'live-read': "the recorder's last read before 4:00 pm",
  'trades-4pm': "the two legs' 3:59 pm trades",
  'closing-quotes': "the dated chain's closing quotes",
};
const sigmaWords = (z: number) => {
  const shown = Math.abs(z).toFixed(1);
  return `${Number(shown) === 0 ? '' : z > 0 ? '+' : '−'}${shown}σ`;
};
const yes = (b: boolean) => (b ? 'yes' : 'no');
const block = 'flex flex-col gap-1.5 min-w-0';
const line = 'font-mono text-[11px] leading-relaxed text-textSecondary tnum';
const SHOW = 8;

const Picture = ({ r }: { r: PostedRecap }) => {
  const url = useRecapPicture(r.key, r.chartKey);
  if (!r.picture)
    return <div className="rounded-md border border-dashed border-borderSubtle px-4 py-10 text-center font-mono text-[11px] text-textMuted">No picture: the chart could not be drawn on this machine. The figures stand without it.</div>;
  if (!url) return <div className="rounded-md border border-borderSubtle bg-ink/[0.02]" style={{ aspectRatio: `${r.picture.w} / ${r.picture.h}` }} aria-hidden="true" />;
  return (
    <img
      src={url}
      alt={`${r.name} on ${r.day}: five-minute candles, the strike field through the session, ±1σ and ±2σ from the prior close, and the regime strip`}
      className="w-full h-auto rounded-md border border-borderSubtle"
      style={{ aspectRatio: `${r.picture.w} / ${r.picture.h}` }}
      data-recap-picture={r.key}
    />
  );
};

const Outcome = ({ o }: { o: RecapAlert['out'][number] }) => {
  if (!o) return <span className="text-textMuted">past the session</span>;
  if (o.held == null) return <span>{Number.isFinite(o.points) ? `${numSigned(o.points, 2)} since` : usd(o.close)}</span>;
  return (
    <span>
      {o.held ? 'held' : 'through'} <span className="text-textMuted">{numSigned(o.points, 2)}</span>
    </span>
  );
};

const RecapBody = ({ r }: { r: PostedRecap }) => {
  const x = r.recap;
  const mv = x.move;
  const [y, m, d] = x.day.split('-').map(Number);
  const halfHour = (b: number) => clock(nyWallTime(y, m, d, 9, 30 + 30 * b));
  const kinds = LEVEL_KINDS.filter(k => x.touches.some(t => t.kind === k) || x.baseline[k].n > 0);
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]" data-recap={r.key} data-recap-version={r.version}>
      <div className="flex flex-col gap-3 min-w-0">
        <Picture r={r} />
        {/* THE REGIME PATH — the net each half hour (estimated dealer gamma, assumed sign) against the same half hour over
            the sessions before; its sign is not the flip's side */}
        <div className={block} data-recap-regime>
          <span className={headWord}>The regime, each half hour</span>
          {x.regime.steps.length ? (
            <div className="flex flex-wrap gap-1">
              {x.regime.steps.map(s => (
                <span key={s.b} className="min-w-[78px] flex-1 rounded border border-borderSubtle px-1.5 py-1 font-mono text-[11px] tnum leading-tight" title={`The net at ${clock(s.m)}: ${usdCompactSigned(s.net)}${s.pct != null ? `, the ${ordinal(s.pct)} percentile of the same half hour before` : ''}`}>
                  <span className="block text-textMuted">{halfHour(s.b)}</span>
                  <span className="block text-textPrimary">{usdCompactSigned(s.net)}</span>
                  <span className="block text-textSecondary">{s.pct != null ? `${ordinal(s.pct)} pct` : DASH}</span>
                </span>
              ))}
            </div>
          ) : (
            <span className={line}>{DASH} no columns for the session</span>
          )}
          {x.regime.steps.length > 0 && (
            <span className={line}>
              {x.regime.turns.length ? `The net's sign turned ${x.regime.turns.length} time${x.regime.turns.length === 1 ? '' : 's'}: ${x.regime.turns.slice(0, SHOW).map(t => `${t.to} at ${clock(t.m)}`).join(', ')}${x.regime.turns.length > SHOW ? `, and ${x.regime.turns.length - SHOW} more` : ''}.` : "The net's sign never turned."}{' '}
              Estimated dealer gamma on an assumed sign — not the flip's side.
              {x.regime.steps.some(st => st.pct != null)
                ? ` Percentiles against the same half hour over ${x.regime.sessions != null ? `the ${x.regime.sessions} session${x.regime.sessions === 1 ? '' : 's'}` : 'the sessions'} ${x.regime.through ? `through ${isoDayLabel(x.regime.through)}` : `before ${isoDayLabel(x.day)}`}.`
                : ' No reference for the percentiles yet.'}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 min-w-0">
        {/* THE CLOSE AGAINST THE PRICED MOVE — the priced move's own row for the day */}
        <div className={block} data-recap-move>
          <span className={headWord}>The close against the priced move</span>
          {mv ? (
            <>
              <span className="font-mono text-[13px] tnum text-textPrimary">
                Close {usd(mv.close)}{' '}
                <span data-dir={dirOf(mv.verdict.sigmas)} className="font-semibold">
                  {sigmaWords(mv.verdict.sigmas)}
                </span>{' '}
                <span className="text-textSecondary">from the prior close {usd(mv.prevClose)}</span>
              </span>
              <span className={line}>
                1σ ±{usd(mv.sigma)}, priced at the prior close off {STRADDLE_FROM[mv.from ?? ''] ?? 'the 4:00 pm straddle'} · inside ±1σ {yes(mv.verdict.inside[0])} · inside ±2σ {yes(mv.verdict.inside[1])}
              </span>
              <span className={line}>
                Touched ±1σ {yes(mv.verdict.touched[0])} · ±2σ {yes(mv.verdict.touched[1])} · farthest {sigmaWords(mv.verdict.max)}
                {mv.farthestAt != null ? ` at ${clock(mv.farthestAt)}` : ''} ({usd(mv.verdict.max >= 0 ? mv.high : mv.low)})
              </span>
              {mv.verdict.at10 && mv.at10 && (
                <span className={line}>
                  From 10:00 am ({usd(mv.at10.spot)}, ±{usd(mv.at10.sigma)} left to the close): the close {sigmaWords(mv.verdict.at10.sigmas)} · inside ±1σ {yes(mv.verdict.at10.inside[0])}
                </span>
              )}
              <span className="font-mono text-[11px] text-textMuted">{mv.closeFrom === 'official' ? 'The official close.' : "The 3:59 pm minute's close — the official close was not in yet; the recap is posted again when it is."}</span>
            </>
          ) : (
            <span className={line}>{x.moveWhy ?? DASH}</span>
          )}
        </div>

        {/* THE FLIP — each minute's close against the column's flip that minute */}
        <div className={block} data-recap-flips={x.flips.length}>
          <span className={headWord}>Flip crossings · {x.flips.length}</span>
          <span className={line}>
            {x.flips.length
              ? `${x.flips
                  .slice(0, SHOW)
                  .map(f => `${clock(f.m)} ${f.dir} through ${num(f.flip, 2)}`)
                  .join(' · ')}${x.flips.length > SHOW ? ` · and ${x.flips.length - SHOW} more` : ''}`
              : x.source
                ? 'The close stayed on one side of the flip all session.'
                : DASH}
          </span>
        </div>

        {/* THE WALLS — a new strike that held three minutes (the field's chips) */}
        <div className={block} data-recap-walls={x.walls.length}>
          <span className={headWord}>Wall moves · {x.walls.length}</span>
          <span className={line}>
            {x.walls.length
              ? `${x.walls
                  .slice(0, SHOW)
                  .map(w => `${w.kind === 'call' ? 'Call' : 'Put'} wall ${num(w.from, w.from % 1 ? 2 : 0)} → ${num(w.to, w.to % 1 ? 2 : 0)} at ${clock(w.m)} (${w.strikes} strike${w.strikes === 1 ? '' : 's'})`)
                  .join(' · ')}${x.walls.length > SHOW ? ` · and ${x.walls.length - SHOW} more` : ''}`
              : x.source
                ? 'Neither wall moved and held.'
                : DASH}
          </span>
        </div>

        {/* THE LEVELS TOUCHED — the track record's rows for the day */}
        <div className={block} data-recap-touches={x.touches.length}>
          <span className={headWord}>Levels touched · {x.touches.length}</span>
          {kinds.length ? (
            kinds.map(k => {
              const ts = x.touches.filter(t => t.kind === k);
              const at = (h: number): [number, number] => [ts.filter(t => t.bounce[h] === true).length, ts.filter(t => t.bounce[h] != null).length];
              const [b15, n15] = at(15);
              const [b30, n30] = at(30);
              const after = (b: number, n: number) => (n ? `${b} of ${n}` : 'past the session');
              const base = x.baseline[k];
              return (
                <span key={k} className={line} data-recap-kind={k}>
                  <span className="text-textPrimary">{KIND_WORDS[k]}</span> · touched {ts.length} · back on its side 15 min on: {after(b15, n15)} · 30 min on: {after(b30, n30)}
                  <span className="text-textMuted">
                    {' '}
                    · strike-matched the same session: {base.n ? `touched ${base.n}, back 15 min on ${base.back[15]?.[0] ?? 0} of ${base.back[15]?.[1] ?? 0}` : 'none touched'}
                  </span>
                </span>
              );
            })
          ) : (
            <span className={line}>{x.source ? 'No level stood a minute and was touched.' : x.why ?? DASH}</span>
          )}
          {x.touches.length > 0 && <span className="font-mono text-[11px] text-textMuted">One session is not a record: How sure's track record weighs these against strike-matched levels over every session.</span>}
        </div>

        {/* THE ALERTS that fired in the session */}
        <div className={block} data-recap-alerts={r.alerts.length}>
          <span className={headWord}>Alerts · {r.alerts.length}</span>
          {r.alerts.length ? (
            r.alerts.slice(0, SHOW * 2).map(a => (
              <span key={a.key} className={line} data-recap-alert={a.kind}>
                <span className="text-textMuted">{clock(a.at)}</span> · {a.tier ? `Tier ${a.tier}${a.stale ? ', stale' : a.capped ? ', capped' : ''}` : 'Alert'} · <span className="text-textPrimary">{a.words}</span>
                {a.spot != null && <span className="text-textMuted"> at {usd(a.spot)}</span>} · +15: <Outcome o={a.out[0]} /> · +30: <Outcome o={a.out[1]} />
              </span>
            ))
          ) : (
            <span className={line}>None fired in the session on this machine.</span>
          )}
          {r.alerts.length > SHOW * 2 && <span className="font-mono text-[11px] text-textMuted">and {r.alerts.length - SHOW * 2} more</span>}
        </div>

        <span className="font-mono text-[11px] text-textMuted leading-relaxed" data-recap-source={x.source ?? 'none'}>
          {x.source === 'final' ? `From the store's final rows: ${x.rows} minutes the recorder wrote as the session ran.` : x.source === 'rebuilt' ? `From the session rebuilt from the vendor's dated history: ${x.rows} minutes.` : x.why}
          {` Touches counted under ${x.config}. Posted ${viewerDay(r.postedAt)}, ${clock(r.postedAt)}${r.updatedAt !== r.postedAt ? `; its figures changed ${viewerDay(r.updatedAt)}, ${clock(r.updatedAt)}` : ''}.`}
        </span>
      </div>
    </div>
  );
};

/** THE DAY'S RECAPS — one tab a name; nothing when the day has none */
const SessionRecaps = ({ day }: { day: string }) => {
  const recaps = useDayRecaps(day);
  const [name, setName] = useState<string | null>(null);
  if (!recaps.length) return null;
  const shown = recaps.find(r => r.name === name) ?? recaps[0];
  return (
    <div className="border-t border-borderSubtle/70 px-5 pt-4 pb-5 flex flex-col gap-3 min-w-0" data-journal-day-recap={day}>
      <div className="flex items-center gap-4 flex-wrap">
        <span className={headWord}>The session</span>
        {recaps.length > 1 ? <CardTabs options={recaps.map(r => ({ value: r.name, label: r.name }))} value={shown.name} onChange={setName} ariaLabel="Whose session" /> : <span className="font-mono text-[11px] text-textSecondary">{shown.name}</span>}
        <span className="font-mono text-[11px] text-textMuted">posted after the close — what the session did against what the terminal drew</span>
      </div>
      <RecapBody r={shown} />
    </div>
  );
};

export default SessionRecaps;
