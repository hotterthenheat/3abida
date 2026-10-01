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

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, CreditCard, Download, ExternalLink, FileText, Info, Keyboard, LayoutDashboard, LogOut, Mail, MonitorSmartphone, Palette, Plug, Trash2, Upload, UserPlus, UserRound, Volume2, type LucideIcon } from 'lucide-react';
import * as Switch from '@radix-ui/react-switch';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import Modal from '../../components/ui/Modal';
import { MorphingInfinity, useBusy, useWorking } from '../../components/ui/Working';
import Simulator from '../../core/simulator';
import { play, type SoundKind } from '../../core/sound';
import { TIMEFRAMES, type Timeframe } from '../../data/timeframe';
import { setDeskPrefs, useDeskPrefs, type ClockZone } from '../../data/deskPrefs';
import { setProfile, useProfile, type SignInWay } from '../../data/profile';
import PictureDrop from './PictureDrop';
import { PLANS, fmtDate, planOf, setPlan, useBilling, type SubscriptionStatus } from '../../data/billing';
import { CANDLE_THEME_OPTIONS, setCandleTheme, useCandleThemeKey, type CandleThemeKey } from '../../components/gex/candleTheme';
import { setDistanceUnit, useDistanceUnit } from '../../data/distanceUnits';
import type { DistanceUnit } from '../../data/atr';
import { setThemeChoice, useResolvedTheme, useThemeChoice, type ThemeChoice } from '../../theme/theme';
import SlayerMark from '../../brand/SlayerMark';
import Wordmark from '../../brand/Wordmark';
import { COMPANY } from '../../data/company';
import { VERSION as RELEASE } from '../../data/release';

/* ---- the sections ------------------------------------------------------------- */

/* EACH SECTION IS ITS OWN PAGE (Noah, 2026-09-12: "the subtabs should be
   subpages not all on the same page. transition should be smooth") —
   /settings/<id>, the rail a row of links, one box at a time, the box
   arriving on a short cross-fade. /settings alone lands on Account.
   THE ORDER IS THE READER'S PRIORITY (Noah, 2026-09-14: "account and billing
   is the most important, so those should be first"): the reader's own things
   — the account, the plan, the data — then how the terminal looks and works,
   then About. */
export type SettingsSection = 'account' | 'billing' | 'data' | 'appearance' | 'desk' | 'sounds' | 'invite' | 'mail' | 'keyboard' | 'about';
/* "Sounds, invites, mail." (Slayer Logo System, Web and App · Settings, 2026-10-01): three subpages after the desk */
export const SETTINGS_SECTIONS: SettingsSection[] = ['account', 'billing', 'data', 'appearance', 'desk', 'sounds', 'invite', 'mail', 'keyboard', 'about'];
const isSection = (v: string | undefined): v is SettingsSection => (SETTINGS_SECTIONS as string[]).includes(v ?? '');
const HOME_SECTION: SettingsSection = 'account';

const SECTIONS: { id: SettingsSection; label: string; icon: LucideIcon; soon?: boolean }[] = [
  { id: 'account', label: 'Account', icon: UserRound },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'data', label: 'Data', icon: Plug },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'desk', label: 'The desk', icon: LayoutDashboard },
  { id: 'sounds', label: 'Sounds', icon: Volume2 },
  { id: 'invite', label: 'Invite a trader', icon: UserPlus },
  { id: 'mail', label: 'Email preferences', icon: Mail },
  { id: 'keyboard', label: 'Keyboard', icon: Keyboard },
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

/* THE DESK'S ROWS — the name and the timeframe a desk opens on, the clock */
const OPENS_ON_NAMES: DropdownOption<string>[] = [
  { value: '', label: 'Where you left off', hint: 'The name the terminal last had up' },
  ...Simulator.WATCHLIST.map(t => ({ value: t, label: t, hint: `Every visit opens on ${t}` })),
];
const OPENS_ON_TIMEFRAMES: DropdownOption<string>[] = [
  { value: '', label: "Each desk's own", hint: 'Pulse and the Weigher at 1m, the Map at 15m' },
  ...TIMEFRAMES.filter(t => t.value !== '15s').map(t => ({ value: t.value, label: t.label, hint: `Every chart opens at ${t.label}` })),
];
const CLOCK_OPTIONS: DropdownOption<ClockZone>[] = [
  { value: 'local', label: 'Your own', hint: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "The machine's zone"; } })() },
  { value: 'ny', label: 'New York', hint: "The market's clock — the open at 09:30, the close at 16:00" },
];

/* EVERY KEY THE TERMINAL ANSWERS TO, grouped by where it works (Noah,
   2026-09-13, on the page listing six: "do you think it's too short?" — it was
   under-listed, not too short: Terrain's desk answers to twelve more). Each
   group's keys are read off the handler that owns them — AppShell (the
   palette), CommandPalette (its list), Terrain's pane keys, ResetViewControl
   (Alt+R while the pointer is over a chart), the script editor's keymap
   (Mod-s, Mod-Enter). `alt` marks keys that are alternatives ("1 / 2 / 3 / 4")
   rather than a chord ("Ctrl + K"). */
