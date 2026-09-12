/*
==================================================
  SLAYER TERMINAL - HOW TO READ THE DAY AHEAD
  (components/gex/AheadGuide.tsx)

  The two guides for the Ahead page, in the house
  pattern (a focus-and-blur card over the surface;
  plain words; figures drawn in the surface's own
  grammar; "Today, in words" from the figures on
  screen). One for the corridor and its flow lane,
  one for the odds. Every figure keeps its text
  inside its own box — the ledger's guide taught
  that.
==================================================
*/

import type { ReactNode } from 'react';
import { CALL_WALL, PUT_WALL, FLIP } from './paletteInk';
import { fmtDollars, fmtPrice, fmtStrike, hhmm, type AheadClock, type CloseOdds, type Corridor, type Schedule } from '../../data/ahead';
import type { ExposureLevels } from '../../types/gex';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const LIVE = 'rgb(var(--select))';
const MONO = 'ui-monospace, Menlo, monospace';
const SANS = 'ui-sans-serif, system-ui, sans-serif';

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="px-5 py-4 border-b border-borderSubtle/60 last:border-b-0">
    <h4 className="text-[13px] font-semibold text-textPrimary">{title}</h4>
    <div className="mt-2 text-[12px] leading-relaxed text-textSecondary">{children}</div>
  </section>
);

const Figure = ({ children, label }: { children: ReactNode; label: string }) => (
  <figure data-theme="dark" className="mt-3 rounded-md border border-borderSubtle/60 bg-panel p-2">
    <svg viewBox="0 0 420 150" width="100%" role="img" aria-label={label} data-guide-figure>
      {children}
    </svg>
  </figure>
);

/* ---- the corridor ---------------------------------------------------------------- */

const ConeFigure = () => {
  /* time 0→1 across, the cone widening on √t, bending up toward a magnet, the call wall clipping its top */
  const x0 = 60;
  const x1 = 340;
  const mid = 84;
  const amp = 44;
  const pts = Array.from({ length: 17 }, (_, i) => i / 16);
  const centre = (t: number) => mid - 10 * t; // the pull toward the strike above
  const top = pts.map(t => `${(x0 + t * (x1 - x0)).toFixed(1)},${(centre(t) - amp * Math.sqrt(t)).toFixed(1)}`);
  const bot = pts.map(t => `${(x0 + t * (x1 - x0)).toFixed(1)},${(centre(t) + amp * Math.sqrt(t)).toFixed(1)}`).reverse();
  const wallY = 50;
  const topClipped = pts.map(t => `${(x0 + t * (x1 - x0)).toFixed(1)},${Math.max(wallY, centre(t) - amp * 0.72 * Math.sqrt(t)).toFixed(1)}`);
  const botLikely = pts.map(t => `${(x0 + t * (x1 - x0)).toFixed(1)},${(centre(t) + amp * 0.72 * Math.sqrt(t)).toFixed(1)}`).reverse();
  return (
    <Figure label="A corridor opening out from now to the close, bending toward the strike that pulls, its top clipped by the call wall">
      <path d={`M${top.join(' L')} L${bot.join(' L')} Z`} fill="#ffffff" fillOpacity={0.05} />
      <path d={`M${topClipped.join(' L')} L${botLikely.join(' L')} Z`} fill={SILVER} fillOpacity={0.14} stroke={SILVER} strokeOpacity={0.55} />
      <line x1={x0} x2={x1} y1={wallY} y2={wallY} stroke={CALL_WALL} strokeOpacity={0.7} strokeDasharray="3 4" />
      <text x={x1 + 4} y={wallY + 3} fontSize={8.5} fill={CALL_WALL} fontFamily={MONO}>
        call wall
      </text>
      <line x1={x0} x2={x1} y1={mid + 26} y2={mid + 26} stroke={FLIP} strokeOpacity={0.7} strokeDasharray="3 4" />
      <text x={x1 + 4} y={mid + 29} fontSize={8.5} fill={FLIP} fontFamily={MONO}>
        flip
      </text>
      <polyline points={`14,${mid + 18} 24,${mid + 10} 34,${mid + 22} 46,${mid + 6} 60,${mid}`} fill="none" stroke="#ededed" strokeOpacity={0.85} strokeWidth={1.25} />
      <line x1={x0} x2={x0} y1={18} y2={132} stroke={LIVE} strokeOpacity={0.6} />
      <text x={x0} y={13} textAnchor="middle" fontSize={8.5} fill={LIVE} fontFamily={MONO}>
        now
      </text>
      <text x={x1} y={143} textAnchor="end" fontSize={8.5} fill="#7c8290" fontFamily={MONO}>
        16:00
      </text>
      <text x={x0 + 8} y={mid - 8} fontSize={9} fill={SILVER} fontFamily={SANS}>
        likely
      </text>
      <text x={x0 + 8} y={mid + amp - 2} fontSize={9} fill="#8a909c" fontFamily={SANS}>
        rarer
      </text>
    </Figure>
  );
};

