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
import { CALL_WALL, PUT_WALL, FLIP, SUPREME } from './paletteInk';
import { fmtDollars, fmtPrice, fmtStrike, hhmm, type AheadClock, type CloseOdds, type Corridor, type Schedule } from '../../data/ahead';
import type { ExposureLevels } from '../../types/gex';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
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

/** The range on one price scale (2026-09-13): the track, the band with its edges, the posts named above, spot as the rule, the bracket under */
const ScaleFigure = () => {
  const x0 = 30;
  const x1 = 390;
  const y = 74;
  const px = (f: number) => x0 + f * (x1 - x0);
  const posts = [
    { f: 0.22, name: 'put wall 109', ink: PUT_WALL, extra: '' },
    { f: 0.4, name: 'flip 109.50', ink: FLIP, extra: '' },
    { f: 0.78, name: 'call wall 111', ink: CALL_WALL, extra: ' · in reach 14:20' },
  ];
  return (
    <Figure label="One price scale: the faint track is two expected moves each side, dashed where moves run; the silver band is the likely range; the walls and the flip are posts named above; spot is the white rule; the bracket under is one expected move each side">
      <line x1={px(0.02)} x2={px(0.4)} y1={y} y2={y} stroke="#ffffff" strokeOpacity={0.25} strokeDasharray="3 3" />
      <line x1={px(0.4)} x2={px(0.98)} y1={y} y2={y} stroke="#ffffff" strokeOpacity={0.25} />
      <rect x={px(0.22)} y={y - 6} width={px(0.78) - px(0.22)} height={12} fill={SILVER} fillOpacity={0.12} />
      <line x1={px(0.22)} x2={px(0.22)} y1={y - 8} y2={y + 8} stroke={SILVER} strokeOpacity={0.7} strokeWidth={1.25} />
      <line x1={px(0.78)} x2={px(0.78)} y1={y - 8} y2={y + 8} stroke={SILVER} strokeOpacity={0.7} strokeWidth={1.25} />
      {posts.map(p => (
        <g key={p.name}>
          <line x1={px(p.f)} x2={px(p.f)} y1={y - 22} y2={y + 18} stroke={p.ink} strokeOpacity={0.85} strokeWidth={1.25} strokeDasharray={p.ink === FLIP ? '2 2' : undefined} />
          <text x={px(p.f)} y={y - 28} textAnchor="middle" fontSize={8.5} fontWeight={500} fill={p.ink} fontFamily={SANS}>
            {p.name}
            {p.extra && (
              <tspan fill="#8a909c" fontFamily={MONO} fontSize={8}>
                {p.extra}
              </tspan>
            )}
          </text>
        </g>
      ))}
      <line x1={px(0.55)} x2={px(0.55)} y1={y - 22} y2={y + 18} stroke="#ededed" strokeOpacity={0.9} strokeWidth={1.5} />
      <circle cx={px(0.55)} cy={y} r={3} fill="#0e0e0f" stroke={SILVER} strokeWidth={1.25} />
      <text x={px(0.55)} y={y - 40} textAnchor="middle" fontSize={9} fontWeight={700} fill="#ededed" fontFamily={MONO}>
        110.03
      </text>
      {[0.1, 0.3, 0.5, 0.7, 0.9].map((f, i) => (
        <text key={f} x={px(f)} y={y + 32} textAnchor="middle" fontSize={8} fill="#7c8290" fontFamily={MONO}>
          {108 + i}
        </text>
      ))}
      <path d={`M${px(0.36)},${y + 40} V${y + 45} H${px(0.74)} V${y + 40}`} fill="none" stroke={SILVER} strokeOpacity={0.6} />
      <text x={px(0.55)} y={y + 58} textAnchor="middle" fontSize={7.5} fill="#8a909c" fontFamily={MONO} letterSpacing={1.1}>
        ONE EXPECTED MOVE EACH SIDE · ±1.25
      </text>
      <text x={px(0.21)} y={y + 6 + 14} textAnchor="end" fontSize={8} fill="#8a909c" fontFamily={SANS}>
        moves run
      </text>
      <text x={px(0.99)} y={y - 10} textAnchor="end" fontSize={8} fill="#8a909c" fontFamily={SANS}>
        the rarer stretch
      </text>
    </Figure>
  );
};