type Shortcut = { keys: string[]; does: string; alt?: boolean };
const KEY_GROUPS: { where: string; keys: Shortcut[] }[] = [
  {
    where: 'Everywhere',
    keys: [
      { keys: ['Ctrl', 'K'], does: 'Search a name or a page from anywhere' },
      { keys: ['↑', '↓'], alt: true, does: "Walk the search's results" },
      { keys: ['Enter'], does: 'Open the result under the mark' },
      { keys: ['Esc'], does: 'Close what is open — a menu, the alerts, the ladder (from inside it), fullscreen, a replay' },
    ],
  },
  {
    where: 'Terrain · the desk',
    keys: [
      { keys: ['1', '2', '3', '4'], alt: true, does: 'How many charts — one to four' },
      { keys: ['[', ']'], alt: true, does: 'Walk the charts — the one before, the one after' },
      { keys: ['Shift', 'R'], does: 'The strike rail beside every chart — on or off' },
    ],
  },
  {
    where: 'Terrain · the active chart',
    keys: [
      { keys: ['F'], does: 'Expand it to the full screen, and back' },
      { keys: ['S'], does: 'Pick its symbol' },
      { keys: ['C'], does: 'Compare — cross another name onto it' },
      { keys: ['↑', '↓'], alt: true, does: 'Flip its name through the watchlist' },
      { keys: ['−', '='], alt: true, does: 'Step its timeframe down, up' },
      { keys: ['P'], does: 'Replay — pick a bar, then play' },
      { keys: ['D'], does: 'Draw mode — the tools in hand' },
      { keys: ['R'], does: 'Its strike rail — on or off' },
      { keys: ['Alt', 'R'], does: 'Reset its view — with the pointer over the chart' },
    ],
  },
  {
    where: 'Review · the backtest desk',
    keys: [
      { keys: ['Space'], does: 'Play the clock, and pause it' },
      { keys: ['←', '→'], alt: true, does: 'Step a minute back, a minute on — never back past your last order' },
      { keys: ['Shift', '→'], does: 'Five minutes on (Shift ← for five back)' },
      { keys: ['End'], does: 'Run to the bell' },
      { keys: ['N'], does: 'Ring the bell and open the next day' },
      { keys: ['F'], does: 'The chart to the full screen, and back' },
      { keys: ['D'], does: 'Draw mode on the chart in hand' },
      { keys: ['T'], does: 'To the order — its size, ready to type' },
      { keys: ['1', '2'], alt: true, does: 'Put the first name on the desk, or the second' },
      { keys: ['\\'], does: 'In the full screen: fold the chain away, and back' },
    ],
  },
  {
    where: 'Review · a trade in the journal',
    keys: [
      { keys: ['←', '→'], alt: true, does: 'The trade closed after this one, or the one before — the journal’s own order' },
      { keys: ['Esc'], does: 'Back to the journal, as you left it' },
    ],
  },
  {
    where: 'The script editor',
    keys: [
      { keys: ['Ctrl', 'S'], does: 'Save the script' },
      { keys: ['Ctrl', 'Enter'], does: 'Run it on its chart' },
    ],
  },
];


/* ---- the pieces --------------------------------------------------------------- */

/** A box of rows: the head, then the rows under hairlines */
const Section = ({ id, title, line, aside, children }: { id: string; title: string; line: string; aside?: ReactNode; children: ReactNode }) => (
  <section id={id} className="border border-borderSubtle rounded-md bg-panel overflow-clip scroll-mt-5" data-settings-section={id}>
    {/* on a phone the tag goes UNDER the words, the Row's own rule (the phone sweep, 2026-09-19): beside them, "preview ·
        sample account" took half the width and the section's one line ran to seven */}
    <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-x-6 gap-y-2 max-sm:flex-col">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold leading-tight text-textPrimary">{title}</h2>
        <p className="mt-0.5 text-[11px] text-textMuted">{line}</p>
      </div>
      {aside && <div className="shrink-0 pt-0.5">{aside}</div>}
    </div>
    {children}
  </section>
);

/** One setting: the name and its line at the left, the control at the right */
const Row = ({ name, line, children, testId }: { name: string; line: string; children?: ReactNode; testId: string }) => (
  /* On a phone the control goes UNDER its words (the phone pass, 2026-09-13):
     side by side, a wide control (the desk's Name + Timeframe cards) squeezed
     the words into a one-word-a-line column */
  <div className="px-5 py-3 border-t border-borderSubtle/60 flex items-center justify-between gap-6 max-sm:flex-col max-sm:items-stretch max-sm:gap-3" data-settings-row={testId}>
    <div className="min-w-0">
      <div className="text-[12px] text-textPrimary">{name}</div>
      <div className="text-[11px] text-textMuted">{line}</div>
    </div>
    <div className="shrink-0 flex items-center gap-2 max-sm:flex-wrap">{children}</div>
  </div>
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
        {/* Silver, where you are — never lime: THE HOUSE CHECKBOX (the menus'
            filled square with the dark tick), not a bare mark (Noah,
            2026-09-12: "make the checkmark a blue checkbox instead on the
            active theme") */}
        {on && (
          <span className="inline-flex w-3.5 h-3.5 shrink-0 items-center justify-center rounded-[3px] border bg-silverFill border-silverFill" data-theme-check>
            <Check className="w-2.5 h-2.5 text-[#0a0a0a]" strokeWidth={3} />
          </span>
        )}
      </div>
      <div className="text-[11px] text-textMuted">{line}</div>
    </button>
  );
};

const Key = ({ children }: { children: ReactNode }) => (
  <kbd className="inline-flex items-center h-5 px-1.5 rounded border border-borderSubtle bg-chip font-mono text-[10px] text-textSecondary">{children}</kbd>
);

/* ---- the page ----------------------------------------------------------------- */

/* ---- the launch pages, on the seam --------------------------------------------
   Account, Billing and Data are THE LAUNCH PAGES drawn now (Noah, 2026-09-12:
   "i just want the preview of how things would look after apis are plugged in
   and stripe is purchased") — the terminal's own doctrine: the page against
   a frozen shape (data/profile.ts, data/billing.ts), a sample on this machine
   underneath, the service swapped in later. What can be real today IS real:
   the picture, the name, the handle, the plan switch, the export, the clear.
   A door the service alone can open (Stripe's portal, sign out) says what it
   will do; the head's tag says the ground is a sample. */

/** A door: the house's small bordered button, a link when it has somewhere to go */
/* A DOOR WHOSE ACTION IS IN FLIGHT (ui/Working.tsx): a handler that returns a promise holds the door busy until it settles — the mark
   appears if that lasts. The sample's handlers are instant and never show it; at launch the same doors return Stripe's and the server's requests. */