const ReachFigure = () => (
  <Figure label="Two days: a wall inside the expected move bends the corridor; a wall beyond it does not">
    {[
      { x: 40, wallInside: true, label: 'wall inside the reach · it becomes the edge' },
      { x: 230, wallInside: false, label: 'wall beyond the reach · the move is the edge' },
    ].map(p => (
      <g key={p.x}>
        <rect x={p.x} y={40} width={150} height={60} rx={6} fill={SILVER} fillOpacity={0.12} stroke={SILVER} strokeOpacity={0.5} />
        <line x1={p.x} x2={p.x + 150} y1={p.wallInside ? 40 : 22} y2={p.wallInside ? 40 : 22} stroke={CALL_WALL} strokeOpacity={0.8} strokeDasharray="3 4" />
        <text x={p.x + 150} y={(p.wallInside ? 40 : 22) - 4} textAnchor="end" fontSize={8.5} fill={CALL_WALL} fontFamily={MONO}>
          call wall
        </text>
        {!p.wallInside && (
          <text x={p.x + 150} y={36} textAnchor="end" fontSize={8.5} fill={SILVER} fontFamily={MONO}>
            expected move
          </text>
        )}
        <text x={p.x + 75} y={124} textAnchor="middle" fontSize={9} fill="#8a909c" fontFamily={SANS}>
          {p.label}
        </text>
      </g>
    ))}
  </Figure>
);

const FlowFigure = () => {
  const blocks = [0.08, 0.1, 0.12, 0.14, 0.17, 0.21, 0.27, 0.36, 0.55, 1];
  const x0 = 40;
  const bw = 32;
  const floor = 110;
  const path = `M${x0},${floor} ` + blocks.map((h, i) => `L${x0 + i * bw},${floor - h * 78} L${x0 + (i + 1) * bw},${floor - h * 78}`).join(' ') + ` L${x0 + blocks.length * bw},${floor} Z`;
  const past = 3;
  return (
    <Figure label="The half hours as one silhouette, the ones gone flat on the floor, the biggest lit with its figure">
      <path d={path} fill="#ffffff" fillOpacity={0.06} stroke="#ffffff" strokeOpacity={0.16} />
      {Array.from({ length: past }, (_, i) => (
        <rect key={i} x={x0 - past * bw + i * bw + 1} y={floor - 2} width={bw - 2} height={2} fill="#ffffff" fillOpacity={0.12} />
      ))}
      <rect x={x0 + 9 * bw + 0.5} y={floor - 78} width={bw - 1} height={78} fill={PUT_WALL} fillOpacity={0.5} />
      <text x={x0 + 9.5 * bw} y={floor - 84} textAnchor="middle" fontSize={8.5} fontWeight={600} fill={PUT_WALL} fontFamily={MONO}>
        sell $414M
      </text>
      <line x1={x0} x2={x0} y1={22} y2={floor} stroke={LIVE} strokeOpacity={0.6} />
      <text x={x0} y={16} textAnchor="middle" fontSize={8.5} fill={LIVE} fontFamily={MONO}>
        now
      </text>
      <text x={x0 - past * bw + 2} y={126} fontSize={8.5} fill="#7c8290" fontFamily={MONO}>
        09:30
      </text>
      <text x={x0 + blocks.length * bw} y={126} textAnchor="end" fontSize={8.5} fill="#7c8290" fontFamily={MONO}>
        16:00
      </text>
      <text x={210} y={143} textAnchor="middle" fontSize={9} fill="#8a909c" fontFamily={SANS}>
        gone half hours lie flat · the rest are the silhouette · the biggest wears its ink and its figure
      </text>
    </Figure>
  );
};

