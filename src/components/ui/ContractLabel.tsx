/*
==================================================
  SLAYER TERMINAL - CONTRACT LABEL
  (components/ui/ContractLabel.tsx)

  THE WHOLE CONTRACT IN ITS SIDE'S INK, WITH ITS
  LOGO (the board card's pill, lifted out on
  2026-09-13 — Noah, with his partner's board:
  "including the logos next to the ticker and the
  right side panel having the same design pattern
  for the ticker"): the name's mark, then one pill
  with the name, the strike and the side together,
  bull for a call and bear for a put, a hairline
  border and a whisper of the same tint behind.
  Every surface that prints a contract prints it
  through here, so the rule cannot drift — the
  board's cards, the heaviest rail, the contracts
  around a setup, the scan board.
==================================================
*/

import CompanyLogo from './CompanyLogo';

interface ContractLabelProps {
  /** e.g. "NVDA 112.50C" */
  contract: string;
  right: 'C' | 'P';
  /** The name's mark before the pill (the global rule: a ticker travels with its logo) */
  logo?: string;
  size?: 'sm' | 'md';
  className?: string;
}

const ContractLabel = ({ contract, right, logo, size = 'md', className = '' }: ContractLabelProps) => {
  const isCall = right === 'C';
  return (
    <span className={`inline-flex items-center gap-1.5 min-w-0 ${className}`} data-contract-label={contract}>
      {logo && <CompanyLogo ticker={logo} size={size === 'sm' ? 14 : 16} />}
      {/* leading-normal, EXPLICIT: inside a grid cell the pill inherited the cell's line-height (the
          row's 36px) and stood 40px tall in a 39px row, its border past the row's rules (Noah,
          2026-09-14: "the con cards are bleeding out of their respected row"); the pill's own line
          keeps it 21px (sm) / 24px (md) wherever it stands */}
      <span className={`font-mono font-bold leading-normal rounded border whitespace-nowrap ${size === 'sm' ? 'text-[11px] px-1 py-px' : 'text-[12px] px-1.5 py-0.5'} ${isCall ? 'text-bull border-bull/30 bg-bull/[0.06]' : 'text-bear border-bear/30 bg-bear/[0.06]'}`}>{contract}</span>
    </span>
  );
};

export default ContractLabel;
