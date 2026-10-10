import { fmtUsd } from '../../data/gex';
import { usdCompactSigned } from '../../core/format';

/*
  A NET FIGURE IN ITS MEANING'S INK (2026-10-09, the audit's TR-53 and TR-38): net puts bought (+) lean bearish and sold
  (−) lean bullish, so a sentence that let RichRead ink every "+$" green painted put buying as bullish. `put` turns the
  ink round; a zero is no lean at all, in the plain ink. Net Flow, 0DTE and Compare speak their money through this.
*/
const signed = usdCompactSigned;

const Lean = ({ v, put = false, className = '' }: { v: number; put?: boolean; className?: string }) => {
  const up = put ? v < 0 : v > 0;
  const down = put ? v > 0 : v < 0;
  return <span className={`font-semibold tnum ${up ? 'text-bull' : down ? 'text-bear' : 'text-textPrimary'} ${className}`}>{signed(v)}</span>;
};

export default Lean;