export const CorridorGuide = ({ corridor, schedule, levels, clock }: { corridor: Corridor; schedule: Schedule; levels: ExposureLevels; clock: AheadClock }) => (
  <div data-corridor-guide>
    <Section title="The band">
      <p>How far today's options say price can travel by the close. It opens out with time and bends toward the strikes that pull the close. The faint band is the rarer stretch.</p>
      <ConeFigure />
    </Section>
    <Section title="The walls">
      <p>A wall inside the band becomes its edge. The flip splits it: moves run on one side and slow on the other.</p>
      <ReachFigure />
    </Section>
    <Section title="The half hours · charm">
      <p>Dealers hold stock against today's options. As those options lose their delta, that stock has to go, whatever the news — that pull of the clock on their hedges is charm. Green is buying, red is selling, the biggest half hour is lit.</p>
      <FlowFigure />
    </Section>
    <Section title="A vol move · vanna">
      <p>Their hedges also re-price when implied vol moves, with spot unchanged — that is vanna. The If vol card sets a move; the flow head says what stock it makes dealers buy or sell across every expiry, and the dashed ghosts on the range are where the walls and the flip go under it.</p>
    </Section>
    <Section title="Today">
      <p>{corridor.sentence}</p>
      <p className="mt-1">{schedule.sentence}</p>
      <p className="mt-1 text-textMuted">
        Expected move ±{fmtPrice(corridor.sigma)} {clock.inSession ? 'to the close' : 'for a session'} · call wall {fmtStrike(levels.callWall)} · put wall {fmtStrike(levels.putWall)} · flip {fmtStrike(levels.flip)}
        {schedule.biggest ? ` · biggest half hour ${hhmm(schedule.biggest.from)}–${hhmm(schedule.biggest.to)}, ${fmtDollars(schedule.biggest.flow)}` : ''}
      </p>
    </Section>
  </div>
);

/* ---- where it closes ---------------------------------------------------------------- */

/** A stepped profile hugging an axis at `axisX`: one step per row, `vals` as a share of `span` */
const stepped = (axisX: number, ys: number[], vals: number[], span: number, pitch: number): string => {
  let d = `M${axisX},${(ys[0] - pitch / 2).toFixed(1)}`;
  vals.forEach((v, i) => {
    const x = (axisX - v * span).toFixed(1);
    d += ` L${x},${(ys[i] - pitch / 2).toFixed(1)} L${x},${(ys[i] + pitch / 2).toFixed(1)}`;
  });
  return `${d} L${axisX},${(ys[ys.length - 1] + pitch / 2).toFixed(1)}`;
};

/** The profile on the price axis: the dashed bell alone, the silver odds stepping out at the wall, the two bands */
const SilhouetteFigure = () => {
  const axisX = 340;
  const ys = [22, 40, 58, 76, 94, 112, 130];
  const plain = [0.08, 0.3, 0.7, 1, 0.7, 0.3, 0.08];
  const odds = [0.05, 0.2, 0.55, 0.8, 0.92, 0.5, 0.1];
  const shape = (vals: number[]) => stepped(axisX, ys, vals, 230, 18);
  return (
    <Figure label="The odds of the close as a silhouette on the price axis: the dashed bell is the expected move alone, the silver shape bulges toward the put wall that pulls the close, the bands are where it most often lands">
      <rect x={20} y={ys[1] - 9} width={axisX - 20} height={ys[5] - ys[1] + 18} fill="#ffffff" fillOpacity={0.04} />
      <rect x={20} y={ys[3] - 9} width={axisX - 20} height={ys[4] - ys[3] + 18} fill={SILVER} fillOpacity={0.1} />
      <line x1={20} x2={axisX} y1={ys[3] - 9} y2={ys[3] - 9} stroke={SILVER} strokeOpacity={0.5} />
      <line x1={20} x2={axisX} y1={ys[4] + 9} y2={ys[4] + 9} stroke={SILVER} strokeOpacity={0.5} />
      <text x={26} y={ys[1] - 12} fontSize={8.5} fill="#8a909c" fontFamily={SANS}>
        80% chance
      </text>
      <text x={26} y={ys[3] + 2} fontSize={8.5} fill={SILVER} fontFamily={SANS}>
        50% chance
      </text>
      <line x1={20} x2={axisX} y1={ys[4]} y2={ys[4]} stroke={PUT_WALL} strokeOpacity={0.6} strokeDasharray="3 4" />
      <text x={26} y={ys[4] - 4} fontSize={8.5} fill={PUT_WALL} fontFamily={SANS}>
        put wall
      </text>
      <path d={`${shape(odds)} Z`} fill={SILVER} fillOpacity={0.26} stroke={SILVER} strokeOpacity={0.85} strokeLinejoin="round" />
      <path d={shape(plain)} fill="none" stroke="#ffffff" strokeOpacity={0.4} strokeDasharray="3 3" strokeLinejoin="round" />
      <rect x={axisX - 0.92 * 230} y={ys[4] - 8} width={0.92 * 230} height={16} fill={SILVER} fillOpacity={0.9} />
      <text x={axisX - 0.92 * 230 - 6} y={ys[4] + 3.5} textAnchor="end" fontSize={9} fontWeight={700} fill={SILVER} fontFamily={MONO}>
        490 · 14%
      </text>
      {ys.map((y, i) => (
        <text key={y} x={axisX + 6} y={y + 3} fontSize={8.5} fill={i === 4 ? SILVER : '#7c8290'} fontFamily={MONO}>
          {493 - i}
        </text>
      ))}
      <text x={20} y={145} fontSize={9} fill="#8a909c" fontFamily={SANS}>
        dashed: the move alone · silver: what the strikes make of it · the gap between them is the pull
      </text>
    </Figure>
  );
};

