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
  something today (2026-10-09, the audit's SE-1: a
  dozen doors here did nothing). Sign out ends this
  visit's session and opens the sign-in; Delete
  account asks twice and clears this machine; the
  plan, the renewal and the card change here, on
  this machine; a receipt downloads as a PDF built
  here; each billing notice's doors act.

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
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, Check, ChevronDown, CreditCard, Download, FileText, Info, Keyboard, LayoutDashboard, LogOut, Mail, Megaphone, MonitorSmartphone, Palette, Plug, Settings as SettingsIcon, Trash2, Upload, UserPlus, UserRound, Volume2, type LucideIcon } from 'lucide-react';
import * as Switch from '@radix-ui/react-switch';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import Modal from '../../components/ui/Modal';
import { MorphingInfinity, useBusy, useWorking } from '../../components/ui/Working';
import Simulator from '../../core/simulator';
import { play, type SoundKind } from '../../core/sound';
import { TIMEFRAMES, type Timeframe } from '../../data/timeframe';
import { setDeskPrefs, useDeskPrefs, type ClockZone } from '../../data/deskPrefs';
import { setProfile, signOutHere, useProfile, type SignInWay } from '../../data/profile';
import PictureDrop from './PictureDrop';
import { PLANS, cardBrand, fmtDate, luhnOk, planOf, setCard, setPlan, setRenewing, useBilling, type SubscriptionStatus } from '../../data/billing';
import { CANDLE_THEME_OPTIONS, setCandleTheme, useCandleThemeKey, type CandleThemeKey } from '../../components/gex/candleTheme';
import { setDistanceUnit, useDistanceUnit } from '../../data/distanceUnits';
import type { DistanceUnit } from '../../data/atr';
import { setColourVision, setThemeChoice, useColourVision, useResolvedTheme, useThemeChoice, type ColourVision, type ThemeChoice } from '../../theme/theme';
import SlayerMark from '../../brand/SlayerMark';
import { KEY_GROUPS, keyJoin } from '../../components/layout/keys';
import { canSpeak, enableNotify, notifyPermission, setShellPrefs, speak, useShellPrefs } from '../../components/layout/shellPrefs';
import { downloadReceipt } from './receipt';
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
  light: ['Light', 'Paper: the terminal in ink on a light ground'],
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

/* EVERY KEY THE TERMINAL ANSWERS TO is components/layout/keys.ts (2026-10-09): the sheet `?` opens over any page reads
   the same list, so the two can never disagree */

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

