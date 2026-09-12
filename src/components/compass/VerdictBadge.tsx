import SignalBadge from '../ui/SignalBadge';
import { VERDICT_LABEL, type Verdict } from '../../types/compass';

const VERDICT_TONE = {
  ENTER: 'bull',
  EXIT: 'bear',
  WATCH: 'warn',
} as const;

interface VerdictBadgeProps {
  verdict: Verdict;
  dot?: boolean;
  className?: string;
}

/** Users see a state (ACTIVE/WATCH/FADING), never the engine's internal call. */
const VerdictBadge = ({ verdict, dot = false, className = '' }: VerdictBadgeProps) => (
  <SignalBadge tone={VERDICT_TONE[verdict]} dot={dot} className={className}>
    {VERDICT_LABEL[verdict]}
  </SignalBadge>
);

export default VerdictBadge;
