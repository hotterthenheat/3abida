/*
==================================================
  SLAYER TERMINAL - SETTINGS (pages/settings/Settings.tsx)

  How the terminal looks, what the desk opens on,
  what it says out loud (Noah, 2026-09-12: "creating
  the skeleton for the settings page and
  incorporating just the theme light and dark
  mode"). The shape he took from the mockup: the
  shell head wearing the house mark, a rail of
  sections at the left, and each setting as a ROW —
  the name and one line at the left, the control at
  the right, hairlines between — the way Linear
  lays its preferences. No cards for facts.

  ONE RULE: a control exists only when it does
  something today. Account, billing and the data
  provider are rows that say they arrive with the
  launch, never a switch that does nothing.

  THE THEME TILES draw the terminal itself in each
  theme — the tokens are scoped by `data-theme` on
  any element (theme/tokens.css), so a tile is the
  real palette, not a picture of one.

  Every choice saves as you go: the theme through
  theme/theme.ts, the candles through the candle
  theme store every chart reads, the ruler through
  the desk-wide unit.
==================================================
*/

import { useEffect, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CreditCard, Info, Keyboard, LayoutDashboard, Palette, Plug, UserRound, type LucideIcon } from 'lucide-react';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import { CANDLE_THEME_OPTIONS, setCandleTheme, useCandleThemeKey, type CandleThemeKey } from '../../components/gex/candleTheme';
import { setDistanceUnit, useDistanceUnit } from '../../data/distanceUnits';
import type { DistanceUnit } from '../../data/atr';
import { setThemeChoice, useResolvedTheme, useThemeChoice, type ThemeChoice } from '../../theme/theme';

/* ---- the sections ------------------------------------------------------------- */

/* EACH SECTION IS ITS OWN PAGE (Noah, 2026-09-12: "the subtabs should be
   subpages not all on the same page. transition should be smooth") —
   /settings/<id>, the rail a row of links, one box at a time, the box
   arriving on a short cross-fade. /settings alone lands on Appearance. */
export type SettingsSection = 'appearance' | 'desk' | 'keyboard' | 'account' | 'billing' | 'data' | 'about';
export const SETTINGS_SECTIONS: SettingsSection[] = ['appearance', 'desk', 'keyboard', 'account', 'billing', 'data', 'about'];
const isSection = (v: string | undefined): v is SettingsSection => (SETTINGS_SECTIONS as string[]).includes(v ?? '');

const SECTIONS: { id: SettingsSection; label: string; icon: LucideIcon; soon?: boolean }[] = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'desk', label: 'The desk', icon: LayoutDashboard },
  { id: 'keyboard', label: 'Keyboard', icon: Keyboard },
  { id: 'account', label: 'Account', icon: UserRound, soon: true },
  { id: 'billing', label: 'Billing', icon: CreditCard, soon: true },
  { id: 'data', label: 'Data', icon: Plug, soon: true },
  { id: 'about', label: 'About', icon: Info },
];

const THEME_WORDS: Record<ThemeChoice, [string, string]> = {
  dark: ['Dark', 'The terminal as it is'],
  light: ['Light', 'A first cut, walked page by page'],
  system: ['Match the system', "Follows the machine's own setting"],
};

/** The desk's ruler: the unit every distance on Pinpoint is read in (the shell head's card, here too) */
const RULER_OPTIONS: DropdownOption<DistanceUnit>[] = [
  { value: '$', label: '$', hint: 'Dollars from spot' },
  { value: '%', label: '%', hint: 'Percent of spot' },
  { value: 'ATR', label: 'ATR', hint: 'Average true ranges — the same distance on SPY and on NVDA' },
  { value: 'σ', label: 'σ', hint: 'Expected one-day moves — how many the options price in' },
];

const SHORTCUTS: { keys: string[]; does: string }[] = [
  { keys: ['Ctrl', 'K'], does: 'Search a name or a page from anywhere' },
  { keys: ['P'], does: 'Replay on a chart — pick a bar, then play' },
  { keys: ['Alt', 'R'], does: "Reset a chart's view" },
  { keys: ['Esc'], does: 'Close what is open — a menu, the alerts, fullscreen, a replay' },
  { keys: ['Ctrl', 'S'], does: 'Save the script in the editor' },
  { keys: ['Ctrl', 'Enter'], does: 'Run the script on its chart' },
];