const ReachFigure = () => (
  <Figure label="Two days: a wall inside the expected move bends the corridor; a wall beyond it does not">
    {[
      /* two lines under each case — as one line apiece the two ran into each other */
      { x: 40, wallInside: true, label: ['wall inside the reach', 'it becomes the edge'] },
      { x: 230, wallInside: false, label: ['wall beyond the reach', 'the move is the edge'] },
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
        <text x={p.x + 75} y={120} textAnchor="middle" fontSize={9} fill="#8a909c" fontFamily={SANS}>
          {p.label[0]}
        </text>
        <text x={p.x + 75} y={132} textAnchor="middle" fontSize={9} fill="#8a909c" fontFamily={SANS}>
          {p.label[1]}
        </text>
      </g>
    ))}
  </Figure>
);

/** The pane (2026-09-13 evening): a middle line, a plain bar per half hour from it — down in red, selling — the figure at its end, the hour under; the gone ones say done, the one under way wears the silver edge */
const FlowFigure = () => {
  const blocks: (number | null)[] = [null, null, 0.2, 0.24, 0.29, 0.36, 0.45, 0.58, 0.76, 1];
  const hours = ['09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00'];
  const x0 = 40;
  const slot = 37;
  const mid = 58;
  const reach = 44;
  return (
    <Figure label="The dealers' pane: buying above the middle line and selling below it, a plain bar per half hour from the line, its dollars at its end and the hour under it; the half hours gone say done, the one under way wears the silver edge">
      <rect x={6} y={6} width={408} height={124} rx={4} fill="none" stroke="#ffffff" strokeOpacity={0.1} />
      <line x1={6} x2={414} y1={mid} y2={mid} stroke="#ffffff" strokeOpacity={0.25} />
      <text x={12} y={17} fontSize={7} fill={CALL_WALL} fontFamily={MONO} letterSpacing={1}>
        BUYING
      </text>
      <text x={12} y={mid + 46} fontSize={7} fill={PUT_WALL} fontFamily={MONO} letterSpacing={1}>
        SELLING
      </text>
      {blocks.map((h, i) => {
        const cx = x0 + i * slot + slot / 2;
        return (
          <g key={i}>
            {h == null ? (
              <text x={cx} y={mid - 5} textAnchor="middle" fontSize={6.5} fill="#6b7280" fontFamily={MONO} letterSpacing={0.8}>
                DONE
              </text>
            ) : (
              <>
                {i === 2 && <rect x={cx - 13} y={mid - 2} width={26} height={h * reach + 4} rx={3} fill="none" stroke={SILVER} strokeOpacity={0.9} strokeWidth={1} />}
                <rect x={cx - 11} y={mid} width={22} height={h * reach} rx={2} fill={PUT_WALL} fillOpacity={i === blocks.length - 1 ? 1 : 0.8} />
                <text x={cx} y={mid + h * reach + 10} textAnchor="middle" fontSize={7.5} fontWeight={600} fill={PUT_WALL} fontFamily={MONO}>
                  ${Math.round(h * 496)}M
                </text>
              </>
            )}
            <text x={cx} y={122} textAnchor="middle" fontSize={7} fill="#7c8290" fontFamily={MONO}>
              {hours[i]}
            </text>
          </g>
        );
      })}
      <text x={210} y={144} textAnchor="middle" fontSize={9} fill="#8a909c" fontFamily={SANS}>
        a bar per half hour from the middle line · down in red sells, up in green buys
      </text>
    </Figure>
  );
};