const Door = ({ children, onClick, to, href, title, tone = 'plain', testId }: { children: ReactNode; onClick?: () => void | Promise<unknown>; to?: string; href?: string; title?: string; tone?: 'plain' | 'bear'; testId: string }) => {
  const [busy, run] = useBusy();
  const working = useWorking(busy);
  const cls = `inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border font-mono text-[10px] uppercase tracking-wider transition-colors whitespace-nowrap ${
    tone === 'bear' ? 'border-bear/40 text-bear hover:bg-bear/10' : 'border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted'
  }`;
  if (to)
    return (
      <Link to={to} className={cls} title={title} data-settings-door={testId}>
        {children}
      </Link>
    );
  if (href)
    return (
      <a href={href} className={cls} title={title} data-settings-door={testId}>
        {children}
      </a>
    );
  return (
    <button type="button" onClick={onClick ? () => run(onClick) : undefined} disabled={busy} aria-busy={busy || undefined} className={`${cls} disabled:cursor-progress`} title={title} data-settings-door={testId}>
      {children}
      {working && <MorphingInfinity viewBox="4 4 16 16" className="w-3 h-3" />}
    </button>
  );
};

/** A small mono word in a pill — a state, never a control */
const Tag = ({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'silver' }) => (
  <span className={`font-mono text-[9px] uppercase tracking-widest rounded px-2 py-0.5 whitespace-nowrap border ${tone === 'silver' ? 'bg-silverFill border-silverFill text-[#0a0a0a]' : 'border-borderSubtle text-textMuted'}`}>
    {children}
  </span>
);

/** A text field in a row — the chip ground; saves on blur or Enter, Esc puts the value back */
/* A FIELD SAYS WHY IT DID NOT SAVE (2026-09-19). It used to fail in silence: an empty name snapped back without a word, and
   "abc" was kept as an email address. `check` returns the reason a value cannot be kept, or null; the reason shows under the
   field in the alert ink, the field keeps what was typed so it can be fixed, and nothing is saved until it passes. */
const Field = ({ value, onSave, prefix, width = 200, type = 'text', testId, check }: { value: string; onSave: (v: string) => void; prefix?: string; width?: number; type?: 'text' | 'email'; testId: string; check?: (v: string) => string | null }) => {
  const [v, setV] = useState(value);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => setV(value), [value]);
  const errId = `field-${testId}-problem`;
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className={`inline-flex items-center h-7 rounded-md border bg-chip transition-colors ${problem ? 'border-warn/70' : 'border-borderSubtle focus-within:border-borderMuted'}`} style={{ width }}>
        {prefix && <span className="pl-2 font-mono text-[11px] text-textMuted select-none">{prefix}</span>}
        <input
          value={v}
          type={type}
          spellCheck={false}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? errId : undefined}
          onChange={e => {
            setV(e.target.value);
            if (problem) setProblem(null);
          }}
          onBlur={() => {
            const next = v.trim();
            if (next === value) return setV(value);
            const why = !next ? 'This cannot be empty' : (check?.(next) ?? null);
            if (why) return setProblem(why);
            onSave(next);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              setV(value);
              setProblem(null);
            }
          }}
          className={`min-w-0 flex-1 h-full bg-transparent ${prefix ? 'pl-0.5 pr-2' : 'px-2'} font-mono text-[11px] text-textPrimary outline-none`}
          data-settings-field={testId}
        />
      </span>
      {problem && (
        <span id={errId} role="alert" className="font-mono text-[10px] text-warn" data-settings-problem={testId}>
          {problem}
        </span>
      )}
    </span>
  );
};

const checkEmail = (v: string): string | null => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : 'That is not an email address');
const checkHandle = (v: string): string | null => {
  const h = v.replace(/^@/, '');
  if (/\s/.test(h)) return 'One word, no spaces';
  if (!/^[A-Za-z0-9_]+$/.test(h)) return 'Letters, numbers and _ only';
  if (h.length < 3 || h.length > 20) return 'Between 3 and 20 characters';
  return null;
};
const checkName = (v: string): string | null => (v.length > 40 ? 'Forty characters at most' : null);

const SIGN_IN_OPTIONS: DropdownOption<SignInWay>[] = [
  { value: 'email', label: 'Email link', hint: 'A one-time link to your inbox — no password' },
  { value: 'google', label: 'Google', hint: 'Your Google account' },
  { value: 'apple', label: 'Apple', hint: 'Your Apple ID' },
];