/** The version the About box prints — package.json's, by hand until the build stamps it */
const VERSION = '1.0.0';

/* ---- the pieces --------------------------------------------------------------- */

/** The house mark — the sidebar's `>_` chip, the door home there, the badge here */
const Mark = ({ size = 24 }: { size?: number }) => (
  <span className="holo-bg rounded-[7px] shrink-0 inline-flex items-center justify-center font-mono font-bold text-[#0a0a0a]" style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }} aria-hidden>
    &gt;_
  </span>
);

/** A box of rows: the head, then the rows under hairlines */
const Section = ({ id, title, line, children }: { id: string; title: string; line: string; children: ReactNode }) => (
  <section id={id} className="border border-borderSubtle rounded-md bg-panel overflow-clip scroll-mt-5" data-settings-section={id}>
    <div className="px-5 pt-4 pb-3">
      <h2 className="text-[15px] font-semibold leading-tight text-textPrimary">{title}</h2>
      <p className="mt-0.5 text-[11px] text-textMuted">{line}</p>
    </div>
    {children}
  </section>
);

/** One setting: the name and its line at the left, the control at the right */
const Row = ({ name, line, children, testId }: { name: string; line: string; children?: ReactNode; testId: string }) => (
  <div className="px-5 py-3 border-t border-borderSubtle/60 flex items-center justify-between gap-6" data-settings-row={testId}>
    <div className="min-w-0">
      <div className="text-[12px] text-textPrimary">{name}</div>
      <div className="text-[11px] text-textMuted">{line}</div>
    </div>
    <div className="shrink-0 flex items-center gap-2">{children}</div>
  </div>
);

/** A row whose control arrives with the launch — the words say so; no dead switch */
const Later = ({ name, line, testId }: { name: string; line: string; testId: string }) => (
  <Row name={name} line={line} testId={testId}>
    <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted border border-borderSubtle rounded px-2 py-0.5 whitespace-nowrap">with the launch</span>
  </Row>
);

/** The terminal, small, in one theme — real tokens under a scoped attribute */
const Mini = ({ theme }: { theme: 'dark' | 'light' }) => (
  <div data-theme={theme} className="relative h-full w-full bg-canvas overflow-hidden" aria-hidden>
    <div className="absolute inset-y-0 left-0 w-[22%] bg-panel border-r border-borderSubtle" />
    <div className="absolute left-[30%] top-[11%] h-[5px] w-[38%] rounded-[2px] bg-textPrimary" />
    <div className="absolute left-[30%] right-[8%] top-[27%] h-px bg-borderSubtle" />
    <div className="absolute left-[30%] right-[36%] top-[38%] bottom-[10%] rounded-[3px] border border-borderSubtle bg-panel" />
    <div className="absolute right-[8%] top-[38%] bottom-[10%] w-[24%] rounded-[3px] border border-borderSubtle bg-panel" />
    <span className="absolute left-[38%] top-[56%] h-[22%] w-[2px] rounded-full bg-bull" />
    <span className="absolute left-[44%] top-[50%] h-[30%] w-[2px] rounded-full bg-bear" />
    <span className="absolute left-[50%] top-[60%] h-[18%] w-[2px] rounded-full bg-bull" />
    <span className="absolute left-[56%] top-[52%] h-[26%] w-[2px] rounded-full bg-bull" />
    <span className="absolute right-[13%] top-[48%] h-[5px] w-[12%] rounded-full bg-bull/70" />
    <span className="absolute right-[13%] top-[62%] h-[5px] w-[9%] rounded-full bg-bear/70" />
    <span className="absolute right-[13%] top-[76%] h-[5px] w-[14%] rounded-full bg-bull/70" />
  </div>
);

