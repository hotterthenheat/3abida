/*
==================================================
  SLAYER TERMINAL - THE MODES (pages/paper/ModesDoor.tsx)

  Three ways to run the same desk, and the cards
  that set them:

    STANDARD    the desk as it is
    PROP FIRM   an evaluation — futures only, a
                trailing drawdown that liquidates,
                a contract cap, flat by the bell
    FREE REIN   a sandbox — set the balance, trade
                anything, switch the friction off

  NONE OF THIS IS IN THE ENGINE. A mode is an
  INTERCEPTOR: a guard that may only refuse an
  order (propFirm.ts, tilt.ts), an observer that
  only watches (propFirm.ts), a fill model that may
  only narrow how a fill is priced (friction.ts,
  queue.ts). The order path itself never learns
  that modes exist — which is why turning one off
  leaves nothing behind.

  The TILT MANAGER rides here too, because it is
  the same kind of thing: it watches what the
  reader does, flags three patterns, and when they
  come too fast it stops taking orders for a while.
  It never closes anything and it never blocks an
  exit — a reader on tilt can always get out.
==================================================
*/

import { useEffect, useState } from 'react';
import { Gauge, ShieldAlert } from 'lucide-react';
import PopoverCard from '../../components/ui/PopoverCard';
import CardTabs from '../../components/ui/CardTabs';
import { fmtMoney } from '../../core/paper/instruments';
import { readAccount, setBuyingPowerMultiple, setPaperCash, usePaper } from '../../core/paper/engine';
import { MODE_WORDS, updateModes, useModes, type PaperMode } from '../../core/paper/modes';
import { clearLock, readProp, resetEvaluation, usePropState } from '../../core/paper/propFirm';
import { PATTERN_WORDS, clearTilt, endLockout, tiltScore, useTilt } from '../../core/paper/tilt';
import { frictionWords } from '../../core/paper/friction';
import { fmtClock, Toggle } from './paperKit';

const DOOR = 'inline-flex items-center justify-center w-7 h-7 rounded-md border border-borderSubtle bg-chip text-textMuted hover:text-textPrimary hover:border-borderMuted data-[state=open]:border-silver/50 transition-colors';
const ROW = 'flex items-center gap-2 px-3 h-8';
const LABEL = 'font-mono text-[10px] text-textPrimary';
const MODE_INK: Record<PaperMode, string> = { standard: 'text-textSecondary', prop: 'text-warn', free: 'text-silver' };

