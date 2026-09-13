import CompanyLogo from './CompanyLogo';

interface SpotRuleProps {
  ticker: string;
  price: number;
  /** The name's mark beside the pill (the global rule: a ticker travels with its logo); off where the host prints it already */
  logo?: boolean;
}

/**
 * Current-price marker: a rule with an inverted axis pill (white tag, dark
 * text) — the TradingView price-label idiom. Shared by every strike list the
 * live price crosses. White = "where the market is".
 *
 * CENTRED (Noah, 2026-09-12: "you need to center stuff like the current
 * price"): the pill sits in the MIDDLE of the rule, the line running out to
 * both edges, so the price reads as a level across the whole row instead of a
 * tag hanging off its right end — where the ladder's figure columns clipped
 * against it.
 */
const SpotRule = ({ ticker, price, logo = true }: SpotRuleProps) => (
  <span className="flex items-center gap-1.5 select-none" aria-label={`${ticker} spot ${price.toFixed(2)}`} data-spot-rule>
    <span className="h-px flex-1 bg-gradient-to-r from-textPrimary/10 via-textPrimary/40 to-textPrimary/50" />
    {logo && <CompanyLogo ticker={ticker} size={12} />}
    <span className="font-mono text-[9px] uppercase tracking-wider text-textSecondary whitespace-nowrap">{ticker}</span>
    <span className="inline-flex items-center rounded-[3px] bg-textPrimary px-1.5 py-px font-mono text-[10px] font-bold tnum text-[#0a0a0a] whitespace-nowrap">
      {price.toFixed(2)}
    </span>
    <span className="h-px flex-1 bg-gradient-to-l from-textPrimary/10 via-textPrimary/40 to-textPrimary/50" />
  </span>
);

export default SpotRule;
