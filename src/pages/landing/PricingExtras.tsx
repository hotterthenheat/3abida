/*
==================================================
  SLAYER TERMINAL - PRICING EXTRAS (landing)
  "What each tier unlocks" additive ladder + FAQ as
  a terminal transcript. Feature rows are OUR pages
  and engines; the presentation is house grammar —
  no borrowed compare-matrix or accordion patterns.
==================================================
*/

import { Clock } from 'lucide-react';
import Reveal from './Reveal';

// ---- what each tier unlocks --------------------------------------------------
// Not a checkmark matrix: each tier lists ONLY what it adds on top of the one
// before it. Reads in seconds, and the middle tier carries the house silver.

interface LadderItem {
  label: string;
  detail: string;
  soon?: boolean;
}

interface LadderTier {
  name: string;
  kicker: string;
  featured?: boolean;
  /** The tier this one builds on — null for the base */
  inherits: string | null;
  items: LadderItem[];
}

const LADDER: LadderTier[] = [
  {
    name: 'Pinpoint',
    kicker: 'the structure desk',
    inherits: null,
    items: [
      { label: 'Pulse', detail: 'Chart with walls, flip & supreme, dealer pressure, order flow' },
      { label: 'Pinpoint', detail: 'GEX · DEX · VEX by strike — the strike pressure ladder & exposure matrix' },
      { label: 'Ranked Targets', detail: 'Every strike ranked by structural priority — the levels that matter today' },
      { label: 'Trace', detail: 'Streaming options tape, sweeps, blocks & dark-pool intelligence' },
      { label: 'Tracker & the Pulse desk', detail: 'Bookmarked setups with live monitoring, saved desk layouts' },
      { label: 'Discord chat & alerts', detail: 'Real-time community and setup alerts to your phone' },
    ],
  },
  {
    name: 'Compass',
    kicker: 'the graded-setups desk',
    featured: true,
    inherits: 'Pinpoint',
    items: [
      { label: 'Compass', detail: 'Graded setups — ACTIVE, WATCH or FADING, explained in plain English' },
      { label: 'Stocks', detail: 'Sector rotation ranked, every name screened on momentum, quality, flow & news' },
      { label: 'News', detail: 'The wire on the left, what the model thinks it does to price on the right' },
      {
        label: 'Earnings',
        detail: 'Week calendar with our expected move, plus a dossier per company — beats, past reactions, probabilities',
      },
      { label: 'Vanna & Charm', detail: 'How the levels migrate as time decays and volatility shifts' },
      { label: 'Chain momentum reads', detail: 'Live momentum & desk action across the whole chain' },
      { label: 'Quant Lab', detail: 'Backtester, order flow & momentum research tools', soon: true },
    ],
  },
  {
    name: 'Lifetime',
    kicker: 'the founder tier',
    inherits: 'Compass',
    items: [
      { label: 'Private 1-on-1 onboarding', detail: 'A dedicated session to set up your desk' },
      { label: 'Early beta access', detail: 'New tools before they ship to everyone' },
    ],
  },
];

