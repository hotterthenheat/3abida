/*
  THE bid/ask cell — the Live Tape's RatioCell grammar, shared (Noah,
  2026-08-30: "our bid ask should be the one we have for options tape...
  make that the same ui"). Label over the two-tone bar: bear bid share on
  the left, bull ask share on the right. Near-even splits read MID, the
  tape's own rule.
*/

const LeanCell = ({ askPct }: { askPct: number }) => {
  const bidPct = 100 - askPct;
  const mid = Math.abs(askPct - 50) < 6;
  const label = mid ? 'MID' : bidPct >= 50 ? `BID ${bidPct}%` : `ASK ${askPct}%`;
  const tone = mid ? 'text-textMuted' : bidPct >= 50 ? 'text-bear' : 'text-bull';
  return (
    <span className="inline-flex flex-col items-end gap-[3px] w-16">
      <span className={`font-mono text-[9px] font-semibold uppercase tracking-wide tnum leading-[14px] ${tone}`}>
        {label}
      </span>
      <span className="flex w-16 h-[3px] rounded-full overflow-hidden bg-ink/[0.06]">
        <span className="h-full bg-bear/80" style={{ width: `${bidPct}%` }} />
        <span className="h-full bg-bull/90" style={{ width: `${askPct}%` }} />
      </span>
    </span>
  );
};

export default LeanCell;