export const CorridorGuide = ({ corridor, schedule, levels, clock }: { corridor: Corridor; schedule: Schedule; levels: ExposureLevels; clock: AheadClock }) => (
  <div data-corridor-guide>
    <Section title="The scale">
      <p>How far today's options say price can travel by the close, on one price scale. The silver band is the likely range — one expected move each side of where the strikes pull the close, cut short by a wall inside its reach. The faint track past it is the rarer stretch, two moves out. Spot is the white rule; the bracket under the prices is one expected move each side. With the market shut it is drawn for the next session. Hover any price for its read; hover a post for the post's.</p>
      <ScaleFigure />
    </Section>
    <Section title="The walls">
      <p>A wall inside the expected move's reach becomes the band's edge, and the clock time the move gets there is printed beside the wall's name. The flip splits the scale: moves run on one side and slow on the other — the track is dashed where they run.</p>
      <ReachFigure />
    </Section>
    <Section title="The half hours · charm">
      <p>Dealers hold stock against today's options. As those options lose their delta, that stock has to go, whatever the news — that pull of the clock on their hedges is charm. Every half hour is a bar from the pane's middle line: up in green for buying, down in red for selling, its figure at its end and the hour under it. The half hours gone say done; the one under way wears the silver edge. Hover any bar and the read line speaks it.</p>
      <FlowFigure />
    </Section>
    <Section title="A vol move · vanna">
      <p>Their hedges also re-price when implied vol moves, with spot unchanged — that is vanna. The If vol card on the pane's head sets a move; the line under the sentence says what stock it makes dealers buy or sell across every expiry, and the dashed posts on the scale are where the walls and the flip go under it.</p>
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

/** The rows (2026-09-13 evening): a row per strike, the bar the chance, the three likeliest numbered in silver — the bar's ink the rank alone — the role a tag beside the strike, the runs as washes, spot as the rule */
const RowsFigure = () => {
  const rows: { k: string; odds: number; plain: number; n: number | null; role: string | null; ink: string | null; run: 'half' | 'most' | null; pct: string; spotAfter?: boolean }[] = [
    { k: '501', odds: 0.66, plain: 0.72, n: null, role: null, ink: null, run: 'most', pct: '6.6%' },
    { k: '500', odds: 0.82, plain: 0.86, n: null, role: 'supreme', ink: SUPREME, run: 'half', pct: '8.2%' },
    { k: '499', odds: 0.9, plain: 0.96, n: 3, role: null, ink: null, run: 'half', pct: '8.3%' },
    { k: '498', odds: 1, plain: 1, n: 1, role: null, ink: null, run: 'half', pct: '9.3%', spotAfter: true },
    { k: '497', odds: 0.88, plain: 0.98, n: null, role: null, ink: null, run: 'half', pct: '8.2%' },
    { k: '495', odds: 0.84, plain: 0.62, n: 2, role: 'put wall', ink: PUT_WALL, run: 'half', pct: '8.4%' },
    { k: '494', odds: 0.6, plain: 0.52, n: null, role: null, ink: null, run: 'most', pct: '6.1%' },
  ];
  const barX = 100;
  const span = 240;
  let y = 10;
  return (
    <Figure label="A row per strike: the strike with its role tag, a bar as long as the chance the close lands there, the three likeliest numbered on silver bars, the odds at the right, the 50% and 80% runs shaded across the rows, spot as the rule between the strikes">
      {rows.map(r => {
        const ry = y;
        y += 15;
        const spotY = r.spotAfter ? ry + 15 : null;
        if (r.spotAfter) y += 10;
        return (
          <g key={r.k}>
            {r.run && <rect x={6} y={ry - 1} width={408} height={14} rx={2} fill={SILVER} fillOpacity={r.run === 'half' ? 0.08 : 0.035} />}
            <text x={14} y={ry + 9} fontSize={8.5} fontWeight={700} fill="#ededed" fontFamily={MONO}>
              {r.k}
            </text>
            {r.role && (
              <text x={40} y={ry + 9} fontSize={6.5} fontWeight={700} fill={r.ink ?? '#8a909c'} fontFamily={SANS} letterSpacing={0.6}>
                {r.role.toUpperCase()}
              </text>
            )}
            <rect x={barX} y={ry + 2} width={r.odds * span} height={8} rx={4} fill={r.n ? SILVER : '#ededed'} fillOpacity={r.n === 1 ? 1 : r.n ? 0.5 : 0.22} />
            <line x1={barX + r.plain * span} x2={barX + r.plain * span} y1={ry} y2={ry + 12} stroke="#ededed" strokeOpacity={0.5} />
            {r.n && (
              <>
                <rect x={barX + 3} y={ry + 1.5} width={14} height={9} rx={2} fill={SILVER} />
                <text x={barX + 10} y={ry + 8.5} textAnchor="middle" fontSize={6.5} fontWeight={700} fill="#0a0a0a" fontFamily={MONO}>
                  #{r.n}
                </text>
              </>
            )}
            <text x={406} y={ry + 9} textAnchor="end" fontSize={8.5} fontWeight={600} fill="#ededed" fontFamily={MONO}>
              {r.pct}
            </text>
            {spotY != null && (
              <g>
                <line x1={14} x2={406} y1={spotY + 4} y2={spotY + 4} stroke="#ededed" strokeOpacity={0.3} />
                <text x={56} y={spotY + 7} textAnchor="end" fontSize={6.5} fill="#8a909c" fontFamily={MONO} letterSpacing={0.8}>
                  SPY
                </text>
                <rect x={60} y={spotY - 1} width={36} height={10} rx={2} fill="#ededed" />
                <text x={78} y={spotY + 6.5} textAnchor="middle" fontSize={6.5} fontWeight={700} fill="#0a0a0a" fontFamily={MONO}>
                  497.33
                </text>
              </g>
            )}
          </g>
        );
      })}
      <text x={210} y={143} textAnchor="middle" fontSize={9} fill="#8a909c" fontFamily={SANS}>
        a row per strike, its bar the chance · silver says the rank, the tag the role
      </text>
    </Figure>
  );
};

/** The same bars at three times of day: they narrow and the wall's bar grows as the close nears */
const PullFigure = () => (
  <Figure label="The same odds at three times of day: the bars narrow around the wall and its own bar grows as the close nears">
    {[
      { x: 30, t: '10:00', pull: 0.3, label: 'light' },
      { x: 160, t: '13:00', pull: 0.6, label: 'building' },
      { x: 290, t: '15:30', pull: 0.92, label: 'strong' },
    ].map(p => {
      const ys = [34, 50, 66, 82, 98, 114];
      const base = [0.15, 0.45, 0.85, 1, 0.6, 0.2];
      const vals = base.map((v, i) => (i === 3 ? v * (0.7 + p.pull * 0.6) : v * (1 - p.pull * 0.45)));
      return (
        <g key={p.t}>
          <text x={p.x + 50} y={22} textAnchor="middle" fontSize={9} fill="#ededed" fontFamily={MONO}>
            {p.t}
          </text>
          <line x1={p.x} x2={p.x} y1={ys[0] - 8} y2={ys[ys.length - 1] + 8} stroke="#ffffff" strokeOpacity={0.15} />
          {ys.map((y, i) => (
            <rect key={y} x={p.x + 2} y={y - 5} width={vals[i] * 80} height={10} fill={SILVER} fillOpacity={i === 3 ? 0.9 : 0.26} />
          ))}
          <line x1={p.x} x2={p.x + 100} y1={ys[3]} y2={ys[3]} stroke={PUT_WALL} strokeOpacity={0.6} strokeDasharray="3 4" />
          <text x={p.x + 50} y={136} textAnchor="middle" fontSize={9} fill="#8a909c" fontFamily={SANS}>
            pull {p.label}
          </text>
        </g>
      );
    })}
  </Figure>
);

export const CloseGuide = ({ odds, spot, clock }: { odds: CloseOdds; spot: number; clock: AheadClock }) => (
  <div data-close-guide>
    <Section title="The rows">
      <p>Start with the expected move: the close is most likely near spot, less likely further out. Then the strikes pull it: the ones that hold price pull the close toward them, the ones that move price push it away. Each strike is a row — its bar the chance the 4:00 print lands there, the odds at the right. The three likeliest are numbered and their bars are silver: the bar's ink says the rank alone, and the role — call wall, put wall, supreme, pin — is the small tag beside the strike. The thin tick on every bar is what the expected move alone would give it. Hover a row and the read line says what the strikes did to it; click keeps it.</p>
      <RowsFigure />
    </Section>
    <Section title="The runs">
      <p>Two runs of strikes around the likeliest, shaded across the rows: there is a 50% chance the close lands inside the brighter run and an 80% chance inside the fainter one. Read them against the range above — the range is where price can go by the close, the runs are where on that scale it most often ends.</p>
    </Section>
    <Section title="The slices">
      <p>The last read under the rows answers what a trade asks: the chance the close lands above the call wall, between the walls, below the put wall and above the flip — and, for a wall on the far side of spot, the chance price touches it before the close, about twice the chance of ending beyond it. A strike you keep joins the line.</p>
    </Section>
    <Section title="The pull grows">
      <p>Early on the whole range is in play and the bars spread wide. As the minutes run out they narrow, and the heavy strikes take over.</p>
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