/* A RADIO GROUP THAT ACTS LIKE ONE (the audit's SE-6): one tile in the Tab order, the arrows move the choice */
const radioKeys = <T,>(choices: readonly T[], current: T, pick: (c: T) => void) => (e: React.KeyboardEvent<HTMLElement>) => {
  const i = choices.indexOf(current);
  const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
  if (!step) return;
  e.preventDefault();
  const next = choices[(i + step + choices.length) % choices.length];
  pick(next);
  const group = e.currentTarget.closest('[role="radiogroup"]');
  requestAnimationFrame(() => group?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
};

const ThemeTile = ({ choice, current, onPick }: { choice: ThemeChoice; current: ThemeChoice; onPick: (c: ThemeChoice) => void }) => {
  const on = choice === current;
  const [name, line] = THEME_WORDS[choice];
  return (
    <button
      type="button"
      onClick={() => onPick(choice)}
      role="radio"
      aria-checked={on}
      tabIndex={on ? 0 : -1}
      onKeyDown={radioKeys(['dark', 'light', 'system'] as ThemeChoice[], current, onPick)}
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

/* COLOUR VISION (2026-10-09): the direction pair the terminal draws in — the house's green and red, or blue and orange
   with ▲ and ▼ before every figure that carries a direction (tokens.css) */
const CVD_WORDS: Record<ColourVision, [string, string]> = {
  standard: ['Green and red', 'Up in green, down in red — the house’s pair'],
  'blue-orange': ['Blue and orange', 'For red–green colour blindness: up in blue, down in orange, with ▲ and ▼'],
};
/* each tile shows its own pair whatever is chosen — the channels tokens.css gives each (kept in step with it) */
const CVD_PAIR: Record<ColourVision, Record<'dark' | 'light', [string, string]>> = {
  standard: { dark: ['48 209 88', '255 59 48'], light: ['0 140 56', '220 32 32'] },
  'blue-orange': { dark: ['80 164 255', '255 133 38'], light: ['0 104 200', '196 72 0'] },
};
const CvdTile = ({ choice, current }: { choice: ColourVision; current: ColourVision }) => {
  const on = choice === current;
  const theme = useResolvedTheme();
  const [name, line] = CVD_WORDS[choice];
  return (
    <button
      type="button"
      onClick={() => setColourVision(choice)}
      role="radio"
      aria-checked={on}
      tabIndex={on ? 0 : -1}
      onKeyDown={radioKeys(['standard', 'blue-orange'] as ColourVision[], current, setColourVision)}
      className={`text-left rounded-md border p-3 flex flex-col gap-2 transition-colors ${on ? 'border-silver/60 bg-ink/[0.02]' : 'border-borderSubtle hover:border-borderMuted'}`}
      data-cvd-tile={choice}
    >
      {/* the pair as it will read, in the tile's own scope so it shows its own colours whatever is chosen */}
      <span className="flex items-center gap-3 font-mono text-[12px] tnum" data-cvd-sample={choice} style={{ '--bull': CVD_PAIR[choice][theme][0], '--bear': CVD_PAIR[choice][theme][1] } as React.CSSProperties}>
        <span className="text-bull">{choice === 'blue-orange' ? '▲ ' : ''}+1.24%</span>
        <span className="text-bear">{choice === 'blue-orange' ? '▼ ' : ''}−0.87%</span>
      </span>
      <span className="flex items-center justify-between gap-2">
        <span className={`text-[12px] ${on ? 'text-textPrimary' : 'text-textSecondary'}`}>{name}</span>
        {on && (
          <span className="inline-flex w-3.5 h-3.5 shrink-0 items-center justify-center rounded-[3px] border bg-silverFill border-silverFill">
            <Check className="w-2.5 h-2.5 text-[#0a0a0a]" strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="text-[11px] text-textMuted">{line}</span>
    </button>
  );
};

/* NOTIFICATIONS ON THIS MACHINE (2026-10-09): off until turned on, and the browser asks its own question then */
const NotifyRow = () => {
  const shell = useShellPrefs();
  const [said, setSaid] = useState(notifyPermission);
  const line =
    said === 'unsupported' ? 'This browser shows no notifications'
    : said === 'denied' ? 'The browser was told no — allow them in its site settings to turn this on'
    : 'An alert that fires while this tab is in the background shows as the machine’s own notification. Nothing leaves this machine.';
  return (
    <Row name="Notifications" line={line} testId="notify">
      <Toggle
        on={shell.notify && said === 'granted'}
        onChange={async v => {
          if (!v) return setShellPrefs({ notify: false });
          setSaid(await enableNotify());
        }}
        label="Notify me when an alert fires in the background"
        testId="notify"
      />
    </Row>
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
const Door = ({ children, onClick, to, href, title, tone = 'plain', testId, disabled }: { children: ReactNode; onClick?: () => void | Promise<unknown>; to?: string; href?: string; title?: string; tone?: 'plain' | 'bear'; testId: string; disabled?: boolean }) => {
  const [busy, run] = useBusy();
  const working = useWorking(busy);
  const cls = `hit inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border font-mono text-[10px] uppercase tracking-wider transition-colors whitespace-nowrap ${
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
    <button type="button" onClick={onClick ? () => run(onClick) : undefined} disabled={busy || disabled} aria-busy={busy || undefined} className={`${cls} disabled:cursor-progress disabled:opacity-40`} title={title} data-settings-door={testId}>
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
const Field = ({ value, onSave, prefix, width = 200, type = 'text', testId, check, label, placeholder }: { value: string; onSave: (v: string) => void; prefix?: string; width?: number; type?: 'text' | 'email'; testId: string; check?: (v: string) => string | null; label: string; placeholder?: string }) => {
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
          aria-label={label}
          placeholder={placeholder}
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
          className={`min-w-0 flex-1 h-full bg-transparent ${prefix ? 'pl-0.5 pr-2' : 'px-2'} font-mono text-[11px] text-textPrimary placeholder:text-textMuted outline-none`}
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
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState<0 | 1 | 2>(0);
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (deleting === 0) setTyped('');
  }, [deleting]);
  return (
    <Section id="account" title="Account" line="Who you are to the terminal — your picture, your name, and how you sign in">
      {/* THE PICTURE — a place to drop one: staged, shown as it will be kept, applied only when you say so (PictureDrop.tsx) */}
      <PictureDrop />
      <Row name="Name" line="How the terminal greets you" testId="name">
        <Field label="Name" value={p.name} onSave={v => setProfile({ name: v })} check={checkName} testId="name" />
      </Row>
      <Row name="Handle" line="One word, yours alone — under your name on the rail" testId="handle">
        <Field label="Handle" value={p.handle} prefix="@" onSave={v => setProfile({ handle: v.replace(/^@/, '').toLowerCase() })} check={checkHandle} testId="handle" />
      </Row>
      <Row name="Email" line="Where sign-in links and receipts go" testId="email">
        <Field label="Email" value={p.email} type="email" width={240} placeholder="you@domain.com" onSave={v => setProfile({ email: v })} check={checkEmail} testId="email" />
      </Row>
      <Row name="Sign in with" line="A link to your inbox, or the account you already have — no password to keep" testId="sign-in-way">
        <DropdownSelect<SignInWay> label="Sign in" value={p.signIn} options={SIGN_IN_OPTIONS} onChange={v => setProfile({ signIn: v })} title="How you sign in" testId="settings-sign-in" align="end" />
      </Row>
      {/* WHERE YOU ARE SIGNED IN */}
      <div className="px-5 py-3 border-t border-borderSubtle/60" data-settings-row="devices">
        <div className="text-[12px] text-textPrimary">Where you're signed in</div>
        <div className="text-[11px] text-textMuted">The machine you are on, as its browser names itself</div>
        <ul className="mt-2.5 flex flex-col gap-1">
          {p.devices.map(d => (
            <li key={d.id} className="flex items-center gap-3 h-8 px-3 rounded-md bg-ink/[0.03]" data-settings-device={d.id}>
              <MonitorSmartphone className="w-3.5 h-3.5 text-textMuted shrink-0" />
              <span className="font-mono text-[11px] text-textPrimary">{d.name}</span>
              {d.thisOne && <Tag tone="silver">this machine</Tag>}
              <span className="ml-auto font-mono text-[10px] tnum text-textMuted">{d.lastSeen}</span>
            </li>
          ))}
        </ul>
      </div>
      {/* THE FOOT — leaving, and the one dangerous thing, set apart in the bear's ink */}
      <div className="px-5 py-3 border-t border-borderSubtle/60 flex items-center justify-between gap-6 max-sm:flex-col max-sm:items-stretch" data-settings-row="account-foot">
        <div className="text-[11px] text-textMuted">Signing out keeps everything on the account · deleting it takes the board, the marks and the scripts with it</div>
        <div className="shrink-0 flex items-center gap-2">
          <Door
            onClick={() => {
              signOutHere();
              navigate('/signin');
            }}
            title="Ends this visit's session here and opens the sign-in — the account stays as it is"
            testId="sign-out"
          >
            <LogOut className="w-3 h-3" /> Sign out
          </Door>
          <Door tone="bear" onClick={() => setDeleting(1)} title="Asks twice, then deletes the account and everything on this machine" testId="delete-account">
            <Trash2 className="w-3 h-3" /> Delete account
          </Door>
        </div>
      </div>
      {/* DELETE, ASKED TWICE (the door's own promise): what goes, then the word typed — irreversible, so a confirm and
          not an undo */}
      <Modal open={deleting > 0} onClose={() => setDeleting(0)} ariaLabel="Delete the account" header={<h2 className="text-[13px] font-semibold text-textPrimary">{deleting === 1 ? 'Delete the account?' : 'Delete it for good?'}</h2>} widthClass="max-w-[460px]">
        {deleting === 1 ? (
          <>
            <p className="text-[12px] text-textPrimary">The account goes, and with it everything this machine keeps for it: the board, the marks, the alerts, the desks, the journal and these settings. The scripts in the library go too.</p>
            <p className="text-[11px] text-textMuted">Export first (Settings › Data) if any of it should be kept.</p>
            <div className="flex items-center justify-end gap-2">
              <Door onClick={() => setDeleting(0)} testId="delete-keep">
                Keep it
              </Door>
              <Door tone="bear" onClick={() => setDeleting(2)} testId="delete-next">
                Continue
              </Door>
            </div>
          </>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={e => {
              e.preventDefault();
              if (typed.trim().toUpperCase() !== 'DELETE') return;
              clearLocal(true);
              window.location.assign('/');
            }}
          >
            <p className="text-[12px] text-textPrimary">This cannot be undone. Type DELETE to delete the account and clear this machine.</p>
            <input
              value={typed}
              onChange={e => setTyped(e.target.value)}
              aria-label="Type DELETE to confirm"
              autoComplete="off"
              spellCheck={false}
              className="h-8 px-2 rounded-md border border-borderSubtle bg-chip font-mono text-[12px] text-textPrimary outline-none focus:border-borderMuted"
              data-settings-delete-word
            />
            <div className="flex items-center justify-end gap-2">
              <Door onClick={() => setDeleting(0)} testId="delete-cancel">
                Keep it
              </Door>
              <button type="submit" disabled={typed.trim().toUpperCase() !== 'DELETE'} className="hit inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-bear/40 text-bear hover:bg-bear/10 font-mono text-[10px] uppercase tracking-wider disabled:opacity-40" data-settings-door="delete-confirm">
                <Trash2 className="w-3 h-3" /> Delete the account
              </button>
            </div>
          </form>
        )}
      </Modal>
    </Section>
  );
};

const STATUS_WORD: Record<SubscriptionStatus, string> = { active: 'active', past_due: 'payment due', canceled: 'ending' };

/* MONEY, SAID PLAINLY (Slayer Logo System, Web and App · Billing, 2026-10-01): the four notices a plan can need — the
   upgrade a page asks for, a plan ending, a payment that failed, a plan cancelled. Each is one card: the word over it, a
   sentence, what happens next, one or two doors — and every door acts (2026-10-09): Not now puts the notice away,
   Renew and Restart set the plan renewing, Update card opens the card's form, Upgrade moves the plan. The plan's own
   standing picks the notice; "Read a notice" shows any of the four. */
type NoticeKind = 'upgrade' | 'ending' | 'failed' | 'cancelled';
const NOTICE_OPTIONS: DropdownOption<NoticeKind | ''>[] = [
  { value: '', label: 'None', hint: 'What a plan in good standing shows' },
  { value: 'upgrade', label: 'Upgrade', hint: 'A page your plan does not hold' },
  { value: 'ending', label: 'Plan ending', hint: 'A plan that ends soon' },
  { value: 'failed', label: 'Payment failed', hint: 'A charge that did not go through' },
  { value: 'cancelled', label: 'Cancelled', hint: 'A plan that will not renew' },
];
const noticeFor = (status: SubscriptionStatus): NoticeKind | '' => (status === 'past_due' ? 'failed' : status === 'canceled' ? 'cancelled' : '');

const BillingNotice = ({ kind, until, held, onDismiss, onCard }: { kind: NoticeKind; until: string; held: boolean; onDismiss: () => void; onCard: () => void }) => {
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
            {/* the plan already held needs no door to itself (the audit's SE-7) */}
            {held ? (
              <span className="font-mono text-[11px] text-textMuted">Your plan holds Compass.</span>
            ) : (
              <Door
                onClick={() => {
                  setPlan('compass');
                  onDismiss();
                }}
                title="Moves the plan to Compass — the difference is charged today"
                testId="notice-upgrade"
              >
                Upgrade to Compass
              </Door>
            )}
            <Door onClick={onDismiss} title="Keep the plan you have" testId="notice-not-now">
              Not now
            </Door>
          </>
        )}
        {kind === 'ending' && (
          <Door
            onClick={() => {
              setRenewing(true);
              onDismiss();
            }}
            title="The plan renews at the end of this term"
            testId="notice-renew"
          >
            Renew
          </Door>
        )}
        {kind === 'failed' && (
          <Door onClick={onCard} title="The card's form, below" testId="notice-card">
            Update card
          </Door>
        )}
        {kind === 'cancelled' && (
          <>
            <Door
              onClick={() => {
                setRenewing(true);
                onDismiss();
              }}
              title="The plan renews again at the end of this term"
              testId="notice-restart"
            >
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
/** THE CARD'S FORM (the audit's SE-1: "Update" opened nothing). The number is checked (Luhn) and never kept — only its
    brand, its last four and the expiry are. */
const CardForm = ({ onDone }: { onDone: () => void }) => {
  const [number, setNumber] = useState('');
  const [exp, setExp] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const first = useRef<HTMLInputElement | null>(null);
  useEffect(() => first.current?.focus(), []);
  const save = () => {
    const digits = number.replace(/\D/g, '');
    if (!luhnOk(digits)) return setProblem('That card number does not check out');
    const m = /^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/.exec(exp.trim());
    if (!m) return setProblem('Expiry as MM/YY');
    const month = Number(m[1]);
    const year = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
    const now = new Date();
    if (month < 1 || month > 12 || year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return setProblem('That card has expired');
    setCard({ brand: cardBrand(digits), last4: digits.slice(-4), expMonth: month, expYear: year });
    onDone();
  };
  const field = 'h-8 px-2 rounded-md border bg-chip font-mono text-[12px] text-textPrimary placeholder:text-textMuted outline-none focus:border-borderMuted';
  return (
    <form
      className="px-5 pb-4 flex items-end gap-3 flex-wrap"
      onSubmit={e => {
        e.preventDefault();
        save();
      }}
      data-settings-card-form
    >
      <label className="flex flex-col gap-1 text-[11px] text-textMuted">
        Card number
        <input ref={first} value={number} onChange={e => { setNumber(e.target.value); setProblem(null); }} inputMode="numeric" autoComplete="cc-number" placeholder="1234 5678 9012 3456" className={`${field} w-[210px] ${problem ? 'border-warn/70' : 'border-borderSubtle'}`} />
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-textMuted">
        Expires
        <input value={exp} onChange={e => { setExp(e.target.value); setProblem(null); }} inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" className={`${field} w-[84px] border-borderSubtle`} />
      </label>
      <button type="submit" className="hit inline-flex items-center h-8 px-3 rounded-md border border-borderMuted font-mono text-[10px] uppercase tracking-wider text-textPrimary hover:bg-ink/[0.05]" data-settings-door="card-save">
        Save the card
      </button>
      <button type="button" onClick={onDone} className="hit inline-flex items-center h-8 px-2 rounded-md font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary" data-settings-door="card-cancel">
        Cancel
      </button>
      {problem && (
        <span role="alert" className="basis-full font-mono text-[10px] text-warn">
          {problem}
        </span>
      )}
      <span className="basis-full text-[11px] text-textMuted">Only the card's brand, its last four and the expiry are kept.</span>
    </form>
  );
};

const BillingBox = () => {
  const b = useBilling();
  const p = useProfile();
  const plan = planOf(b.plan);
  const [seen, setSeen] = useState<NoticeKind | ''>(() => noticeFor(b.status));
  const [cardOpen, setCardOpen] = useState(false);
  const plansRef = useRef<HTMLDivElement | null>(null);
  /* MANAGE BILLING goes to the plans and the renewal, here (the audit's SE-1) */
  const toPlans = () => {
    plansRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    plansRef.current?.focus({ preventScroll: true });
  };
  return (
    <Section id="billing" title="Billing" line="Your plan, the card behind it, and every receipt">
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
          {/* "· $180 then" repeated the price as if it changed (the audit's SE-11) — said only when it does */}
          <div className="mt-1 text-[11px] text-textMuted">
            {plan.kicker.replace(/\.$/, '')} · {b.status === 'canceled' ? 'ends' : 'renews'} {fmtDate(b.renewsOn)}
          </div>
        </div>
        <Door onClick={toPlans} title="The plans and the renewal, below" testId="manage-billing">
          <ArrowDown className="w-3 h-3" /> Manage billing
        </Door>
      </div>
      {seen && <BillingNotice kind={seen} until={fmtDate(b.renewsOn)} held={b.plan === 'compass'} onDismiss={() => setSeen('')} onCard={() => setCardOpen(true)} />}
      <Row name="Read a notice" line="How billing speaks when a plan needs something — each of the four, to read ahead" testId="billing-notice">
        <DropdownSelect<NoticeKind | ''> label="Notice" value={seen} options={NOTICE_OPTIONS} onChange={setSeen} title="Show a billing notice" testId="settings-billing-notice" align="end" />
      </Row>
      {/* THE TIERS — the landing's three, yours lit; up is Stripe's Checkout, down is the portal */}
      <div ref={plansRef} tabIndex={-1} className="px-5 pb-4 border-t border-borderSubtle/60 pt-3 outline-none scroll-mt-5" data-settings-row="plans">
        <div className="text-[12px] text-textPrimary">Plans</div>
        <div className="text-[11px] text-textMuted">Month to month, stopping at the end of the cycle · Lifetime is one payment</div>
        {/* one card a row on a phone (the audit's SE-4: three 105px cards, a word or two a line) */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    <Door onClick={() => setPlan(t.key)} title={t.monthly != null && plan.monthly != null && t.monthly > plan.monthly ? 'Moves the plan up now — the difference is charged today' : 'Moves the plan at the end of this cycle'} testId={`tier-${t.key}`}>
                      Switch
                    </Door>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <Row name="Renews" line={b.status === 'canceled' ? `Off — the plan ends on ${fmtDate(b.renewsOn)}` : `On — the next charge is ${fmtDate(b.renewsOn)}`} testId="renews">
        <Toggle on={b.status !== 'canceled'} onChange={setRenewing} label="Renew the plan at the end of the term" testId="renews" />
      </Row>
      <Row name="Payment method" line="The card behind the plan — its brand, last four and expiry" testId="card">
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
        <Door onClick={() => setCardOpen(o => !o)} title="Change the card" testId="update-card">
          {cardOpen ? 'Close' : 'Update'}
        </Door>
      </Row>
      {cardOpen && <CardForm onDone={() => setCardOpen(false)} />}
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
                  <button
                    type="button"
                    onClick={() => downloadReceipt(inv, { planName: planOf(inv.plan).name, date: fmtDate(inv.date), billing: b, name: p.name, email: p.email, descriptor: COMPANY.descriptor, company: COMPANY.product })}
                    className="hit inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary transition-colors"
                    title="Download the receipt as a PDF"
                    aria-label={`Download the receipt for ${fmtDate(inv.date)} as a PDF`}
                    data-settings-receipt={inv.id}
                  >
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
/** Clear what this machine keeps; `all` (deleting the account) takes the theme and the script library too */
function clearLocal(all = false): void {
  for (const k of localKeys()) if (all || !KEEP_ON_CLEAR.has(k)) localStorage.removeItem(k);
  if (all) {
    try {
      sessionStorage.clear();
      indexedDB.deleteDatabase('slayer_scripts');
    } catch {
      /* nothing kept there */
    }
  }
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
        <p className="text-[12px] text-textPrimary">The board, the marks, the alerts, the desks, these settings and your account details go. The theme stays; the scripts in the library stay.</p>
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
  const shell = useShellPrefs();
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
      {/* SPOKEN ALERTS (2026-10-09): the browser's own voice reads the alert's sentence — no model, nothing sent */}
      <Row name="Alerts out loud" line={canSpeak() ? 'Each alert said in the browser’s own voice as it fires — "SPY crossed the gamma flip at 475"' : 'This browser has no voice to say alerts with'} testId="speak">
        <Door onClick={() => speak('SPY crossed the gamma flip at 475', true)} disabled={!canSpeak()} title="Hear how an alert is said" testId="play-speak">
          <Megaphone className="w-3 h-3" /> Hear
        </Door>
        <Toggle on={shell.speak && canSpeak()} onChange={v => setShellPrefs({ speak: v })} label="Say alerts aloud" testId="speak" />
      </Row>
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
          {/* the version alone — the build's mode is the developer's word, not the reader's (the audit's X7.11) */}
          <div className="mt-1.5 font-mono text-[11px] tnum text-textMuted">{RELEASE}</div>
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
  const shell = useShellPrefs();
  const cvd = useColourVision();
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
            {/* Settings is a door, not a product: its gear tile, as on the rail (the audit's SE-5) */}
            <span className="inline-flex w-6 h-6 rounded-md border border-borderSubtle bg-inset items-center justify-center shrink-0" aria-hidden>
              <SettingsIcon className="w-3.5 h-3.5 text-textSecondary" />
            </span>
            <h1 className="text-[15px] font-semibold leading-tight text-textPrimary">Settings</h1>
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted">Your account and plan, how the terminal looks, what the desk opens on</p>
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
          {/* facts, not a statement (the audit's SE-12) — and a phone keeps the first two */}
          <div className="min-w-0 max-sm:hidden">
            <dt className="text-[10px] text-textMuted whitespace-nowrap">Clock</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap">{desk.clock === 'ny' ? 'New York' : 'Your own'}</dd>
          </div>
          <div className="min-w-0 max-sm:hidden">
            <dt className="text-[10px] text-textMuted whitespace-nowrap">Kept on</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap">this machine</dd>
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
                className={`hit flex items-center gap-2 px-2.5 h-8 rounded-md text-[12px] transition-colors text-left ${
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Theme">
                {(['dark', 'light', 'system'] as ThemeChoice[]).map(c => (
                  <ThemeTile key={c} choice={c} current={choice} onPick={setThemeChoice} />
                ))}
              </div>
            </div>
            <div className="px-5 pb-4 border-t border-borderSubtle/60 pt-3" data-settings-row="colour-vision">
              <div className="text-[12px] text-textPrimary" id="cvd-head">Direction colours</div>
              <div className="text-[11px] text-textMuted">What up and down are drawn in, on every page and chart</div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-labelledby="cvd-head">
                {(['standard', 'blue-orange'] as ColourVision[]).map(c => (
                  <CvdTile key={c} choice={c} current={cvd} />
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
            <Row name="Clock" line="New York's time or your own on every chart's axis and crosshair, and on the rail" testId="clock">
              <DropdownSelect<ClockZone> label="Clock" value={desk.clock} options={CLOCK_OPTIONS} onChange={v => setDeskPrefs({ clock: v })} title="Whose clock the axes keep" testId="settings-clock" align="end" />
            </Row>
            <Row name="Session strip" line="Under the rail's clock: where New York's day stands — pre-market, the open, lunch, power hour, the close, after hours — and how long to the next" testId="session-strip">
              <Toggle on={shell.sessionStrip} onChange={v => setShellPrefs({ sessionStrip: v })} label="Show the session strip" testId="session-strip" />
            </Row>
            <NotifyRow />
          </Section>
          )}

          {current === 'sounds' && <SoundsBox />}
          {current === 'invite' && <InviteBox />}
          {current === 'mail' && <MailBox />}

          {/* KEYBOARD */}
          {current === 'keyboard' && (
          <Section id="keyboard" title="Keyboard" line="Every key the terminal answers to, by where it works — press ? on any page for that page's own">
            {KEY_GROUPS.map(g => (
              <Fragment key={g.where}>
                {/* THE GROUP'S NAME — a whisper head over its rows, the house's section label */}
                <div className="px-5 pt-3 pb-1.5 border-t border-borderSubtle/60 text-[11px] font-semibold leading-[14px] text-textMuted" data-settings-key-group={g.where}>
                  {g.where}
                </div>
                {g.keys.map(s => (
                  <div key={s.does} className="px-5 py-2.5 border-t border-borderSubtle/60 flex items-center justify-between gap-6" data-settings-key>
                    <span className="text-[12px] text-textSecondary">{s.does}</span>
                    <span className="inline-flex items-center gap-1 shrink-0">
                      {s.keys.map((k, i) => (
                        <span key={k} className="inline-flex items-center gap-1">
                          {i > 0 && <span className="text-[10px] text-textMuted">{keyJoin(s)}</span>}
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