/** A number the reader types, committed on blur — the desk's own input grammar */
const NumberField = ({ value, onCommit, width = 86, label, prefix, step }: { value: number; onCommit: (n: number) => void; width?: number; label: string; prefix?: string; step?: number }) => {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <span className="ml-auto inline-flex items-center gap-1">
      {prefix && <span className="font-mono text-[10px] text-textMuted">{prefix}</span>}
      <input
        value={text}
        inputMode="decimal"
        step={step}
        onChange={e => setText(e.target.value)}
        onBlur={() => {
          const n = Number(text.replace(/[^0-9.\-]/g, ''));
          if (Number.isFinite(n)) onCommit(n);
          else setText(String(value));
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        aria-label={label}
        style={{ width }}
        className="h-6 px-2 rounded border border-borderSubtle bg-inputBg font-mono text-[10px] tnum text-textPrimary text-right outline-none focus:border-silver/60"
      />
    </span>
  );
};

/** How much of the allowance is gone — green to red as the floor comes up */
const Meter = ({ used, testId }: { used: number; testId?: string }) => (
  <div className="h-1.5 rounded-full bg-ink/[0.08] overflow-hidden" data-meter={testId}>
    <div
      className="h-full rounded-full transition-[width] duration-300"
      style={{ width: `${Math.round(Math.min(1, Math.max(0, used)) * 100)}%`, background: used > 0.75 ? 'rgb(var(--bear))' : used > 0.45 ? 'rgb(var(--warn))' : 'rgb(var(--bull))' }}
    />
  </div>
);

/* ---- the prop firm's card ------------------------------------------------------------------- */

const PropCard = () => {
  const modes = useModes();
  const s = modes.prop;
  usePaper();
  const state = usePropState();
  const read = readProp();
  const [armed, setArmed] = useState(false);
  return (
    <>
      <div className="px-3 py-2 border-b border-borderSubtle/70 flex flex-col gap-1.5" data-prop-meter>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">{read.kind === 'intraday' ? 'Trailing drawdown · intraday' : 'Trailing drawdown · end of day'}</span>
          <span className="ml-auto font-mono text-[11px] tnum font-semibold" style={{ color: read.used > 0.75 ? 'rgb(var(--bear))' : 'rgb(var(--text-primary))' }}>
            {fmtMoney(Math.max(0, read.room), false)} left
          </span>
        </div>
        <Meter used={read.used} testId="drawdown" />
        <div className="flex items-center justify-between font-mono text-[9px] tnum text-textMuted">
          <span title={read.kind === 'intraday' ? 'The highest equity this account has touched' : 'The realised balance at the last 17:00 ET roll'}>
            {read.kind === 'intraday' ? 'Peak' : 'Baseline'} {fmtMoney(read.peak, false)}
          </span>
          <span title="Liquidation happens here">Floor {fmtMoney(read.floor, false)}</span>
        </div>
        {read.dayFloor != null && (
          <div className="flex items-center justify-between font-mono text-[9px] tnum text-textMuted pt-0.5">
            <span>Day limit</span>
            <span className={read.dayRoom != null && read.dayRoom < 0 ? 'text-bear' : 'text-textSecondary'}>{fmtMoney(Math.max(0, read.dayRoom ?? 0), false)} left of {fmtMoney(s.dailyLossLimit, false)}</span>
          </div>
        )}
        {read.target != null && (
          <div className="flex items-center justify-between font-mono text-[9px] tnum text-textMuted">
            <span>Target</span>
            <span className={state.passedAt ? 'text-bull' : 'text-textSecondary'}>{state.passedAt ? `passed ${fmtClock(state.passedAt)}` : `${fmtMoney(read.target, false)} equity`}</span>
          </div>
        )}
      </div>
      {state.locked && (
        <div className="px-3 py-2 border-b border-borderSubtle/70 flex items-center gap-2 bg-bear/[0.06]" data-prop-locked>
          <ShieldAlert className="w-3.5 h-3.5 text-bear shrink-0" />
          <span className="font-mono text-[10px] text-bear leading-tight">{state.locked.reason}</span>
          <button type="button" onClick={clearLock} className="ml-auto h-6 px-2 rounded border border-bear/50 font-mono text-[9px] uppercase tracking-widest text-bear hover:bg-bear/[0.1] whitespace-nowrap">
            Clear
          </button>
        </div>
      )}
      <ul className="py-1">
        <li className={ROW}>
          <span className={LABEL}>Account size</span>
          <NumberField label="Account size" prefix="$" value={s.accountSize} onCommit={n => updateModes({ prop: { accountSize: Math.max(1000, n) } })} />
        </li>
        <li className={ROW}>
          <span className={LABEL}>Drawdown limit</span>
          <NumberField label="Drawdown limit" prefix="$" value={s.drawdownLimit} onCommit={n => updateModes({ prop: { drawdownLimit: Math.max(100, n) } })} />
        </li>
        <li className="flex items-center gap-2 px-3 h-8">
          <span className={LABEL}>It trails</span>
          <span className="ml-auto">
            <CardTabs
              ariaLabel="What the drawdown trails"
              value={s.drawdownKind}
              onChange={v => updateModes({ prop: { drawdownKind: v } })}
              options={[
                { value: 'intraday', label: 'Intraday' },
                { value: 'eod', label: 'End of day' },
              ]}
            />
          </span>
        </li>
        <li className={ROW}>
          <span className={LABEL}>Daily loss limit</span>
          <NumberField label="Daily loss limit" prefix="$" value={s.dailyLossLimit} onCommit={n => updateModes({ prop: { dailyLossLimit: Math.max(0, n) } })} />
        </li>
        <li className={ROW}>
          <span className={LABEL}>Profit target</span>
          <NumberField label="Profit target" prefix="$" value={s.profitTarget} onCommit={n => updateModes({ prop: { profitTarget: Math.max(0, n) } })} />
        </li>
        <li className={ROW}>
          <span className={LABEL}>Contract cap</span>
          <NumberField label="Contract cap" width={60} value={s.maxContracts} onCommit={n => updateModes({ prop: { maxContracts: Math.max(0, Math.round(n)) } })} />
        </li>
        <li className={ROW}>
          <Toggle checked={s.futuresOnly} onChange={v => updateModes({ prop: { futuresOnly: v } })} label="Futures only" />
          <span className={LABEL}>Futures only</span>
          <span className="ml-auto font-mono text-[9px] text-textMuted">options rejected</span>
        </li>
        <li className={ROW}>
          <span className={LABEL}>Flat by</span>
          <span className="ml-auto inline-flex items-center gap-1">
            <input
              value={s.flattenAt}
              onChange={e => updateModes({ prop: { flattenAt: e.target.value } })}
              aria-label="Flatten at"
              className="w-[56px] h-6 px-2 rounded border border-borderSubtle bg-inputBg font-mono text-[10px] tnum text-textPrimary text-right outline-none focus:border-silver/60"
            />
            <span className="font-mono text-[9px] text-textMuted">ET</span>
          </span>
        </li>
      </ul>
      <div className="px-3 py-2 border-t border-borderSubtle/70 flex items-center gap-2">
        <span className="font-mono text-[9px] text-textMuted leading-tight">Restart it on a fresh account of the size above — the blotter goes with it. Switching into this mode without restarting measures the allowance from where the desk stands now.</span>
        <button
          type="button"
          data-prop-reset
          onClick={() => {
            if (!armed) {
              setArmed(true);
              return;
            }
            resetEvaluation();
            setArmed(false);
          }}
          className={`ml-auto h-6 px-2.5 rounded border font-mono text-[9px] uppercase tracking-widest whitespace-nowrap transition-colors ${armed ? 'border-bear text-bear bg-bear/[0.08]' : 'border-borderSubtle text-textSecondary hover:text-textPrimary'}`}
        >
          {armed ? 'Yes, restart' : 'Restart'}
        </button>
      </div>
      {state.log.length > 0 && (
        <ul className="px-3 py-2 border-t border-borderSubtle/70 flex flex-col gap-1" data-prop-log>
          {state.log.slice(0, 4).map(l => (
            <li key={l.at} className="flex items-baseline gap-2 font-mono text-[9px]">
              <span className="text-textMuted tnum">{fmtClock(l.at)}</span>
              <span className="text-textSecondary leading-tight">{l.words}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
};

/* ---- the sandbox's card --------------------------------------------------------------------- */

const FreeCard = () => {
  const modes = useModes();
  const f = modes.free;
  const paper = usePaper();
  const acct = readAccount(paper);
  return (
    <>
      <ul className="py-1">
        <li className={ROW}>
          <span className={LABEL}>Balance</span>
          <NumberField label="Balance" prefix="$" width={110} value={Math.round(acct.cash)} onCommit={setPaperCash} />
        </li>
        <li className={ROW}>
          <span className={LABEL}>Buying power</span>
          <NumberField label="Buying power multiple" width={60} value={paper.account.bpMultiple ?? 1} step={0.5} onCommit={setBuyingPowerMultiple} />
          <span className="font-mono text-[10px] text-textMuted">×</span>
        </li>
        <li className="px-3 pb-2 pt-0.5">
          <span className="font-mono text-[9px] text-textMuted leading-tight">
            Setting the balance is not a profit — the P&amp;L keeps its own count from where it was. Buying power is that many times the equity the margin check sees; every fill still comes off the book.
          </span>
        </li>
      </ul>
      <div className="px-3 pt-2 pb-1 border-t border-borderSubtle/70 font-mono text-[9px] uppercase tracking-widest text-textMuted">Friction</div>
      <ul className="pb-1">
        <li className={ROW}>
          <Toggle checked={f.bypassSpread} onChange={v => updateModes({ free: { bypassSpread: v } })} label="Bypass the spread" />
          <span className={LABEL}>Fill at the mid</span>
          <span className="ml-auto font-mono text-[9px] text-textMuted">no spread to cross</span>
        </li>
        <li className={ROW}>
          <Toggle checked={f.bypassSlippage} onChange={v => updateModes({ free: { bypassSlippage: v } })} label="Bypass slippage" />
          <span className={LABEL}>No walk past the touch</span>
          <span className="ml-auto font-mono text-[9px] text-textMuted">one price for the lot</span>
        </li>
        <li className={ROW}>
          <Toggle checked={f.zeroFees} onChange={v => updateModes({ free: { zeroFees: v } })} label="Zero fees" />
          <span className={LABEL}>No commissions</span>
        </li>
      </ul>
      <div className="px-3 py-2 border-t border-borderSubtle/70 font-mono text-[9px] text-textMuted leading-tight">
        Everything routes here — futures, options and spreads at once. A number filled with the friction off is not what the market would have given you; the desk marks those fills the same, so read them knowing it.
      </div>
    </>
  );
};

/* ---- the card the door opens ---------------------------------------------------------------- */

const ModesCard = () => {
  const modes = useModes();
  const words = frictionWords();
  return (
    <>
      <div className="px-3 py-2 border-b border-borderSubtle/70">
        <CardTabs
          ariaLabel="How the desk runs"
          value={modes.mode}
          onChange={v => updateModes({ mode: v })}
          options={[
            { value: 'standard', label: 'Standard' },
            { value: 'prop', label: 'Prop firm' },
            { value: 'free', label: 'Free rein' },
          ]}
        />
        <p className="mt-1.5 font-mono text-[9px] text-textMuted leading-tight">{MODE_WORDS[modes.mode].blurb}</p>
      </div>
      {modes.mode === 'prop' && <PropCard />}
      {modes.mode === 'free' && <FreeCard />}
      {modes.mode === 'standard' && (
        <div className="px-3 py-2.5 font-mono text-[9px] text-textMuted leading-relaxed">
          A real spread to cross, a walk past the touch when the size is bigger than what is shown, and the contract's own fee on every side. Nothing here is loosened and nothing is watching you.
        </div>
      )}
      <div className={`${ROW} border-t border-borderSubtle/70`}>
        <Toggle checked={modes.realisticFills} onChange={v => updateModes({ realisticFills: v })} label="Realistic fills" />
        <span className={LABEL}>Realistic fills</span>
        <span className="ml-auto font-mono text-[9px] text-textMuted">a limit waits its turn</span>
      </div>
      <div className="px-3 pb-2 font-mono text-[9px] text-textMuted leading-tight">
        With it on, a resting limit takes a place behind the size already shown at its price and fills only as the tape trades through that queue — the reason a limit at the touch does not always fill.
      </div>
      {words.length > 0 && (
        <div className="px-3 py-1.5 border-t border-borderSubtle/70 flex flex-wrap gap-1" data-friction-words>
          {words.map(w => (
            <span key={w} className="font-mono text-[8px] uppercase tracking-widest text-warn border border-warn/40 rounded px-1 py-[1px]">
              {w}
            </span>
          ))}
        </div>
      )}
    </>
  );
};

export const ModesDoor = () => {
  const modes = useModes();
  usePaper();
  const prop = usePropState();
  const read = modes.mode === 'prop' ? readProp() : null;
  const hot = modes.mode === 'prop' && (prop.locked != null || (read != null && read.used > 0.75));
  return (
    <PopoverCard
      title="How the desk runs"
      meta={MODE_WORDS[modes.mode].label}
      width={352}
      testId="paper-modes"
      trigger={
        <button
          type="button"
          title={`${MODE_WORDS[modes.mode].label} — ${MODE_WORDS[modes.mode].blurb}`}
          aria-label="How the desk runs"
          className={`${DOOR} ${modes.mode !== 'standard' ? 'border-silver/40' : ''} ${hot ? 'text-bear border-bear/60' : MODE_INK[modes.mode]}`}
          data-paper-modes
          data-mode={modes.mode}
        >
          <Gauge className="w-3.5 h-3.5" />
        </button>
      }
    >
      <ModesCard />
    </PopoverCard>
  );
};

/* ---- the tilt manager's door ---------------------------------------------------------------- */

export const TiltDoor = () => {
  const modes = useModes();
  const t = modes.tilt;
  const tilt = useTilt();
  const [, wake] = useState(0);
  const locked = tilt.lockedUntil != null && tilt.lockedUntil > Date.now();
  /* the countdown has to tick, and only while it is running */
  useEffect(() => {
    if (!locked) return;
    const id = window.setInterval(() => wake(n => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [locked]);
  const score = tiltScore();
  const left = locked ? Math.max(0, Math.ceil(((tilt.lockedUntil ?? 0) - Date.now()) / 1000)) : 0;
  return (
    <PopoverCard
      title="Tilt"
      meta={t.on ? (locked ? 'locked' : `${score}/${t.threshold}`) : 'off'}
      width={330}
      testId="paper-tilt"
      trigger={
        <button
          type="button"
          title={locked ? `Locked out — ${Math.ceil(left / 60)} min left` : t.on ? `Tilt watch on — ${score} flag${score === 1 ? '' : 's'} in the last ${t.windowMin} minutes` : 'Tilt watch off'}
          aria-label="Tilt manager"
          className={`${DOOR} ${locked ? 'text-bear border-bear/60' : score > 0 ? 'text-warn border-warn/50' : ''}`}
          data-paper-tilt
          data-tilt-locked={locked ? '1' : '0'}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
        </button>
      }
    >
      <div className="px-3 py-2 border-b border-borderSubtle/70 flex items-center gap-2">
        <Toggle checked={t.on} onChange={v => updateModes({ tilt: { on: v } })} label="Watch for tilt" />
        <span className={LABEL}>Watch what I do</span>
        <span className="ml-auto font-mono text-[10px] tnum" style={{ color: score >= t.threshold ? 'rgb(var(--bear))' : score > 0 ? 'rgb(var(--warn))' : 'rgb(var(--text-muted))' }} data-tilt-score>
          {score} / {t.threshold}
        </span>
      </div>
      {locked && (
        <div className="px-3 py-2 border-b border-borderSubtle/70 bg-bear/[0.06] flex items-center gap-2">
          <span className="font-mono text-[10px] text-bear leading-tight">
            {tilt.lockReason ?? 'The desk is closed'} · {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')} left
          </span>
          <button type="button" onClick={endLockout} data-tilt-end className="ml-auto h-6 px-2 rounded border border-bear/50 font-mono text-[9px] uppercase tracking-widest text-bear hover:bg-bear/[0.1] whitespace-nowrap">
            End it
          </button>
        </div>
      )}
      <ul className="py-1">
        <li className={ROW}>
          <span className={LABEL}>Flags that lock</span>
          <NumberField label="Flags that lock" width={54} value={t.threshold} onCommit={n => updateModes({ tilt: { threshold: Math.max(1, Math.round(n)) } })} />
        </li>
        <li className={ROW}>
          <span className={LABEL}>Counted over</span>
          <NumberField label="Window minutes" width={54} value={t.windowMin} onCommit={n => updateModes({ tilt: { windowMin: Math.max(1, Math.round(n)) } })} />
          <span className="font-mono text-[10px] text-textMuted">min</span>
        </li>
        <li className={ROW}>
          <span className={LABEL}>Locked out for</span>
          <NumberField label="Lockout minutes" width={54} value={t.lockoutMin} onCommit={n => updateModes({ tilt: { lockoutMin: Math.max(1, Math.round(n)) } })} />
          <span className="font-mono text-[10px] text-textMuted">min</span>
        </li>
      </ul>
      <div className="px-3 pb-2 font-mono text-[9px] text-textMuted leading-tight">
        Three patterns are flagged: a stop dragged further away while the trade is under, a re-entry the same way within {t.revengeSeconds}s at more than {t.revengeSizeX}× the size that was stopped out, and a size spiral after a loss. An exit is never refused — you can always get out.
      </div>
      <div className="px-3 py-1.5 border-t border-borderSubtle/70 flex items-center gap-2">
        <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">What was flagged</span>
        {tilt.flags.length > 0 && (
          <button type="button" onClick={clearTilt} className="ml-auto font-mono text-[9px] uppercase tracking-widest text-textMuted hover:text-textPrimary">
            Clear
          </button>
        )}
      </div>
      {tilt.flags.length === 0 ? (
        <div className="px-3 pb-2.5 font-mono text-[10px] text-textSecondary">Nothing yet.</div>
      ) : (
        <ul className="pb-2" data-tilt-flags>
          {tilt.flags.slice(0, 6).map(f => (
            <li key={`${f.at}-${f.pattern}`} className="flex items-baseline gap-2 px-3 py-0.5">
              <span className="font-mono text-[9px] tnum text-textMuted">{fmtClock(f.at)}</span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-warn whitespace-nowrap">{PATTERN_WORDS[f.pattern]}</span>
              <span className="font-mono text-[9px] text-textSecondary leading-tight min-w-0">{f.words}</span>
            </li>
          ))}
        </ul>
      )}
    </PopoverCard>
  );
};

export default ModesDoor;
