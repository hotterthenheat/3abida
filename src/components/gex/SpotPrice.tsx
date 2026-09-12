import AnimatedNumber from '../ui/AnimatedNumber';

/** Live spot readout with the house change stamp (Noah, 2026-08-17: red on
    a drop, green on a rise — and "back to white after the change"): the
    flash inks the move for a beat, then eases back to white while the
    number rolls. Exactly AnimatedNumber's Robinhood grammar, named for the
    chart strips that carry it. */
const SpotPrice = ({
  value,
  className = 'font-mono text-[11px] font-semibold tnum text-textPrimary',
}: {
  value: number;
  className?: string;
}) => <AnimatedNumber value={value} format={v => `$${v.toFixed(2)}`} flash className={className} />;

export default SpotPrice;
