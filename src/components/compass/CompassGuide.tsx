/*
==================================================
  SLAYER TERMINAL - HOW TO READ THE BOARD
  (components/compass/CompassGuide.tsx)

  The Compass board's guide in the house pattern
  (the walk, 2026-09-11): a figure per thing, the
  surface drawn small in its own inks, one sentence
  under each.
==================================================
*/

import type { ReactNode } from 'react';
import { FONT_SANS } from '../../theme/fonts';
import { GuideSvg, type GuideType } from '../ui/GuideSvg';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const BULL = 'rgb(var(--bull))';
const BEAR = 'rgb(var(--bear))';
const WARN = 'rgb(var(--warn))';
const SUPREME = 'rgb(var(--supreme))';
const MUTED = '#7c8290';
const SECOND = 'rgb(var(--text-secondary))';
const INK = 'rgb(var(--text-primary))';
/* the figures' voice — Helvetica's digits are tabular (theme/fonts.ts) */
const FIG = FONT_SANS;

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="px-5 py-4 border-b border-borderSubtle/60 last:border-b-0">
    <h4 className="text-[13px] font-semibold text-textPrimary">{title}</h4>
    <div className="mt-2 text-[12px] leading-relaxed text-textSecondary">{children}</div>
  </section>
);

const Figure = ({ children, label, h = 110 }: { children: (t: GuideType) => ReactNode; label: string; h?: number }) => (
  <figure data-theme="dark" className="mt-3 rounded-md border border-borderSubtle/60 bg-panel p-2">
    <GuideSvg w={420} h={h} label={label}>
      {children}
    </GuideSvg>
  </figure>
);

/* A card: the rank, the contract in its side's ink, the expiry, the crown, the state; the move, the spark, the premium; what kills it */
const CardFigure = () => (
  <Figure label="One card: #1, NVDA 120P in red, the expiry chip, Top pick in magenta, a Moving chip; the one-sigma move, the session's line, the premium; Breaks above $121.26 in amber and the Open door" h={110}>
    {({ w }) => (
      <>
        <rect x={4} y={4} width={412} height={102} rx={5} fill="#ffffff" fillOpacity={0.015} stroke={SILVER} strokeOpacity={0.6} />
        <text x={14} y={25} fontSize={w} fill={MUTED} fontFamily={FIG}>
          #1
        </text>
        <rect x={36} y={12} width={76} height={18} rx={3} fill={BEAR} fillOpacity={0.06} stroke={BEAR} strokeOpacity={0.3} />
        <text x={74} y={25} textAnchor="middle" fontSize={w} fontWeight={700} fill={BEAR} fontFamily={FIG}>
          NVDA 120P
        </text>
        <rect x={118} y={12} width={82} height={18} rx={3} fill="none" stroke="#2a2a2a" />
        <text x={159} y={25} textAnchor="middle" fontSize={w} fill={SECOND} fontFamily={FIG}>
          0DTE · Today
        </text>
        <rect x={206} y={12} width={62} height={18} rx={3} fill={SUPREME} fillOpacity={0.1} stroke={SUPREME} strokeOpacity={0.5} />
        <text x={237} y={25} textAnchor="middle" fontSize={w} fontWeight={700} fill={SUPREME} fontFamily={FIG}>
          Top pick
        </text>
        <rect x={338} y={12} width={66} height={18} rx={3} fill="#ffffff" fillOpacity={0.08} />
        <circle cx={348} cy={21} r={2} fill={INK} />
        <text x={378} y={25} textAnchor="middle" fontSize={w} fontWeight={700} fill={INK} fontFamily={FIG}>
          Moving
        </text>
        <text x={14} y={50} fontSize={w} fill={MUTED} fontFamily={FIG}>
          1σ move
        </text>
        <text x={14} y={67} fontSize={w * 1.3} fontWeight={700} fill={INK} fontFamily={FIG}>
          ±1.6%
        </text>
        <polyline points="170,68 185,62 200,64 215,56 230,58 245,50 260,53" fill="none" stroke={BULL} strokeWidth={1.2} />
        <line x1={170} x2={260} y1={68} y2={68} stroke="#ffffff" strokeOpacity={0.12} strokeDasharray="2 2" />
        <text x={404} y={50} textAnchor="end" fontSize={w} fill={MUTED} fontFamily={FIG}>
          Premium
        </text>
        <text x={404} y={67} textAnchor="end" fontSize={w * 1.3} fontWeight={700} fill={INK} fontFamily={FIG}>
          $0.75
        </text>
        <path d="M 16 93 l 4 -7 l 4 7 z" fill="none" stroke={WARN} strokeWidth={1} />
        <text x={30} y={94} fontSize={w} fill={WARN} fontFamily={FIG}>
          Breaks above <tspan fontWeight={700}>$121.26</tspan>
        </text>
        <rect x={342} y={81} width={62} height={18} rx={3} fill="none" stroke="#2a2a2a" />
        <text x={373} y={94} textAnchor="middle" fontSize={w} fill={SECOND} fontFamily={FIG}>
          Open ↗
        </text>
      </>
    )}
  </Figure>
);