export const ComparePlans = () => (
  <div className="mt-16">
    <Reveal className="text-center">
      <h3 className="text-2xl md:text-3xl font-bold tracking-tight">What each tier unlocks</h3>
      <p className="mt-2 text-[13px] text-textSecondary">
        Every tier contains the one before it — you only ever pay for what gets added.
      </p>
    </Reveal>
    <Reveal delay={0.08} className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
      {LADDER.map(tier => (
        <div
          key={tier.name}
          className={`rounded-lg border p-5 flex flex-col gap-4 ${
            tier.featured ? 'border-silver/60 bg-ink/[0.03]' : 'border-borderSubtle bg-panel'
          }`}
        >
          <div>
            <span
              className={`font-mono text-[12px] font-bold uppercase tracking-widest ${
                tier.featured ? 'holo-text' : 'text-textPrimary'
              }`}
            >
              {tier.name}
            </span>
            <span className="block mt-0.5 font-mono text-[10px] uppercase tracking-widest text-textMuted">
              {tier.kicker}
            </span>
          </div>
          {tier.inherits && (
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-textSecondary border-y border-borderSubtle py-2">
              <span className="text-textMuted">+</span> everything in {tier.inherits}, plus
            </div>
          )}
          <ul className="flex flex-col gap-3">
            {tier.items.map(item => (
              <li key={item.label} className="flex items-start gap-2.5">
                <span
                  className={`mt-[5px] w-1.5 h-1.5 rounded-[2px] shrink-0 ${
                    tier.featured ? 'bg-silver' : 'bg-ink/40'
                  }`}
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-[13px] font-bold text-textPrimary tracking-tight">
                    {item.label}
                    {item.soon && (
                      <span className="inline-flex items-center gap-1 rounded border border-warn/30 bg-warn/10 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-widest text-warn">
                        <Clock className="w-2.5 h-2.5" /> Soon
                      </span>
                    )}
                  </span>
                  <span className="block mt-0.5 text-[11px] text-textSecondary leading-snug">{item.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Reveal>
  </div>
);

// ---- FAQ: a terminal transcript ---------------------------------------------
// No accordion — every question is a prompt line, every answer its output,
// all visible. The page talks the way the product does.

const FAQS = [
  {
    q: 'Do you offer alerts and signals?',
    a: "Alerts, yes — signals, no. Slayer never tells you to enter anything. Compass surfaces the setups where the confluences line up — structure, flow, volatility — grades each one 0–100, and carries a live state: ACTIVE while the thesis holds, WATCH while it proves itself, FADING when the structure breaks. Discord pings you the moment one appears. What you do with it is entirely yours.",
  },
  {
    q: 'Is the data live?',
    a: 'Yes. Every panel runs on live market data — the tape, the walls, the greeks and the dark-pool prints all update in real time through the session.',
  },
  {
    q: 'What makes Slayer different from other GEX tools?',
    a: "Every GEX tool can draw a flip and a wall — the structure itself is table stakes. Slayer's difference is everything after the map: it reads structure, tape, dark pool and volatility as one confluence, weighs the actual contracts against it, keeps reading the idea live while it plays out, and keeps its own record on the page — every state change a setup goes through stays visible. The map is a commodity. An engine that stands behind its reads isn't.",
  },
  {
    q: 'Do I need to be an options expert?',
    a: 'No. Every page explains itself in plain English — what a wall is, why the flip matters, what dealers are forced to do at each level. Real trading terms stay; jargon and buzzwords were deliberately purged.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes — subscriptions are month to month and stop at the end of your billing cycle, no questions. Lifetime is a single payment, forever. Billing questions: info@slayerterminal.com.',
  },
];

export const Faq = () => (
  <section id="faq" className="px-6 md:px-10 py-20 max-w-3xl mx-auto">
    <Reveal className="text-center">
      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-textSecondary">FAQ</span>
      <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
        Questions, <span className="text-textMuted">answered.</span>
      </h2>
    </Reveal>
    <Reveal
      delay={0.08}
      className="mt-10 border border-borderSubtle bg-panel rounded-lg px-6 py-6 flex flex-col gap-6"
    >
      {FAQS.map(item => (
        <div key={item.q}>
          <p className="font-mono text-[13px] font-semibold text-textPrimary">
            <span className="text-textMuted">&gt; </span>
            {item.q}
          </p>
          <p className="mt-2 ml-[7px] pl-4 border-l border-borderSubtle text-[13px] text-textSecondary leading-relaxed">
            {item.a}
          </p>
        </div>
      ))}
      {/* the session stays open */}
      <p className="font-mono text-[13px] text-textMuted select-none leading-none">
        &gt;
        <span className="inline-block w-[6px] h-[12px] ml-1.5 bg-textPrimary align-middle animate-cursor-blink" />
      </p>
    </Reveal>
  </section>
);