/** The same silhouette at three times of day: it narrows and the wall's bulge grows as the close nears */
const PullFigure = () => (
  <Figure label="The same odds at three times of day: the silhouette narrows and the pull toward the wall grows as the close nears">
    {[
      { x: 100, t: '10:00', pull: 0.3, label: 'light' },
      { x: 230, t: '13:00', pull: 0.6, label: 'building' },
      { x: 360, t: '15:30', pull: 0.92, label: 'strong' },
    ].map(p => {
      const ys = [34, 50, 66, 82, 98, 114];
      const base = [0.15, 0.45, 0.85, 1, 0.6, 0.2];
      const vals = base.map((v, i) => (i === 3 ? v * (0.7 + p.pull * 0.6) : v * (1 - p.pull * 0.45)));
      const d = `${stepped(p.x, ys, vals, 70, 16)} Z`;
      return (
        <g key={p.t}>
          <text x={p.x - 35} y={22} textAnchor="middle" fontSize={9} fill="#ededed" fontFamily={MONO}>
            {p.t}
          </text>
          <line x1={p.x} x2={p.x} y1={ys[0] - 8} y2={ys[ys.length - 1] + 8} stroke="#ffffff" strokeOpacity={0.15} />
          <line x1={p.x - 80} x2={p.x} y1={ys[3]} y2={ys[3]} stroke={PUT_WALL} strokeOpacity={0.6} strokeDasharray="3 4" />
          <path d={d} fill={SILVER} fillOpacity={0.26} stroke={SILVER} strokeOpacity={0.85} strokeLinejoin="round" />
          <text x={p.x - 35} y={136} textAnchor="middle" fontSize={9} fill="#8a909c" fontFamily={SANS}>
            pull {p.label}
          </text>
        </g>
      );
    })}
  </Figure>
);

export const CloseGuide = ({ odds, spot, clock }: { odds: CloseOdds; spot: number; clock: AheadClock }) => (
  <div data-close-guide>
    <Section title="The profile">
      <p>Start with the expected move: the close is most likely near spot, less likely further out — that is the dashed outline. Then the strikes pull it: the ones that hold price pull the close toward them, the ones that move price push it away — that is the silver profile, one step per strike, its length the odds the close lands there. The steps that reach past the outline are where the close is drawn to; the gap between the two is the strikes' pull.</p>
      <SilhouetteFigure />
    </Section>
    <Section title="The bands">
      <p>Two runs of strikes around the likeliest, shaded the way the range above shades its bands: there is a 50% chance the close lands inside the silver one and an 80% chance it lands inside the fainter one. Read them against the range's own band — the range is where price can go by the close, the bands are where on that ruler it most often ends.</p>
    </Section>
    <Section title="The pull grows">
      <p>Early on the whole range is in play and the silhouette is wide. As the minutes run out it narrows, and the heavy strikes take over.</p>
      <PullFigure />
    </Section>
    <Section title="Today">
      <p>{odds.sentence}</p>
      <p className="mt-1 text-textMuted">
        Spot {fmtPrice(spot)} · curve ±{fmtPrice(odds.sigma)} {clock.inSession ? 'for the time left' : 'for a session'} · pull {Math.round(odds.gravity * 100)}%
      </p>
    </Section>
  </div>
);