const ThemeTile = ({ choice, current, onPick }: { choice: ThemeChoice; current: ThemeChoice; onPick: (c: ThemeChoice) => void }) => {
  const on = choice === current;
  const [name, line] = THEME_WORDS[choice];
  return (
    <button
      type="button"
      onClick={() => onPick(choice)}
      aria-pressed={on}
      title={line}
      className={`text-left rounded-md border p-2 transition-colors ${on ? 'border-silver/60 bg-ink/[0.02]' : 'border-borderSubtle hover:border-borderMuted'}`}
      data-theme-tile={choice}
      data-on={on || undefined}
    >
      {/* taller since 2026-09-12 (Noah: "make the appearance boxes taller") — the terminal reads as one */}
      <div className="h-[132px] rounded border border-borderSubtle overflow-hidden">
        {choice === 'system' ? (
          <div className="flex h-full">
            <div className="w-1/2 h-full">
              <Mini theme="dark" />
            </div>
            <div className="w-1/2 h-full">
              <Mini theme="light" />
            </div>
          </div>
        ) : (
          <Mini theme={choice} />
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className={`text-[12px] ${on ? 'text-textPrimary' : 'text-textSecondary'}`}>{name}</span>
        {/* Silver, where you are — never lime */}
        {on && <Check className="w-3.5 h-3.5 text-silver" strokeWidth={2} />}
      </div>
      <div className="text-[11px] text-textMuted">{line}</div>
    </button>
  );
};

const Key = ({ children }: { children: ReactNode }) => (
  <kbd className="inline-flex items-center h-5 px-1.5 rounded border border-borderSubtle bg-chip font-mono text-[10px] text-textSecondary">{children}</kbd>
);

/* ---- the page ----------------------------------------------------------------- */

const Settings = () => {
  const choice = useThemeChoice();
  const theme = useResolvedTheme();
  const candleKey = useCandleThemeKey();
  const unit = useDistanceUnit();

  /* THE SUBPAGE — from the route; a step to another lands at the head */
  const { section } = useParams<{ section?: string }>();
  const current: SettingsSection = isSection(section) ? section : 'appearance';
  useEffect(() => {
    const main = document.querySelector<HTMLElement>('main');
    if (main && main.scrollTop > 0) main.scrollTop = 0;
  }, [current]);
  if (!isSection(section)) return <Navigate to="/settings/appearance" replace />;

  return (
    <>
      {/* THE HEAD — the house mark as the page's chip, the name, one line, the facts */}
      <header className="flex items-start gap-6 flex-wrap pb-3 border-b border-borderSubtle" data-shell data-settings-shell>
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-2.5" data-shell-page>
            <Mark />
            <h1 className="text-[15px] font-semibold leading-tight text-textPrimary">Settings</h1>
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">How the terminal looks, what the desk opens on, what it says out loud</p>
        </div>
        <dl className="grid grid-flow-col auto-cols-max gap-x-6" data-shell-facts>
          <div className="min-w-0">
            <dt className="text-[10px] text-textMuted whitespace-nowrap">Theme</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-settings-theme={theme}>
              {THEME_WORDS[choice][0]}
              {choice === 'system' && <span className="text-textMuted"> · {theme}</span>}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] text-textMuted whitespace-nowrap">Saved</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap">as you go</dd>
          </div>
        </dl>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-[168px_minmax(0,1fr)] gap-4 items-start" data-settings>
        {/* THE RAIL — the subpages, the one open lit */}
        <nav className="xl:sticky xl:top-5 flex xl:flex-col gap-0.5 flex-wrap" aria-label="Settings sections" data-settings-rail>
          {SECTIONS.map((s, i) => {
            const on = s.id === current;
            const Icon = s.icon;
            return (
              <Link
                key={s.id}
                to={`/settings/${s.id}`}
                aria-current={on ? 'page' : undefined}
                className={`flex items-center gap-2 px-2.5 h-8 rounded-md text-[12px] transition-colors text-left ${
                  on ? 'bg-ink/[0.05] text-textPrimary' : s.soon ? 'text-textMuted hover:text-textSecondary' : 'text-textSecondary hover:text-textPrimary hover:bg-ink/[0.03]'
                } ${i === 3 || i === 6 ? 'xl:mt-2' : ''}`}
                data-settings-nav={s.id}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                {s.label}
              </Link>
            );
          })}
        </nav>

        {/* ONE BOX AT A TIME, arriving on a short cross-fade — the old one leaves
            at once, the new one lands on the next frame (the shell's own rule:
            no exit wait, no black gap) with a breath of rise */}
        <AnimatePresence initial={false}>
          <motion.div
            key={current}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-4 min-w-0"
            data-settings-page={current}
          >
          {/* APPEARANCE */}
          {current === 'appearance' && (
          <Section id="appearance" title="Appearance" line="The terminal drawn in each theme, not a swatch — the change lands in the same frame, on every page">
            <div className="px-5 pb-4 border-t border-borderSubtle/60 pt-3">
              <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Theme">
                {(['dark', 'light', 'system'] as ThemeChoice[]).map(c => (
                  <ThemeTile key={c} choice={c} current={choice} onPick={setThemeChoice} />
                ))}
              </div>
            </div>
            <Row name="Candles" line="The chart's own theme — the same menu every chart carries; a light ground lights the chart's frame with it" testId="candles">
              <DropdownSelect<CandleThemeKey> label="Candles" value={candleKey} options={CANDLE_THEME_OPTIONS} onChange={setCandleTheme} title="The colours every chart draws its candles in" testId="settings-candles" align="end" />
            </Row>
          </Section>
          )}

          {/* THE DESK */}
          {current === 'desk' && (
          <Section id="desk" title="The desk" line="What every desk reads by — the name and the timeframe it opens on arrive with the account, which remembers them">
            <Row name="Ruler" line="The unit every distance on Pinpoint is read in — the flip, the walls, the targets" testId="ruler">
              <DropdownSelect<DistanceUnit> label="Ruler" value={unit} options={RULER_OPTIONS} onChange={setDistanceUnit} title="The unit every distance on Pinpoint is read in" testId="settings-ruler" align="end" />
            </Row>
            <Later name="Opens on" line="The name and the timeframe every desk starts on" testId="opens-on" />
            <Later name="Alerts out loud" line="The jingle when one arms, the chime when it fires" testId="alerts-sound" />
            <Later name="Clock" line="New York's time or your own on every axis" testId="clock" />
          </Section>
          )}

          {/* KEYBOARD */}
          {current === 'keyboard' && (
          <Section id="keyboard" title="Keyboard" line="The keys the terminal answers to, wherever you are">
            {SHORTCUTS.map(s => (
              <div key={s.does} className="px-5 py-2.5 border-t border-borderSubtle/60 flex items-center justify-between gap-6" data-settings-key>
                <span className="text-[12px] text-textSecondary">{s.does}</span>
                <span className="inline-flex items-center gap-1 shrink-0">
                  {s.keys.map((k, i) => (
                    <span key={k} className="inline-flex items-center gap-1">
                      {i > 0 && <span className="text-[10px] text-textMuted">+</span>}
                      <Key>{k}</Key>
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </Section>
          )}

          {/* WITH THE LAUNCH */}
          {current === 'account' && (
          <Section id="account" title="Account" line="Who you are to the terminal — sign in, your name, the desks you keep">
            <Later name="Sign in" line="An account carries your board, your marks and your settings between machines" testId="sign-in" />
          </Section>
          )}
          {current === 'billing' && (
          <Section id="billing" title="Billing" line="The plan and the card behind it">
            <Later name="Plan" line="The tier, its data limits and its price" testId="plan" />
          </Section>
          )}
          {current === 'data' && (
          <Section id="data" title="Data" line="Where the tape, the chains and the record come from">
            <Later name="Provider" line="Live options and quotes, dark pool prints, the congressional record — the keys and their tiers" testId="provider" />
          </Section>
          )}

          {/* ABOUT */}
          {current === 'about' && (
          <Section id="about" title="About" line="The terminal, its version, and whose work it stands on">
            <div className="px-5 py-4 border-t border-borderSubtle/60 flex items-center gap-4" data-settings-about>
              <Mark size={40} />
              <div className="min-w-0">
                <div className="font-mono text-[13px] font-bold tracking-tight holo-text">slayer_terminal</div>
                <div className="mt-0.5 font-mono text-[11px] tnum text-textMuted">
                  v{VERSION} · {import.meta.env.MODE}
                </div>
              </div>
              <Link to="/community/feedback" className="ml-auto shrink-0 inline-flex items-center h-7 px-2.5 rounded-md border border-borderSubtle font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors">
                Say something
              </Link>
            </div>
            <Row name="Charts" line="Drawn with TradingView's lightweight-charts, under the Apache 2.0 licence — the mark in the corner is theirs" testId="credit-charts" />
            <Row name="Grids" line="AG Grid Community, under the MIT licence" testId="credit-grids" />
            <Row name="Marks and glyphs" line="Company marks from thesvg.org · icons by Lucide, under the ISC licence" testId="credit-marks" />
          </Section>
          )}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
};

export default Settings;
