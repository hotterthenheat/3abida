/*
==================================================
  SLAYER TERMINAL - LANDING (/)
  Statement-first hero over the Spline ribbon, then
  the product proves itself: every section below the
  fold runs the real panels on the simulated feed.
==================================================
*/

import { useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Check, ChevronDown } from 'lucide-react';
import { SEED_IDEAS } from '../../data/community';
import { useLaunch } from '../../components/layout/LaunchTransition';
import SiteFooter from '../../components/layout/SiteFooter';
import { ComparePlans, Faq } from './PricingExtras';
import CodeRain from './CodeRain';
import LiveSections from './LiveSections';
import TiltBox from './TiltBox';
import Reveal from './Reveal';

const NAV_LINKS = [
  { label: 'Product', href: '#showcase' },
  { label: 'Engines', href: '#live' },
  { label: 'Pulse', href: '#pulse' },
  { label: 'Pricing', href: '#pricing' },
];

const TIERS = [
  {
    name: 'Pinpoint',
    kicker: 'The dealer-GEX terminal',
    price: '$125',
    period: '/mo',
    features: [
      'Live strike pressure — GEX · DEX · VEX',
      'Gamma exposure by strike',
      '0DTE levels & dealer dynamics',
      'Trace + Pulse',
      'Tracker — setups & trade history',
      'Real-time Discord chat & alerts',
    ],
    cta: 'Select plan',
    to: '/pulse',
    featured: false,
  },
  {
    name: 'Compass',
    kicker: 'Everything included',
    price: '$275',
    period: '/mo',
    features: [
      'Everything in Pinpoint',
      'Compass — graded setups with live states',
      'Stocks, News & Earnings research desks',
      'Chain momentum, live',
      'Quant Lab — backtester, order flow & momentum',
    ],
    cta: 'Select plan',
    to: '/pulse',
    featured: true,
  },
  {
    name: 'Lifetime',
    kicker: 'Everything, forever',
    price: 'Custom',
    period: 'talk to us',
    features: [
      'Everything in Compass — forever',
      'One payment, no recurring billing',
      'Private 1-on-1 onboarding',
      'Early beta access to new tools',
    ],
    cta: 'Contact us',
    to: 'mailto:info@slayerterminal.com',
    featured: false,
  },
];

/** Anchor / route / mailto — one link component so columns stay declarative.
    Links into the terminal play the launch gate instead of jumping. */
const SmartLink = ({ to, className, children }: { to: string; className: string; children: React.ReactNode }) => {
  const { launch } = useLaunch();
  if (to === '/pulse') {
    return (
      <a
        href={to}
        className={className}
        onClick={e => {
          e.preventDefault();
          launch(to);
        }}
      >
        {children}
      </a>
    );
  }
  return to.startsWith('/') ? (
    <Link to={to} className={className}>
      {children}
    </Link>
  ) : (
    <a href={to} className={className}>
      {children}
    </a>
  );
};

/** Floating glass nav. Clicking a tab glides the page to its section while a
    lime pill springs to the tab — same selection grammar as the terminal. */
const GlassNav = () => {
  const [active, setActive] = useState<string | null>(null);

  const go = (href: string) => (e: MouseEvent) => {
    e.preventDefault();
    setActive(href);
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header className="fixed top-0 inset-x-0 z-40 flex justify-center px-4 pt-4">
      <div className="w-full max-w-5xl flex items-center gap-6 rounded-xl border border-ink/10 bg-ink/[0.045] backdrop-blur-xl px-5 py-2.5 shadow-lg shadow-black/40">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="font-mono text-[13px] font-bold tracking-tight whitespace-nowrap select-none"
        >
          <span className="text-textMuted">&gt; </span>
          {/* White out here — the wordmark only turns holo INSIDE the terminal */}
          <span className="text-textPrimary">slayer_terminal</span>
          <span className="inline-block w-[6px] h-[12px] ml-1 bg-textPrimary align-middle animate-cursor-blink" />
        </button>
        <nav className="hidden md:flex items-center gap-1.5 ml-auto">
          {NAV_LINKS.map(l => {
            const isActive = active === l.href;
            return (
              <motion.a
                key={l.label}
                href={l.href}
                onClick={go(l.href)}
                whileHover={{ scale: 1.08, y: -1 }}
                whileTap={{ scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 500, damping: 14 }}
                className="relative px-3 py-1.5 rounded-full font-mono text-[11px] uppercase tracking-wider"
              >
                {isActive && (
                  <motion.span
                    layoutId="glass-nav-pill"
                    className="absolute inset-0 rounded-full"
                    style={{ background: 'rgba(237,237,237,0.95)' }}
                    transition={{ type: 'spring', stiffness: 320, damping: 17 }}
                  />
                )}
                <span
                  className={`relative z-10 transition-colors ${
                    isActive ? 'text-[#0a0a0a] font-bold' : 'text-textSecondary hover:text-textPrimary'
                  }`}
                >
                  {l.label}
                </span>
              </motion.a>
            );
          })}
        </nav>
        <SmartLink
          to="/pulse"
          className="ml-auto md:ml-0 shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md font-mono text-[11px] font-semibold uppercase tracking-wider text-[#0a0a0a] holo-bg transition-transform hover:scale-[1.03]"
        >
          Launch terminal <ArrowRight className="w-3.5 h-3.5" />
        </SmartLink>
      </div>
    </header>
  );
};

