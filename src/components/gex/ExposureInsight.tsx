import Panel from '../ui/Panel';
import RichRead from '../ui/RichRead';
import SignalBadge from '../ui/SignalBadge';
import type { DealerBias } from '../../types/gex';
import type { Tone } from '../ui/tones';

interface ExposureInsightProps {
  bias: DealerBias;
  biasNote: string;
  insights: string[];
}

const biasTone: Record<DealerBias, Tone> = {
  BULLISH: 'bull',
  BEARISH: 'bear',
  NEUTRAL: 'neutral',
};

/** Positioning narrative — the engine's levels translated into English. */
const ExposureInsight = ({ bias, biasNote, insights }: ExposureInsightProps) => (
  <Panel
    title="Positioning Insight"
    actions={<SignalBadge tone={biasTone[bias]} dot>{bias}</SignalBadge>}
    className="w-full h-full"
  >
    <div className="flex flex-col gap-2.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-textMuted">{biasNote}</span>
      <ul className="flex flex-col gap-2">
        {insights.map((line, i) => (
          <li key={i} className="flex items-start gap-2 text-[11px] text-textSecondary leading-relaxed">
            <span className="text-textMuted mt-px select-none">›</span>
            <span className="tnum">
              <RichRead text={line} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  </Panel>
);

export default ExposureInsight;
