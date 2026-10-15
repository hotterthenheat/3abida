import AnimatedNumber from '../ui/AnimatedNumber';
import { usd } from '../../core/format';

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
  /* ONE WAY TO SAY A FIGURE (core/format): "$7,715.00", never a toFixed of its own ("$7715.00" — the audit's A-20) */
}) => <AnimatedNumber value={value} format={v => usd(v)} flash className={className} />;

export default SpotPrice;
