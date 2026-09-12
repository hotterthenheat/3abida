import Panel from '../../components/ui/Panel';

const PLANNED = [
  {
    title: 'Contract Aggregation',
    code: 'SCAN_01',
    detail: 'Per-contract rollup — last activity, avg fill, chg%, volume, OI, ΔOI%, total premium, IV',
  },
  {
    title: 'Bull / Bear Scoring',
    code: 'SCAN_02',
    detail: 'Directional conviction per contract and per chain from side-of-spread execution',
  },
  {
    title: 'Session Replay',
    code: 'SCAN_03',
    detail: 'Date picker — replay any prior session’s aggregated flow',
  },
];

/** Scaffold — per-contract flow aggregation lands with the real tape feed. */
const FlowScanner = () => (
  <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
    {PLANNED.map(mod => (
      <Panel key={mod.code} title={mod.title} subtitle={mod.code} className="w-full">
        <div className="h-32 flex flex-col items-center justify-center gap-2 border border-dashed border-borderSubtle rounded-md px-4 text-center">
          <span className="font-mono text-[10px] text-textMuted uppercase tracking-widest">
            Module scheduled — needs per-print feed
          </span>
          <span className="text-[11px] text-textSecondary leading-snug">{mod.detail}</span>
        </div>
      </Panel>
    ))}
  </div>
);

export default FlowScanner;
