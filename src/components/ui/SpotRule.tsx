interface SpotRuleProps {
  ticker: string;
  price: number;
}

/**
 * Current-price marker: a rule with an inverted axis pill (white tag, dark
 * text) — the TradingView price-label idiom. Shared by every strike list the
 * live price crosses. White = "where the market is".
 */
const SpotRule = ({ ticker, price }: SpotRuleProps) => (
  <span className="flex items-center gap-1.5 select-none" aria-label={`${ticker} spot ${price.toFixed(2)}`}>
    <span className="h-px flex-grow bg-gradient-to-r from-textPrimary/10 via-textPrimary/40 to-textPrimary/50" />
    <span className="font-mono text-[9px] uppercase tracking-wider text-textSecondary whitespace-nowrap">{ticker}</span>
    <span className="inline-flex items-center rounded-[3px] bg-textPrimary px-1.5 py-px font-mono text-[10px] font-bold tnum text-[#0a0a0a] whitespace-nowrap">
      {price.toFixed(2)}
    </span>
    <span className="h-px w-3 shrink-0 bg-textPrimary/50" />
  </span>
);

export default SpotRule;
