/*
  THE bid/ask cell — the Live Tape's RatioCell grammar, shared (Noah,
  2026-08-30: "our bid ask should be the one we have for options tape...
  make that the same ui"). Label over the two-tone bar: bear bid share on
  the left, bull ask share on the right. Near-even splits read MID, the
  tape's own rule.
*/

import { Missing } from './Missing';

/* THE SIDE IN ONE INK (2026-10-09, the audit's X12): the ask share was green and the bid share red — direction inks on
   a fact about SIDE, the reading the tape's own quote cell refuses: a put bought at the ask is not bullish. The label
   and the bar's reach carry the side; the bar's ask share in the primary ink over the bid's quiet track. */
/* THE BID SHARE MAY BE ITS OWN (the feed, 2026-10-12): the vendor counts mid and unsided volume too, so the bid share is
   not always the remainder of the ask's — given, it is read as given; a share the feed left out is "—". */
const LeanCell = ({ askPct, bidPct = 100 - askPct }: { askPct: number; bidPct?: number }) => {
  if (!Number.isFinite(askPct) || !Number.isFinite(bidPct)) return <Missing />;
  const mid = Math.abs(askPct - bidPct) < 12;
  const label = mid ? 'MID' : bidPct >= askPct ? `BID ${bidPct}%` : `ASK ${askPct}%`;
  const tone = mid ? 'text-textMuted' : 'text-textPrimary';
  return (
    <span className="inline-flex flex-col items-end gap-[3px] w-16" title={`${askPct}% of the volume at the ask, ${bidPct}% on the bid`}>
      <span className={`font-mono text-[11px] font-semibold uppercase tracking-wide tnum leading-[14px] ${tone}`}>{label}</span>
      <span className="flex w-16 h-[3px] rounded-full overflow-hidden bg-ink/[0.14]">
        <span className="h-full bg-textPrimary/80 ml-auto" style={{ width: `${askPct}%` }} />
      </span>
    </span>
  );
};

export default LeanCell;
