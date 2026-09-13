/*
==================================================
  SLAYER TERMINAL - CONTRACT LABEL
  (components/ui/ContractLabel.tsx)

  THE WHOLE CONTRACT IN ITS SIDE'S INK (Noah,
  2026-09-12, three times over: the heaviest
  contracts, the contracts around a setup, the
  board — "I don't like how only the C or the P
  is green or red, it should be the same way it
  is on the board area where the entire thing is
  red or green"). One pill, the board card's:
  the name, the strike and the side together,
  bull for a call and bear for a put, a hairline
  border and a whisper of the same tint behind.
  Every surface that prints a contract prints it
  through here, so the rule cannot drift.
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
      <span
        className={`font-mono font-bold rounded border whitespace-nowrap ${size === 'sm' ? 'text-[11px] px-1 py-px' : 'text-[12px] px-1.5 py-0.5'} ${
          isCall ? 'text-bull border-bull/30 bg-bull/[0.06]' : 'text-bear border-bear/30 bg-bear/[0.06]'
        }`}
      >
        {contract}
      </span>
    </span>
  );
};

export default ContractLabel;
