import { useMemo, useState } from 'react';
import { HEDGING_ASSUMPTION, buildSpotScenario, flowWords } from '../../data/spotScenario';
import { fmtUsd } from '../../data/gex';
import { FLIP, LONG_GAMMA, SHORT_GAMMA, SPOT } from './paletteInk';
import Term from '../ui/Term';
import type { MarketSnapshot } from '../../types/market';

/*
==================================================
  SLAYER TERMINAL - SPOT SCENARIO — P-17 / P-18
  (components/gex/SpotScenarioPanel.tsx)
==================================================

  "If we get to 5,880, what does the book look like?" — the scenario
  traders run in their heads all day and no product answers.

  A RULER, NOT A NUMBER FIELD. The question is spatial — "up there", "down
  by the put wall" — and a slider is how it gets asked. The live spot stays
  printed beside the hypothetical so the two are always read against each
  other, and Reset returns to it rather than stranding a reader inside a
  scenario they cannot find their way out of.

  THE RANGE IS THE BOOK'S OWN. A spot outside the listed strikes is
  answerable but useless — every level goes null out there because there is
  no book — so the ruler spans the chain and stops.

  P-18'S SENTENCE IS THE POINT. GEX is an abstraction; "$1.4B of dealer
  buying" is not, and it is the number that makes the wall feel real. Its
  assumption sits directly underneath, because a figure this legible is
  exactly the one a reader will over-trust.
*/

const SpotScenarioPanel = ({ snapshot }: { snapshot: MarketSnapshot }) => {
  const bounds = useMemo(() => {
    const strikes = snapshot.chain.map(n => n.strike);
    return strikes.length > 0 ? { lo: Math.min(...strikes), hi: Math.max(...strikes) } : null;
  }, [snapshot.chain]);

  const [at, setAt] = useState<number | null>(null);
  const target = at ?? snapshot.spot;
  const scenario = useMemo(
    () => buildSpotScenario(snapshot.chain, snapshot.spot, target),
    [snapshot.chain, snapshot.spot, target]
  );

  if (!bounds || !scenario) {
    return <div className="font-mono text-[11px] uppercase tracking-widest text-textMuted">Awaiting the book…</div>;
  }

  const step = snapshot.chain.length > 1 ? Math.abs(snapshot.chain[1].strike - snapshot.chain[0].strike) : 1;
  const moved = Math.abs(target - snapshot.spot) > 1e-9;
  const pct = ((target - snapshot.spot) / snapshot.spot) * 100;

  const facts: { k: 'Call wall' | 'Put wall' | 'Gamma flip' | 'Supreme'; v: number | null }[] = [
    { k: 'Call wall', v: scenario.callWall },
    { k: 'Put wall', v: scenario.putWall },
    { k: 'Gamma flip', v: scenario.flip },
    { k: 'Supreme', v: scenario.supreme },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-mono text-[10px] uppercase tracking-widest text-textMuted">
          <Term k="Spot scenario">If we get to</Term>
        </span>
        <span className="font-mono text-[15px] font-bold tnum" style={{ color: moved ? FLIP : SPOT }}>
          {target.toFixed(2)}
        </span>
        {moved && (
          <span className="font-mono text-[10px] tnum text-textSecondary">
            {pct >= 0 ? '+' : ''}
            {pct.toFixed(2)}% from {snapshot.spot.toFixed(2)}
          </span>
        )}
        {moved && (
          <button
            onClick={() => setAt(null)}
            className="ml-auto font-mono text-[9px] uppercase tracking-wider text-textMuted hover:text-textPrimary transition-colors"
          >
            Reset to spot
          </button>
        )}
      </div>

      <input
        type="range"
        min={bounds.lo}
        max={bounds.hi}
        step={step}
        value={target}
        onChange={e => setAt(Number(e.target.value))}
        aria-label={`Hypothetical spot — currently ${target.toFixed(2)}, live spot ${snapshot.spot.toFixed(2)}`}
        className="w-full accent-white"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1">
        {facts.map(f => (
          <div key={f.k} className="flex flex-col">
            <span className="font-mono text-[9px] uppercase tracking-wider text-textMuted">
              <Term k={f.k} />
            </span>
            <span className="font-mono text-[12px] font-semibold tnum text-textPrimary">
              {f.v === null ? '—' : f.v.toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-baseline gap-2 flex-wrap border-t border-borderSubtle/60 pt-2">
        <span
          className="font-mono text-[11px] font-semibold"
          style={{ color: scenario.regime === 'SHORT' ? SHORT_GAMMA : LONG_GAMMA }}
        >
          {scenario.regime} GAMMA there
        </span>
        <span className="font-mono text-[11px] tnum text-textPrimary">
          <Term k="Expected hedging flow">{flowWords(scenario)}</Term>
        </span>
        {moved && <span className="font-mono text-[10px] tnum text-textMuted">({fmtUsd(scenario.hedgingFlow)})</span>}
      </div>

      <p className="font-mono text-[9px] leading-relaxed text-textMuted">{HEDGING_ASSUMPTION}</p>
    </div>
  );
};

export default SpotScenarioPanel;