/* The four states, as the chips they wear */
const StatesFigure = () => (
  <Figure label="Four state chips in a row: Watch and Fading muted, Active and Moving white, Moving with a pulsing dot" h={56}>
    {({ w }) => (
      <>
        {[
          { x: 10, cw: 74, t: 'Watch', lit: false },
          { x: 92, cw: 74, t: 'Active', lit: true },
          { x: 174, cw: 76, t: 'Moving', lit: true },
          { x: 258, cw: 74, t: 'Fading', lit: false },
        ].map(c => (
          <g key={c.t}>
            <rect x={c.x} y={6} width={c.cw} height={20} rx={3} fill="#ffffff" fillOpacity={c.lit ? 0.08 : 0.03} stroke={c.lit ? 'none' : '#2a2a2a'} />
            <circle cx={c.x + 11} cy={16} r={2.2} fill={c.lit ? INK : MUTED} />
            <text x={c.x + c.cw / 2 + 6} y={20} textAnchor="middle" fontSize={w} fontWeight={700} fill={c.lit ? INK : SECOND} fontFamily={FIG}>
              {c.t}
            </text>
          </g>
        ))}
        {/* one line under the chips — beside them it ran past the figure's edge */}
        <text x={10} y={46} fontSize={w} fill={MUTED} fontFamily={FIG}>
          left to right: proving → in place → trading → retiring
        </text>
      </>
    )}
  </Figure>
);

/* The rail: one row of the heaviest contracts, the ranked column bright with its bar */
const RailFigure = () => (
  <Figure label="Two rows of the heaviest contracts: #1 NVDA 125P and #2 NVDA 127.50C, four facts under their heads — gamma share lit with a bar, volume over open interest, distance from spot, exposure in its sign's ink" h={102}>
    {({ w }) => (
      <>
        <g fontFamily={FIG} fontSize={w} fill={MUTED}>
          <text x={12} y={14} fill={INK}>
            Gamma
          </text>
          <text x={112} y={14}>Vol/OI</text>
          <text x={212} y={14}>From spot</text>
          <text x={312} y={14}>Exposure</text>
        </g>
        <line x1={12} x2={52} y1={18} y2={18} stroke={INK} strokeWidth={0.8} />
        <line x1={0} x2={420} y1={23} y2={23} stroke="#ffffff" strokeOpacity={0.08} />
        {[
          { y: 42, r: '#1', c: 'NVDA 125', s: 'P', g: '10.6%', v: '1.51×', d: '−0.5%', e: '$94.6M', bar: 1, ink: BEAR },
          { y: 78, r: '#2', c: 'NVDA 127.50', s: 'C', g: '7.1%', v: '1.47×', d: '+1.4%', e: '−$63.0M', bar: 0.67, ink: BULL },
        ].map(row => (
          <g key={row.r}>
            <text x={12} y={row.y} fontSize={w} fill={MUTED} fontFamily={FIG}>
              {row.r}
            </text>
            <text x={36} y={row.y} fontSize={w} fontWeight={600} fill={INK} fontFamily={FIG}>
              {row.c}
              <tspan fill={row.ink}>{row.s}</tspan>
            </text>
            <text x={140} y={row.y} fontSize={w} fill={MUTED} fontFamily={FIG}>
              0DTE
            </text>
            <text x={12} y={row.y + 15} fontSize={w} fontWeight={700} fill={INK} fontFamily={FIG}>
              {row.g}
            </text>
            <rect x={12} y={row.y + 19} width={80} height={2} rx={1} fill="#ffffff" fillOpacity={0.07} />
            <rect x={12} y={row.y + 19} width={80 * row.bar} height={2} rx={1} fill={row.ink} fillOpacity={0.8} />
            <text x={112} y={row.y + 15} fontSize={w} fill={SECOND} fontFamily={FIG}>
              {row.v}
            </text>
            <text x={212} y={row.y + 15} fontSize={w} fill={SECOND} fontFamily={FIG}>
              {row.d}
            </text>
            <text x={312} y={row.y + 15} fontSize={w} fontWeight={600} fill={row.e.startsWith('−') ? BULL : BEAR} fontFamily={FIG}>
              {row.e}
            </text>
          </g>
        ))}
      </>
    )}
  </Figure>
);