/** ACCOUNT — who you are to the terminal */
const AccountBox = () => {
  const p = useProfile();
  return (
    <Section id="account" title="Account" line="Who you are to the terminal — your picture and name sign your posts; your board, marks and settings follow you between machines">
      {/* THE PICTURE — a place to drop one: staged, shown as it will be kept, applied only when you say so (PictureDrop.tsx) */}
      <PictureDrop />
      <Row name="Name" line="How the terminal greets you and signs your posts" testId="name">
        <Field value={p.name} onSave={v => setProfile({ name: v })} check={checkName} testId="name" />
      </Row>
      <Row name="Handle" line="Your name on Community — one word, yours alone" testId="handle">
        <Field value={p.handle} prefix="@" onSave={v => setProfile({ handle: v.replace(/^@/, '').toLowerCase() })} check={checkHandle} testId="handle" />
      </Row>
      <Row name="Email" line="Where sign-in links and receipts go" testId="email">
        <Field value={p.email} type="email" width={240} onSave={v => setProfile({ email: v })} check={checkEmail} testId="email" />
      </Row>
      <Row name="Sign in with" line="A link to your inbox, or the account you already have — no password to keep" testId="sign-in-way">
        <DropdownSelect<SignInWay> label="Sign in" value={p.signIn} options={SIGN_IN_OPTIONS} onChange={v => setProfile({ signIn: v })} title="How you sign in" testId="settings-sign-in" align="end" />
      </Row>
      {/* WHERE YOU ARE SIGNED IN */}
      <div className="px-5 py-3 border-t border-borderSubtle/60" data-settings-row="devices">
        <div className="text-[12px] text-textPrimary">Where you're signed in</div>
        <div className="text-[11px] text-textMuted">Every machine with this account open — sign one out from here</div>
        <ul className="mt-2.5 flex flex-col gap-1">
          {p.devices.map(d => (
            <li key={d.id} className="flex items-center gap-3 h-8 px-3 rounded-md bg-ink/[0.03]" data-settings-device={d.id}>
              <MonitorSmartphone className="w-3.5 h-3.5 text-textMuted shrink-0" />
              <span className="font-mono text-[11px] text-textPrimary">{d.name}</span>
              {d.thisOne && <Tag tone="silver">this machine</Tag>}
              <span className="ml-auto font-mono text-[10px] tnum text-textMuted">{d.lastSeen}</span>
              {!d.thisOne && (
                <button type="button" onClick={() => setProfile({ devices: p.devices.filter(x => x.id !== d.id) })} className="font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary transition-colors" data-settings-device-out={d.id}>
                  Sign out
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
      {/* THE FOOT — leaving, and the one dangerous thing, set apart in the bear's ink */}
      <div className="px-5 py-3 border-t border-borderSubtle/60 flex items-center justify-between gap-6" data-settings-row="account-foot">
        <div className="text-[11px] text-textMuted">Signing out keeps everything on the account · deleting it takes the board, the marks and the scripts with it</div>
        <div className="shrink-0 flex items-center gap-2">
          <Door title="Signs this machine out of the account" testId="sign-out">
            <LogOut className="w-3 h-3" /> Sign out
          </Door>
          <Door tone="bear" title="Asks twice, then deletes the account and everything on it" testId="delete-account">
            <Trash2 className="w-3 h-3" /> Delete account
          </Door>
        </div>
      </div>
    </Section>
  );
};

const STATUS_WORD: Record<SubscriptionStatus, string> = { active: 'active', past_due: 'payment due', canceled: 'ending', trialing: 'trial' };

/* MONEY, SAID PLAINLY (Slayer Logo System, Web and App · Billing, 2026-10-01): the four notices a plan can need — the
   upgrade a page asks for, a plan ending, a payment that failed, a plan cancelled. Each is one card: the word over it, a
   sentence, what happens next, one or two doors. The sample plan has none of these standing, so the box can show each one
   ("See a notice") — when Stripe's state arrives, the plan's own standing picks it. */
type NoticeKind = 'upgrade' | 'ending' | 'failed' | 'cancelled';
const NOTICE_OPTIONS: DropdownOption<NoticeKind | ''>[] = [
  { value: '', label: 'None', hint: 'What a plan in good standing shows' },
  { value: 'upgrade', label: 'Upgrade', hint: 'A page your plan does not hold' },
  { value: 'ending', label: 'Plan ending', hint: 'A plan that ends soon' },
  { value: 'failed', label: 'Payment failed', hint: 'A charge that did not go through' },
  { value: 'cancelled', label: 'Cancelled', hint: 'A plan that will not renew' },
];
const noticeFor = (status: SubscriptionStatus): NoticeKind | '' => (status === 'past_due' ? 'failed' : status === 'canceled' ? 'cancelled' : status === 'trialing' ? 'ending' : '');

const BillingNotice = ({ kind, until }: { kind: NoticeKind; until: string }) => {
  const compass = planOf('compass');
  /* "Plan ending", never "Trial ending": there is no trial — an account is free and a plan is paid for (the owner,
     2026-10-01), and the notice's own words were already about the plan */
  const word = { upgrade: 'Upgrade', ending: 'Plan ending', failed: 'Payment failed', cancelled: 'Cancelled' }[kind];
  const head = {
    upgrade: 'Compass needs the Compass plan.',
    ending: `Your plan ends on ${until}.`,
    failed: 'Your last payment didn’t go through.',
    cancelled: 'Your plan is cancelled.',
  }[kind];
  const line = {
    upgrade: `Contracts that fit the levels right now, weeklies to LEAPS. ${compass.price} a month, cancel any time.`,
    ending: 'Renew to keep your desks, layouts and alerts.',
    failed: 'Update your card to keep access. We will try again in three days.',
    cancelled: `You keep access until ${until}. Your layouts stay saved if you come back.`,
  }[kind];
  return (
    <div className={`mx-5 mb-4 rounded-lg border p-4 ${kind === 'failed' ? 'border-warn/60' : 'border-borderMuted'} bg-ink/[0.02]`} data-billing-notice={kind}>
      <div className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${kind === 'failed' ? 'text-warn' : 'text-textMuted'}`}>{word}</div>
      <div className="mt-1.5 text-[15px] font-medium text-textPrimary">{head}</div>
      <div className="mt-1 text-[12.5px] text-textSecondary">{line}</div>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {kind === 'upgrade' && (
          <>
            <Door onClick={() => setPlan('compass')} title="Stripe's Checkout — the difference, charged today" testId="notice-upgrade">
              Upgrade to Compass
            </Door>
            <Door title="Keep the plan you have" testId="notice-not-now">
              Not now
            </Door>
          </>
        )}
        {kind === 'ending' && (
          <Door title="Stripe's portal — renew the plan" testId="notice-renew">
            Renew
          </Door>
        )}
        {kind === 'failed' && (
          <Door title="Stripe's portal — the card" testId="notice-card">
            Update card
          </Door>
        )}
        {kind === 'cancelled' && (
          <>
            <Door title="Stripe's portal — start the plan again" testId="notice-restart">
              Restart plan
            </Door>
            <Door to="/settings/data" title="Your journal and everything else on this machine, as a file" testId="notice-export">
              Export my journal
            </Door>
          </>
        )}
      </div>
    </div>
  );
};

/** BILLING — the plan, the tiers, what Stripe holds, the invoices */
const BillingBox = () => {
  const b = useBilling();
  const plan = planOf(b.plan);
  const [seen, setSeen] = useState<NoticeKind | ''>(() => noticeFor(b.status));
  return (
    <Section id="billing" title="Billing" line="Your plan and the card behind it — the card lives with Stripe, never here">
      {/* THE PLAN — what you are on, its standing, the next charge */}
      <div className="px-5 py-4 border-t border-borderSubtle/60 flex items-center gap-6 flex-wrap" data-settings-plan={b.plan}>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-[20px] font-semibold leading-tight text-textPrimary">{plan.name}</span>
            <span className="font-mono text-[12px] tnum text-textSecondary">
              {plan.price} {plan.period}
            </span>
            <Tag tone="silver">{STATUS_WORD[b.status]}</Tag>
          </div>
          <div className="mt-1 text-[11px] text-textMuted">
            {plan.kicker.replace(/\.$/, '')} · {b.status === 'canceled' ? 'ends' : 'renews'} {fmtDate(b.renewsOn)}
            {plan.monthly != null && ` · $${plan.monthly} then`}
          </div>
        </div>
        <Door title="Stripe's billing portal — the card, the invoices, cancelling" testId="manage-billing">
          <ExternalLink className="w-3 h-3" /> Manage billing
        </Door>
      </div>
      {seen && <BillingNotice kind={seen} until={fmtDate(b.renewsOn)} />}
      <Row name="See a notice" line="How billing speaks when a plan needs something — shown here on the sample plan" testId="billing-notice">
        <DropdownSelect<NoticeKind | ''> label="Notice" value={seen} options={NOTICE_OPTIONS} onChange={setSeen} title="Show a billing notice" testId="settings-billing-notice" align="end" />
      </Row>
      {/* THE TIERS — the landing's three, yours lit; up is Stripe's Checkout, down is the portal */}
      <div className="px-5 pb-4 border-t border-borderSubtle/60 pt-3" data-settings-row="plans">
        <div className="text-[12px] text-textPrimary">Plans</div>
        <div className="text-[11px] text-textMuted">Month to month, stopping at the end of the cycle · Lifetime is one payment</div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {PLANS.map(t => {
            const on = t.key === b.plan;
            return (
              <div key={t.key} className={`rounded-md border p-3 flex flex-col gap-1 ${on ? 'border-silver/60 bg-ink/[0.02]' : 'border-borderSubtle'}`} data-settings-tier={t.key} data-on={on || undefined}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[12px] ${on ? 'text-textPrimary' : 'text-textSecondary'}`}>{t.name}</span>
                  {on && (
                    <span className="inline-flex w-3.5 h-3.5 shrink-0 items-center justify-center rounded-[3px] border bg-silverFill border-silverFill">
                      <Check className="w-2.5 h-2.5 text-[#0a0a0a]" strokeWidth={3} />
                    </span>
                  )}
                </div>
                <div className="font-mono text-[14px] font-semibold tnum text-textPrimary">
                  {t.price}
                  <span className="text-[10px] font-normal text-textMuted"> {t.period}</span>
                </div>
                <div className="text-[11px] text-textMuted">{t.kicker}</div>
                <div className="mt-2 h-7 flex items-center">
                  {on ? (
                    <Tag>your plan</Tag>
                  ) : t.key === 'lifetime' ? (
                    <Door href="mailto:info@slayerterminal.com" title="A single payment, priced with you" testId="tier-lifetime">
                      Talk to us
                    </Door>
                  ) : (
                    <Door onClick={() => setPlan(t.key)} title={t.monthly != null && plan.monthly != null && t.monthly > plan.monthly ? "Stripe's Checkout — the difference, charged today" : 'Stripe changes the plan at the end of this cycle'} testId={`tier-${t.key}`}>
                      Switch
                    </Door>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <Row name="Payment method" line="What Stripe holds — changed on its portal, never typed here" testId="card">
        {b.card ? (
          <span className="inline-flex items-center gap-2 font-mono text-[11px] text-textPrimary">
            <CreditCard className="w-3.5 h-3.5 text-textMuted" />
            {b.card.brand} •••• {b.card.last4}
            <span className="text-textMuted tnum">
              · {String(b.card.expMonth).padStart(2, '0')}/{String(b.card.expYear).slice(2)}
            </span>
          </span>
        ) : (
          <span className="font-mono text-[11px] text-textMuted">No card on file</span>
        )}
        <Door title="Opens Stripe's portal on the card" testId="update-card">
          Update
        </Door>
      </Row>
      <Row name="Statement descriptor" line="What a card statement reads for the plan" testId="descriptor">
        <span className="font-code text-[11.5px] text-textPrimary">{COMPANY.descriptor}</span>
      </Row>
      {/* THE INVOICES — every charge, its receipt from Stripe */}
      <div className="px-5 py-3 border-t border-borderSubtle/60" data-settings-row="invoices">
        <div className="text-[12px] text-textPrimary">Invoices</div>
        <div className="text-[11px] text-textMuted">Every charge, with its receipt</div>
        <table className="mt-2 w-full">
          <tbody>
            {b.invoices.map(inv => (
              <tr key={inv.id} className="h-8 border-t border-borderSubtle/40 first:border-t-0" data-settings-invoice={inv.id}>
                <td className="font-mono text-[11px] tnum text-textPrimary">{fmtDate(inv.date)}</td>
                <td className="font-mono text-[11px] text-textSecondary">{planOf(inv.plan).name}</td>
                <td className="font-mono text-[11px] tnum text-textPrimary text-right">${inv.amount.toFixed(2)}</td>
                <td className="text-right">
                  <Tag>{inv.status}</Tag>
                </td>
                <td className="text-right w-16">
                  <button type="button" className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary transition-colors" title="The receipt, from Stripe">
                    <FileText className="w-3 h-3" /> PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
};

/* What is yours on this machine: every key of ours in localStorage (the board,
   the marks, the alerts, the desks, these settings, the profile) — scripts
   live in the library's own store */
const OWN_PREFIX = 'slayer_';
const KEEP_ON_CLEAR = new Set(['slayer_boot_seen', 'slayer_theme']);
function localKeys(): string[] {
  const out: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(OWN_PREFIX)) out.push(k);
  }
  return out;
}
function localBytes(): number {
  let n = 0;
  for (const k of localKeys()) n += (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2;
  return n;
}
const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
function exportLocal(): void {
  const keys: Record<string, string> = {};
  for (const k of localKeys()) keys[k] = localStorage.getItem(k) ?? '';
  const blob = new Blob([JSON.stringify({ app: 'slayer_terminal', version: RELEASE, at: new Date().toISOString(), keys }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `slayer-terminal-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function importLocal(file: File): Promise<number> {
  const doc = JSON.parse(await file.text()) as { app?: string; keys?: Record<string, unknown> };
  if (doc.app !== 'slayer_terminal' || !doc.keys) throw new Error('not a terminal export');
  let n = 0;
  for (const [k, v] of Object.entries(doc.keys)) {
    if (k.startsWith(OWN_PREFIX) && typeof v === 'string') {
      localStorage.setItem(k, v);
      n++;
    }
  }
  return n;
}
function clearLocal(): void {
  for (const k of localKeys()) if (!KEEP_ON_CLEAR.has(k)) localStorage.removeItem(k);
}

/** DATA — what's yours on this machine, and where the feed stands */
const DataBox = () => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const bytes = localBytes();
  const bring = async (f: File | undefined) => {
    if (!f) return;
    try {
      const n = await importLocal(f);
      setNote(`${n} ${n === 1 ? 'thing' : 'things'} brought in — reloading`);
      window.setTimeout(() => window.location.reload(), 600);
    } catch {
      setNote('that file is not a terminal export');
    }
  };
  return (
    <Section id="data" title="Data" line="What's yours on this machine — the board, the marks, the alerts, the desks, these settings — and where the feed stands">
      <Row name="The feed" line="Live options and quotes, the tape and the record — delayed while a payment is due" testId="feed">
        <span className="inline-flex items-center gap-2">
          <span className="tone-live rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest font-semibold">live</span>
          <span className="font-mono text-[11px] text-textMuted">every tick · the book every 10 seconds</span>
        </span>
      </Row>
      <Row name="Your board, marks and settings" line="A file of everything kept here, to carry to another machine or keep safe · scripts stay in the library" testId="carry">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={e => {
            void bring(e.target.files?.[0]);
            e.target.value = '';
          }}
          data-settings-import-input
        />
        {note && <span className="font-mono text-[10px] text-textMuted">{note}</span>}
        <Door onClick={exportLocal} title="Downloads a file of what is kept here" testId="export">
          <Download className="w-3 h-3" /> Export
        </Door>
        <Door onClick={() => fileRef.current?.click()} title="Reads a file made by Export and reloads" testId="import">
          <Upload className="w-3 h-3" /> Import
        </Door>
      </Row>
      <Row name="On this machine" line="What this browser holds for the terminal — cleared, it starts as new, the account untouched" testId="storage">
        <span className="font-mono text-[11px] tnum text-textPrimary" data-settings-bytes={bytes}>
          {fmtBytes(bytes)}
        </span>
        <Door tone="bear" onClick={() => setConfirm(true)} title="Asks first" testId="clear">
          <Trash2 className="w-3 h-3" /> Clear
        </Door>
      </Row>
      <Modal open={confirm} onClose={() => setConfirm(false)} ariaLabel="Clear this machine's data" header={<span className="font-mono text-[11px] uppercase tracking-widest text-textSecondary">Clear this machine's data?</span>} widthClass="max-w-[460px]">
        <p className="text-[12px] text-textPrimary">The board, the marks, the alerts, the desks, these settings and the sample account go. The theme stays; the scripts in the library stay.</p>
        <p className="text-[11px] text-textMuted">Export first if any of it should come back.</p>
        <div className="flex items-center justify-end gap-2">
          <Door onClick={() => setConfirm(false)} testId="clear-cancel">
            Keep it
          </Door>
          <Door
            tone="bear"
            onClick={() => {
              clearLocal();
              window.location.reload();
            }}
            testId="clear-confirm"
          >
            <Trash2 className="w-3 h-3" /> Clear and reload
          </Door>
        </div>
      </Modal>
    </Section>
  );
};

/** The house switch — the one every on/off row wears */
const Toggle = ({ on, onChange, label, testId }: { on: boolean; onChange: (v: boolean) => void; label: string; testId: string }) => (
  <Switch.Root
    checked={on}
    onCheckedChange={onChange}
    aria-label={label}
    className="relative shrink-0 w-8 h-[18px] rounded-full border border-borderSubtle bg-ink/[0.06] data-[state=checked]:bg-silver data-[state=checked]:border-silver transition-colors outline-none focus-visible:ring-2 focus-visible:ring-silver/60"
    data-settings-switch={testId}
  >
    <Switch.Thumb className="block w-3 h-3 rounded-full bg-textPrimary translate-x-[2px] data-[state=checked]:translate-x-[16px] data-[state=checked]:bg-panel transition-transform" />
  </Switch.Root>
);

/* SOUNDS (Slayer Logo System, 14 · Motion and sound: "Tones, not a casino."): the four the brand names, each with its own
   switch and a Play that sounds it whatever the switch says. The alert's switch is the one the desk always had. */
const SOUND_ROWS: { kind: SoundKind; name: string; line: string }[] = [
  { kind: 'alert', name: 'Alert', line: 'Two rising sine tones, 180 ms — when an alert fires, on any page' },
  { kind: 'confirm', name: 'Confirm', line: 'One soft click, 60 ms — an alert set, a thing saved' },
  { kind: 'signIn', name: 'Sign in', line: 'One low tone, 120 ms' },
  { kind: 'openClose', name: 'Market open and close', line: 'One tone up at the open, one down at the close' },
];

const SoundsBox = () => {
  const desk = useDeskPrefs();
  const isOn = (k: SoundKind) => (k === 'alert' ? desk.alertsSound : k === 'confirm' ? desk.sounds.confirm : k === 'signIn' ? desk.sounds.signIn : desk.sounds.openClose);
  const set = (k: SoundKind, v: boolean) => (k === 'alert' ? setDeskPrefs({ alertsSound: v }) : setDeskPrefs({ sounds: k === 'confirm' ? { confirm: v } : k === 'signIn' ? { signIn: v } : { openClose: v } }));
  return (
    <Section id="sounds" title="Sounds" line="Tones, not a casino — each on its own switch, kept on this machine">
      {SOUND_ROWS.map(r => (
        <Row key={r.kind} name={r.name} line={r.line} testId={`sound-${r.kind}`}>
          <Door onClick={() => play(r.kind)} title={`Hear the ${r.name.toLowerCase()} sound`} testId={`play-${r.kind}`}>
            <Volume2 className="w-3 h-3" /> Play
          </Door>
          <Toggle on={isOn(r.kind)} onChange={v => set(r.kind, v)} label={`${r.name} sound`} testId={`sound-${r.kind}`} />
        </Row>
      ))}
    </Section>
  );
};

/** The invite's key — four letters off the handle, the same every time (accounts will hand out the real one) */
const inviteKey = (handle: string): string => {
  let h = 2166136261;
  for (const ch of handle) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h.toString(36).toUpperCase().slice(-4).padStart(4, '7');
};

/* INVITE A TRADER (Web and App · Settings): the link with your name on it, and who came in on it. No account service
   yet, so no one has — the list says so rather than showing anyone. */
const InviteBox = () => {
  const profile = useProfile();
  const code = `${profile.handle.toLowerCase()}-${inviteKey(profile.handle)}`;
  const link = `${window.location.host}/i/${code}`;
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/i/${code}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* no clipboard here — the link is on screen to select */
    }
  };
  return (
    <Section id="invite" title="Invite a trader" line="When someone you invite joins a paid plan, you both get a month of account credit">
      <Row name="Your link" line="It opens the terminal with your name on it" testId="invite-link">
        <code className="font-code text-[11.5px] text-textPrimary select-all" data-invite-link>
          {link}
        </code>
        <Door onClick={copy} title="Copy the link" testId="invite-copy">
          {copied ? 'Copied.' : 'Copy'}
        </Door>
      </Row>
      <div className="px-5 py-4 border-t border-borderSubtle/60 text-[12px] text-textMuted" data-settings-row="invited">
        No one yet. When someone you invite joins, they show here with their standing: invited, joined, credited.
      </div>
    </Section>
  );
};

/* EMAIL PREFERENCES (Web and App · Settings): "Receipts and sign-in mail always send." Four kinds of optional mail, each a
   switch, and one door that turns them all off. Kept on this machine — no mail is sent until accounts open. */
type MailKind = 'alerts' | 'updates' | 'tips' | 'newsletter';
const MAIL_KEY = 'slayer_mail_prefs';
const MAIL_ROWS: { kind: MailKind; name: string; line: string }[] = [
  { kind: 'alerts', name: 'Alert emails', line: 'An alert that fires while you are away, in your inbox' },
  { kind: 'updates', name: 'Product updates', line: 'When something ships — one line and a still' },
  { kind: 'tips', name: 'Onboarding tips', line: 'Four short notes in your first two weeks' },
  { kind: 'newsletter', name: 'Newsletter', line: 'What shipped this week' },
];
const readMail = (): Record<MailKind, boolean> => {
  const base = { alerts: true, updates: true, tips: true, newsletter: false };
  try {
    return { ...base, ...(JSON.parse(localStorage.getItem(MAIL_KEY) ?? '{}') as Partial<Record<MailKind, boolean>>) };
  } catch {
    return base;
  }
};

const MailBox = () => {
  const [mail, setMail] = useState(readMail);
  const save = (next: Record<MailKind, boolean>) => {
    setMail(next);
    try {
      localStorage.setItem(MAIL_KEY, JSON.stringify(next));
    } catch {
      /* private mode — for this visit */
    }
  };
  const anyOn = Object.values(mail).some(Boolean);
  return (
    <Section id="mail" title="Email preferences" line="Receipts and sign-in mail always send">
      {MAIL_ROWS.map(r => (
        <Row key={r.kind} name={r.name} line={r.line} testId={`mail-${r.kind}`}>
          <Toggle on={mail[r.kind]} onChange={v => save({ ...mail, [r.kind]: v })} label={r.name} testId={`mail-${r.kind}`} />
        </Row>
      ))}
      <Row name="Unsubscribe from everything optional" line={`Receipts and sign-in links still come, from ${COMPANY.site}`} testId="mail-none">
        <Door onClick={() => save({ alerts: false, updates: false, tips: false, newsletter: false })} title="Turn every optional mail off" testId="mail-unsubscribe">
          {anyOn ? 'Unsubscribe' : 'Done'}
        </Door>
      </Row>
    </Section>
  );
};

/** ABOUT — the mark, the version, a word, the licences behind one door */
const AboutBox = () => {
  const [licences, setLicences] = useState(false);
  return (
    <Section id="about" title="About" line="The terminal and its version">
      <div className="px-5 py-4 border-t border-borderSubtle/60 flex items-center gap-4" data-settings-about>
        <SlayerMark size={32} bare label="" />
        <div className="min-w-0">
          <Wordmark height={13} label="Slayer Terminal" />
          <div className="mt-1.5 font-mono text-[11px] tnum text-textMuted">
            {RELEASE} · {import.meta.env.MODE}
          </div>
        </div>
        <div className="ml-auto shrink-0 flex items-center gap-2">
          <Door to="/community" testId="say-something">
            The room
          </Door>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setLicences(v => !v)}
        aria-expanded={licences}
        className="w-full px-5 py-3 border-t border-borderSubtle/60 flex items-center justify-between gap-6 text-left hover:bg-ink/[0.02] transition-colors"
        data-settings-row="licences"
      >
        <div>
          <div className="text-[12px] text-textPrimary">Open-source licences</div>
          <div className="text-[11px] text-textMuted">Whose work the terminal stands on</div>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-textMuted shrink-0 transition-transform duration-200 ${licences ? 'rotate-180' : ''}`} />
      </button>
      {licences && (
        <div data-settings-licences>
          <Row name="Charts" line="Drawn with TradingView's lightweight-charts, under the Apache 2.0 licence — the mark in the corner is theirs" testId="credit-charts" />
          <Row name="Grids" line="AG Grid Community, under the MIT licence" testId="credit-grids" />
          <Row name="Marks and glyphs" line="Company marks from thesvg.org · icons by Lucide, under the ISC licence" testId="credit-marks" />
        </div>
      )}
    </Section>
  );
};

const Settings = () => {
  const choice = useThemeChoice();
  const theme = useResolvedTheme();
  const candleKey = useCandleThemeKey();
  const unit = useDistanceUnit();
  const desk = useDeskPrefs();
  const plan = planOf(useBilling().plan);

  /* THE SUBPAGE — from the route; a step to another lands at the head */
  const { section } = useParams<{ section?: string }>();
  const current: SettingsSection = isSection(section) ? section : HOME_SECTION;
  useEffect(() => {
    const main = document.querySelector<HTMLElement>('main');
    if (main && main.scrollTop > 0) main.scrollTop = 0;
  }, [current]);
  if (!isSection(section)) return <Navigate to={`/settings/${HOME_SECTION}`} replace />;

  return (
    <>
      {/* THE HEAD — the house mark as the page's chip, the name, one line, the facts */}
      <header className="flex items-start gap-6 flex-wrap pb-3 border-b border-borderSubtle" data-shell data-settings-shell>
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-2.5" data-shell-page>
            <SlayerMark size={20} bare label="" />
            <h1 className="text-[15px] font-semibold leading-tight text-textPrimary">Settings</h1>
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">Your account and plan, how the terminal looks, what the desk opens on</p>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2" data-shell-facts>
          <div className="min-w-0">
            <dt className="text-[10px] text-textMuted whitespace-nowrap">Plan</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-settings-plan-fact={plan.key}>
              {plan.name}
            </dd>
          </div>
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

      {/* THE COLUMN IS THE FOOTER'S (Noah, 2026-09-12: "shorten the width of
          these cards… leaving more spacing on the right side", then, with a
          line drawn down the footer's last column: "a vertical line with the
          footer access column", and "when the sidebar is fully collapsed the
          left side needs to come closer to the middle") — the rail and the
          boxes sit in the footer's own measure: 1072px (max-w-6xl less its
          padding), centred in the page like the footer is, so the boxes' edges
          meet the footer's first and last columns whether the sidebar is out
          or in; the head stays full width, the shell grammar. A row's name and
          its control sit in one eye span; the window's sides stay quiet. */}
      <div className="grid grid-cols-1 xl:grid-cols-[168px_minmax(0,1fr)] gap-4 items-start w-full max-w-[1072px] mx-auto" data-settings>
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
                } ${i === 3 || i === 6 || i === 8 ? 'xl:mt-2' : ''}`}
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
            <Row name="Candles" line="The chart's own theme — the same menu every chart carries. Kept apart for each theme above: Glacier to begin with on dark, Stone on light" testId="candles">
              <DropdownSelect<CandleThemeKey> label="Candles" value={candleKey} options={CANDLE_THEME_OPTIONS} onChange={setCandleTheme} title="The colours every chart draws its candles in" testId="settings-candles" align="end" />
            </Row>
          </Section>
          )}

          {/* THE DESK */}
          {current === 'desk' && (
          <Section id="desk" title="The desk" line="What every desk reads by — kept on this machine until the account carries it">
            <Row name="Ruler" line="The unit every distance on Pinpoint is read in — the flip, the walls, the targets" testId="ruler">
              <DropdownSelect<DistanceUnit> label="Ruler" value={unit} options={RULER_OPTIONS} onChange={setDistanceUnit} title="The unit every distance on Pinpoint is read in" testId="settings-ruler" align="end" />
            </Row>
            {/* THE DESK'S OWN ROWS, LIVE (Noah, 2026-09-12: "make the desk buttons
                actually have the function behind them") — data/deskPrefs.ts;
                the hosts read them at their first render, the bell at every
                ring, the chart clock at every label */}
            <Row name="Opens on" line="The name and the timeframe every desk starts on — from the next visit" testId="opens-on">
              <DropdownSelect<string> label="Name" value={desk.opensOn.ticker ?? ''} options={OPENS_ON_NAMES} onChange={v => setDeskPrefs({ opensOn: { ticker: v || null } })} title="The name the terminal opens on" testId="settings-opens-name" align="end" />
              <DropdownSelect<string> label="Timeframe" value={desk.opensOn.timeframe ?? ''} options={OPENS_ON_TIMEFRAMES} onChange={v => setDeskPrefs({ opensOn: { timeframe: (v || null) as Timeframe | null } })} title="The timeframe every chart opens on" testId="settings-opens-timeframe" align="end" />
            </Row>
            <Row name="Clock" line="New York's time or your own on every chart's axis and crosshair" testId="clock">
              <DropdownSelect<ClockZone> label="Clock" value={desk.clock} options={CLOCK_OPTIONS} onChange={v => setDeskPrefs({ clock: v })} title="Whose clock the axes keep" testId="settings-clock" align="end" />
            </Row>
          </Section>
          )}

          {current === 'sounds' && <SoundsBox />}
          {current === 'invite' && <InviteBox />}
          {current === 'mail' && <MailBox />}

          {/* KEYBOARD */}
          {current === 'keyboard' && (
          <Section id="keyboard" title="Keyboard" line="Every key the terminal answers to, by where it works">
            {KEY_GROUPS.map(g => (
              <Fragment key={g.where}>
                {/* THE GROUP'S NAME — a whisper head over its rows, the house's section label */}
                <div className="px-5 pt-3 pb-1.5 border-t border-borderSubtle/60 font-mono text-[9px] leading-[13px] uppercase tracking-widest text-textMuted" data-settings-key-group={g.where}>
                  {g.where}
                </div>
                {g.keys.map(s => (
                  <div key={s.does} className="px-5 py-2.5 border-t border-borderSubtle/60 flex items-center justify-between gap-6" data-settings-key>
                    <span className="text-[12px] text-textSecondary">{s.does}</span>
                    <span className="inline-flex items-center gap-1 shrink-0">
                      {s.keys.map((k, i) => (
                        <span key={k} className="inline-flex items-center gap-1">
                          {i > 0 && <span className="text-[10px] text-textMuted">{s.alt ? '/' : '+'}</span>}
                          <Key>{k}</Key>
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </Fragment>
            ))}
          </Section>
          )}

          {/* THE LAUNCH PAGES, on the seam */}
          {current === 'account' && <AccountBox />}
          {current === 'billing' && <BillingBox />}
          {current === 'data' && <DataBox />}
          {current === 'about' && <AboutBox />}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
};

export default Settings;