const Landing = () => (
  <div className="min-h-screen bg-canvas text-textPrimary overflow-x-hidden" data-theme="dark">
    <GlassNav />

    {/* ── Hero: the statement. The product waits one scroll below. ── */}
    <section className="relative h-[94vh] min-h-[620px]">
      <div className="absolute inset-0">
        {/* Terminal code-rain IS the hero scene — faint columns of Slayer
            output twinkling in the dark. The cursor is a flashlight: only
            near it does the code turn legible. */}
        <CodeRain className="pointer-events-none" />
        {/* Bottom fade — the rain dissolves into the first section */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-canvas" />
      </div>

      {/* pointer-events-none so the hero copy never blocks the flashlight's
          feel of open space; the CTAs re-enable their own pointer events. */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6 pointer-events-none">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.3em] holo-text">
          Dealer-flow analytics
        </span>
        <h1 className="mt-5 text-4xl md:text-6xl font-bold tracking-tight leading-[1.04] max-w-3xl">
          See the forces that
          <br />
          move the market.
        </h1>
        <p className="mt-6 max-w-xl text-[15px] md:text-base text-textSecondary leading-relaxed">
          Market makers have to hedge. That hedging pushes price toward some levels and away from
          others — every session, mechanically. Slayer maps those forces, then grades the trades.
        </p>

        <div className="mt-9 flex items-center gap-4 flex-wrap justify-center">
          <SmartLink
            to="/pulse"
            className="pointer-events-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-md font-mono text-[13px] font-semibold uppercase tracking-wider text-[#0a0a0a] holo-bg holo-glow transition-transform hover:scale-[1.03]"
          >
            Launch terminal <ArrowRight className="w-4 h-4" />
          </SmartLink>
          <a
            href="#showcase"
            className="pointer-events-auto inline-flex items-center px-5 py-2.5 rounded-md border border-borderMuted bg-canvas/40 font-mono text-[13px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:bg-ink/[0.04] transition-colors"
          >
            See it live
          </a>
        </div>
      </div>

      {/* Scroll cue */}
      <a
        href="#showcase"
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 text-textMuted hover:text-textSecondary transition-colors"
      >
        <span className="font-mono text-[9px] uppercase tracking-[0.3em]">Scroll</span>
        <ChevronDown className="w-4 h-4 animate-bounce" />
      </a>
    </section>

    {/* ── Showcase → marquee → pillars → live engines → story → workspace ── */}
    <LiveSections />

    {/* ── Community ── */}
    <section className="px-6 md:px-10 py-20 max-w-6xl mx-auto">
      <Reveal>
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-textSecondary">
          Community
        </span>
        <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">Built in the open.</h2>
        <p className="mt-4 text-[14px] text-textSecondary leading-relaxed max-w-xl">
          Trade ideas, feature requests, feedback — posted inside the terminal, voted on by the people
          trading with it. What ships next is decided out loud.
        </p>
      </Reveal>
      <Reveal delay={0.1} className="mt-8 border border-borderSubtle bg-panel rounded-lg overflow-hidden">
        {SEED_IDEAS.slice(0, 3).map(idea => (
          <div
            key={idea.id}
            className="flex items-center gap-4 px-5 py-4 border-b border-borderSubtle/50 last:border-0"
          >
            <span className="flex flex-col items-center w-9 shrink-0 border border-borderSubtle rounded-md py-1.5">
              <span className="font-mono text-[12px] font-bold text-textPrimary tnum">{idea.votes}</span>
            </span>
            <span className="font-mono text-[12px] font-bold text-textPrimary shrink-0">{idea.ticker}</span>
            <span
              className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                idea.direction === 'BULLISH' ? 'bg-bull/10 text-bull' : 'bg-bear/10 text-bear'
              }`}
            >
              {idea.direction}
            </span>
            <span className="text-[12px] text-textSecondary truncate">"{idea.thesis}"</span>
            <span className="ml-auto hidden md:block font-mono text-[10px] text-textMuted shrink-0">
              {idea.author}
            </span>
          </div>
        ))}
        <Link
          to="/community"
          className="flex items-center justify-center gap-1.5 py-3 font-mono text-[11px] uppercase tracking-wider text-textSecondary hover:text-select hover:bg-ink/[0.02] transition-colors"
        >
          Open the community <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </Reveal>
    </section>

    {/* ── Pricing ── */}
    <section id="pricing" className="px-6 md:px-10 py-20 max-w-5xl mx-auto">
      <Reveal>
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-textSecondary">
          Pricing
        </span>
      </Reveal>
      <Reveal delay={0.1} className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
        {TIERS.map(tier => (
          <TiltBox
            key={tier.name}
            maxTilt={4}
            className={tier.featured ? 'border-silver/60 bg-ink/[0.03] holo-glow' : ''}
          >
            <div className="h-full p-6 flex flex-col gap-4">
              {/* Badge lives inside the card — TiltBox clips overflow, so a
                  border-straddling chip would get cut in half. */}
              {tier.featured && (
                <span className="self-start inline-flex px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase tracking-widest text-[#0a0a0a] holo-bg">
                  Most popular
                </span>
              )}
              <div>
                <h3 className="text-[15px] font-bold text-textPrimary tracking-tight">{tier.name}</h3>
                <span className="block mt-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-textMuted">
                  {tier.kicker}
                </span>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold tracking-tight text-textPrimary tnum">{tier.price}</span>
                  <span className="font-mono text-[11px] text-textMuted">{tier.period}</span>
                </div>
              </div>
              <ul className="flex flex-col gap-2.5">
                {tier.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-[12px] text-textSecondary leading-snug">
                    <Check
                      className={`w-3.5 h-3.5 shrink-0 mt-px ${tier.featured ? 'text-silver' : 'text-textMuted'}`}
                    />
                    {f}
                  </li>
                ))}
              </ul>
              <SmartLink
                to={tier.to}
                className={`mt-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md font-mono text-[12px] font-semibold uppercase tracking-wider transition-colors ${
                  tier.featured
                    ? 'holo-bg text-[#0a0a0a] hover:brightness-105'
                    : 'border border-borderMuted text-textSecondary hover:text-textPrimary hover:bg-ink/[0.03]'
                }`}
              >
                {tier.cta}
              </SmartLink>
            </div>
          </TiltBox>
        ))}
      </Reveal>
      <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-wider text-textMuted">
        Prices in USD · sign in to check out — access is granted at payment · cancel anytime
      </p>

      <ComparePlans />
    </section>

    {/* ── FAQ ── */}
    <Faq />

    {/* ── Closing CTA ── */}
    <section className="px-6 md:px-10 py-24 border-t border-borderSubtle text-center">
      <Reveal>
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight max-w-2xl mx-auto">
        Trade with the machine,
        <br />
        not against it.
      </h2>
      <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
        <SmartLink
          to="/pulse"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md font-mono text-[13px] font-semibold uppercase tracking-wider text-[#0a0a0a] holo-bg transition-transform hover:scale-[1.03]"
        >
          Launch terminal <ArrowRight className="w-4 h-4" />
        </SmartLink>
        <a
          href="#pricing"
          className="inline-flex items-center px-5 py-2.5 rounded-md border border-borderMuted font-mono text-[13px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:bg-ink/[0.03] transition-colors"
        >
          See pricing
        </a>
      </div>
      </Reveal>
    </section>

    {/* ── Footer ── shared with every terminal page (SiteFooter); `home`
        keeps the landing's anchor + launch-gate behavior */}
    <SiteFooter home />
  </div>
);

export default Landing;