export const CompassGuide = () => (
  <div data-compass-guide>
    <Section title="A card">
      <p>One setup: its rank, its name in its lean&apos;s ink, its expiration category and date, and its state; under them its structure with its legs, and its tags. A single leg — a long call or a long put — shows the one-sigma move to expiry, the stock&apos;s line today and the premium, and the amber line is the stock price that retires it. Pressing a card selects it, and the heaviest contracts beside the board follow its name; Open, or a second press, opens its page. A target hit since the sweep found the setup shows as a green chip.</p>
      <p className="mt-2">
        A structure names itself on its chip — &ldquo;SPY 470/465 put spread&rdquo;, &ldquo;AVGO 167.50 put&rdquo;, &ldquo;SPY 475 straddle&rdquo; — in the ink of the way it leans: a credit put spread or a
        cash-secured put leans up, so green; a straddle or a strangle leans neither way, so the plain ink. Its figures are its own, per share as a premium is quoted, each leg priced as the board prices
        every contract: a debit spread&apos;s net debit, max loss (the debit) and max gain (the width less the debit); a credit put spread&apos;s credit and max loss (the width less the credit); a
        cash-secured put&apos;s credit and the cash set aside (the strike × 100, per contract); a long straddle&apos;s or strangle&apos;s total cost. In place of the stock&apos;s line and the amber line it
        shows where it breaks even at expiry — two prices for a straddle or a strangle.
      </p>
      <CardFigure />
    </Section>
    <Section title="The states">
      <p>Watch is on the board but not proven. Active means the level structure is in place. Moving means the contract now trades like its trade. Fading means it is retiring.</p>
      <StatesFigure />
    </Section>
    <Section title="Expiry">
      <p>
        A category or a date. 0DTE is a contract whose last trading day is today — read off each name&apos;s own listed dates, so a name with nothing ending today has no 0DTE and still has every other
        category. The last trading day is not always the expiration date: an AM-settled contract, such as SPX&apos;s third-Friday monthly, stops trading the session before. A half day ends at 1:00 pm New
        York. After the close, and on a weekend or a holiday, the 0DTE list is the next session&apos;s, and says so. The rest are counted in calendar days to the last trading day: Weekly 1 to 7, Swing 8 to
        45, Position 46 to 90, Long-Dated 91 or more — and a long-dated contract with more than about nine months left wears LEAPS. A contract with one day left carries an Overnight note: a single night is
        a big share of its life. On the calendar, the lit days are the dates the board&apos;s names list; picking one shows only that date, and All expiries clears it.
      </p>
    </Section>
    <Section title="Kind">
      <p>
        Two sections. Main: Top Setups, Quick Scalps (same-day contracts on index products only), Trend Plays, Breakouts, Bounces, Earnings &amp; Events (the buying side), Cheap Options and All Setups.
        Advanced: Premium Selling, Volatility (options cheap or rich against their own history, and long straddles and strangles for expansion), Flow &amp; Positioning (context) and Events (the implied
        move against what followed, around earnings and Fed days). The selling side of event premium is under Premium Selling. A kind lists its setups whatever their structure; its count is the board it
        would show.
      </p>
    </Section>
    <Section title="Top Setups">
      <p>
        The few strongest across every kind and every option type: the strongest single leg, spread, put sale and straddle or strangle the sweep found, then the strongest of the rest — a contract once,
        at most two a name, no name ahead of another for being that name. Once the engine gives each setup what it is expected to keep after its costs and the deepest drop it is expected to see on the
        way, Top Setups will put the most kept for the least drawn down first. Until then it follows the sweep&apos;s own order.
      </p>
    </Section>
    <Section title="Option type and tags">
      <p>
        The option type narrows the kind by structure, and every kind opens on All types. Picking another kind keeps the type, unless the type has nothing in that kind — then it goes back to All types.
        A type with nothing in the kind stays listed with its 0, greyed, and the keys pass over it.
      </p>
      <p className="mt-2">
        Calls &amp; Puts are long calls and long puts — Steady is the higher-delta legs on the board, nearest the money (deep in-the-money legs when the chain lists them); Big Payoff is further out of
        the money, at a lower delta, where a move pays a larger share. Spreads are debit call and put spreads; Premium Selling is credit put spreads and cash-secured puts; Volatility is long straddles
        and strangles. A structure follows its setup&apos;s direction: one found as a call may show as a long call, a debit call spread, a credit put spread or a cash-secured put; one found as a put as a
        long put or a debit put spread; a straddle or a strangle comes only from the Volatility kind&apos;s own setups. Calendars, diagonals, iron condors and iron flies come later, after testing.
        Unusual Activity marks significant options flow that agrees with the setup; Penny Precision, on put sales alone, marks a setup that helps identify potential short-strike levels.
      </p>
      <p className="mt-2">While the pointer or the keys are on the board, the cards hold their places; a new order from the sweep waits until they leave.</p>
    </Section>
    <Section title="The heaviest contracts">
      <p>Beside the board, the contracts that carry the most weight on the selected card's name. Click a column head to rank by it; the ranked column lights up with a bar. A row opens that contract's page.</p>
      <RailFigure />
    </Section>
  </div>
);
