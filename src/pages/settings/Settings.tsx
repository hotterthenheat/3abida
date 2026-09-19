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

import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Check, CreditCard, Download, Info, Keyboard, LayoutDashboard, Palette, Pencil, ShieldCheck, Trash2, UserRound, type LucideIcon } from 'lucide-react';
import { accountAgeDays, updateAccount, useAccount, type Notifications } from '../../data/account';
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
/* THE ACCOUNT SETTINGS (Noah, 2026-09-13, the mockup): the rail reads My
   profile · Security · Notifications · Billing · Data export, then the
   terminal's own pages, and Delete account last in red; every setting a row
   — the name and one line at the left, the value or the switch at the right. */
export type SettingsSection = 'profile' | 'security' | 'notifications' | 'billing' | 'data' | 'appearance' | 'desk' | 'keyboard' | 'about' | 'delete' | 'account';
export const SETTINGS_SECTIONS: SettingsSection[] = ['profile', 'security', 'notifications', 'billing', 'data', 'appearance', 'desk', 'keyboard', 'about', 'delete'];
const isSection = (v: string | undefined): v is SettingsSection => (SETTINGS_SECTIONS as string[]).includes(v ?? '') || v === 'account';

const SECTIONS: { id: SettingsSection; label: string; icon: LucideIcon; danger?: boolean; gap?: boolean }[] = [
  { id: 'profile', label: 'My profile', icon: UserRound },
  { id: 'security', label: 'Security', icon: ShieldCheck },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'data', label: 'Data export', icon: Download },
  { id: 'appearance', label: 'Appearance', icon: Palette, gap: true },
  { id: 'desk', label: 'The desk', icon: LayoutDashboard },
  { id: 'keyboard', label: 'Keyboard', icon: Keyboard },
  { id: 'about', label: 'About', icon: Info },
  { id: 'delete', label: 'Delete account', icon: Trash2, danger: true, gap: true },
];
const NOTIFY_ROWS: { key: keyof Notifications; name: string; line: string }[] = [
  { key: 'likes', name: 'Likes', line: 'Someone liked a post or a setup of yours' },
  { key: 'comments', name: 'Comments', line: 'Someone commented on a post of yours' },
  { key: 'follows', name: 'Follows', line: 'Someone started following you' },
  { key: 'posts', name: 'People you follow post', line: 'A new post or setup from someone you follow' },
  { key: 'updates', name: 'Trade updates', line: 'A setup you follow was trimmed, moved, invalidated or closed' },
  { key: 'mentions', name: 'Mentions', line: 'Someone wrote @you' },
  { key: 'email', name: 'Alerts by email', line: 'The bell\'s alerts, to your inbox as well' },
  { key: 'newsletter', name: 'The weekly note', line: 'What shipped and what is next, once a week' },
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
  /* THE PAPER DESK'S KEYS (2026-09-19) — the defaults; every one is rebindable on the desk itself */
  { keys: ['B', '/', 'S'], does: 'Paper desk — buy or sell at the market (B then L, S then L: a limit at the cursor)' },
  { keys: ['C', '/', 'R'], does: 'Paper desk — close the position, or reverse it' },
  { keys: ['X', '/', 'Shift', 'X'], does: 'Paper desk — cancel the selected order, or all of them (rebind on the desk)' },
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
      <p className="mt-0.5 text-[11px] text-textSecondary">{line}</p>
    </div>
    {children}
  </section>
);

/** One setting: the name and its line at the left, the control at the right */
const Row = ({ name, line, children, testId }: { name: string; line: string; children?: ReactNode; testId: string }) => (
  <div className="px-5 py-3 border-t border-borderSubtle/60 flex items-center justify-between gap-6" data-settings-row={testId}>
    <div className="min-w-0">
      <div className="text-[12px] text-textPrimary">{name}</div>
      <div className="text-[11px] text-textSecondary">{line}</div>
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

/** A switch — on in the house select ink, off in the hairline grey */
const Switch = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-select' : 'bg-ink/20'}`} data-switch={on ? 'on' : 'off'}>
    <span className={`inline-block h-4 w-4 rounded-full bg-[#ededed] shadow transition-transform ${on ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
  </button>
);

/** A value with an Edit door — the mockup's grammar: the value printed, a small button beside it, an input while editing */
const Editable = ({ value, onSave, placeholder, mono = false, testId }: { value: string; onSave: (v: string) => void; placeholder?: string; mono?: boolean; testId: string }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  if (editing)
    return (
      <span className="inline-flex items-center gap-1.5" data-editable={testId}>
        <input
          autoFocus
          value={draft}
          placeholder={placeholder}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              onSave(draft.trim());
              setEditing(false);
            }
            if (e.key === 'Escape') setEditing(false);
          }}
          className={`w-56 h-7 bg-inputBg border border-borderSubtle rounded-md px-2 text-[12px] text-textPrimary placeholder:text-textMuted focus:border-silver/50 outline-none ${mono ? 'font-mono' : ''}`}
        />
        <button
          type="button"
          onClick={() => {
            onSave(draft.trim());
            setEditing(false);
          }}
          className="inline-flex items-center h-7 px-2.5 rounded-md border border-select/40 bg-select/[0.08] font-mono text-[10px] uppercase tracking-wider text-select"
        >
          Save
        </button>
      </span>
    );
  return (
    <span className="inline-flex items-center gap-2" data-editable={testId}>
      <span className={`text-[12px] text-textPrimary ${mono ? 'font-mono' : ''}`}>{value || <span className="text-textMuted">{placeholder ?? 'not set'}</span>}</span>
      <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-borderSubtle font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors">
        Edit <Pencil className="w-3 h-3" />
      </button>
    </span>
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
  const account = useAccount();
  const [confirmDelete, setConfirmDelete] = useState(false);

  /* THE SUBPAGE — from the route; a step to another lands at the head */
  const { section } = useParams<{ section?: string }>();
  const current: SettingsSection = section === 'account' ? 'profile' : isSection(section) ? section : 'profile';
  useEffect(() => {
    const main = document.querySelector<HTMLElement>('main');
    if (main && main.scrollTop > 0) main.scrollTop = 0;
  }, [current]);
  if (!isSection(section) || section === 'account') return <Navigate to="/settings/profile" replace />;

  return (
    <>
      {/* THE HEAD — the house mark as the page's chip, the name, one line, the facts */}
      <header className="flex items-start gap-6 flex-wrap pb-3 border-b border-borderSubtle" data-shell data-settings-shell>
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-2.5" data-shell-page>
            <Mark />
            <h1 className="text-[15px] font-semibold leading-tight text-textPrimary">Account settings</h1>
          </div>
          <p className="mt-0.5 text-[11px] text-textSecondary whitespace-nowrap truncate">
            {account.name} · @{account.handle} · {account.email} · {account.plan} plan
          </p>
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
          {SECTIONS.map(s => {
            const on = s.id === current;
            const Icon = s.icon;
            return (
              <Link
                key={s.id}
                to={`/settings/${s.id}`}
                aria-current={on ? 'page' : undefined}
                className={`flex items-center gap-2 px-2.5 h-8 rounded-md text-[12px] transition-colors text-left ${
                  on ? 'bg-select/[0.12] text-textPrimary font-medium' : s.danger ? 'text-bear hover:bg-bear/[0.06]' : 'text-textSecondary hover:text-textPrimary hover:bg-ink/[0.03]'
                } ${s.gap ? 'xl:mt-3' : ''}`}
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

          {/* MY PROFILE */}
          {current === 'profile' && (
          <Section id="profile" title="My profile" line="Who you are on the terminal and in the community — the name on your posts, the handle people follow">
            <Row name="Name" line="Printed on your posts and your setups" testId="name">
              <Editable value={account.name} onSave={v => v && updateAccount({ name: v })} testId="name" />
            </Row>
            <Row name="Handle" line="Your @ in the community — letters, numbers and underscores" testId="handle">
              <Editable value={`@${account.handle}`} mono onSave={v => { const h = v.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, ''); if (h) updateAccount({ handle: h }); }} testId="handle" />
            </Row>
            <Row name="Bio" line="One or two lines under your name on your profile" testId="bio">
              <Editable value={account.bio} placeholder="say what you trade" onSave={v => updateAccount({ bio: v })} testId="bio" />
            </Row>
            <Row name="Links" line="A site, an X handle — comma-separated" testId="links">
              <Editable value={account.links.join(', ')} mono placeholder="none" onSave={v => updateAccount({ links: v.split(',').map(x => x.trim()).filter(Boolean) })} testId="links" />
            </Row>
            <Row name="Member since" line="The account's age — the community's posting gate reads it" testId="since">
              <span className="font-mono text-[12px] tnum text-textPrimary">{new Date(account.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {accountAgeDays(account)} days</span>
            </Row>
          </Section>
          )}

          {/* SECURITY */}
          {current === 'security' && (
          <Section id="security" title="Security" line="The email, the password and the second step that guard the account">
            <Row name="Email address" line="The email address associated with your account" testId="email">
              <span className="inline-flex items-center gap-2">
                <span className="flex flex-col items-end">
                  <Editable value={account.email} mono onSave={v => v && updateAccount({ email: v, emailVerified: false })} testId="email" />
                  <span className={`mt-0.5 font-mono text-[9px] uppercase tracking-widest ${account.emailVerified ? 'text-bull' : 'text-bear'}`}>{account.emailVerified ? 'verified' : 'unverified'}</span>
                </span>
                {!account.emailVerified && (
                  <button type="button" onClick={() => updateAccount({ emailVerified: true })} className="inline-flex items-center h-7 px-2.5 rounded-md border border-borderSubtle font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors" data-verify-email>
                    Verify
                  </button>
                )}
              </span>
            </Row>
            <Row name="Password" line="Set a unique password to protect your account" testId="password">
              <button type="button" className="inline-flex items-center h-7 px-2.5 rounded-md border border-borderSubtle font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors" data-change-password>
                Change password
              </button>
            </Row>
            <Row name="2-step verification" line="Make your account extra secure — along with your password, you'll need to enter a code" testId="two-step">
              <Switch on={account.twoStep} onChange={v => updateAccount({ twoStep: v })} label="2-step verification" />
            </Row>
            <Row name="Blocked members" line="People you blocked in the community — they cannot see your posts or reach you" testId="blocked">
              <Link to="/community" className="font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary">manage in the community</Link>
            </Row>
            <Row name="Deactivate my account" line="This will shut down your account. Your account will be reactivated when you sign in again." testId="deactivate">
              <button type="button" onClick={() => updateAccount({ deactivated: !account.deactivated })} className={`inline-flex items-center h-7 px-2.5 rounded-md border font-mono text-[10px] uppercase tracking-wider transition-colors ${account.deactivated ? 'border-bull/40 text-bull' : 'border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted'}`} data-deactivate>
                {account.deactivated ? 'Reactivate' : 'Deactivate'}
              </button>
            </Row>
            <Row name="Delete account" line="This will delete your account. Your account will be permanently deleted from the terminal." testId="delete-link">
              <Link to="/settings/delete" className="font-mono text-[10px] uppercase tracking-wider text-bear hover:underline underline-offset-2">Delete</Link>
            </Row>
          </Section>
          )}

          {/* NOTIFICATIONS */}
          {current === 'notifications' && (
          <Section id="notifications" title="Notifications" line="What the bell and the inbox may say — every switch saves as you go">
            {NOTIFY_ROWS.map(r => (
              <Row key={r.key} name={r.name} line={r.line} testId={`notify-${r.key}`}>
                <Switch on={account.notifications[r.key]} onChange={v => updateAccount({ notifications: { ...account.notifications, [r.key]: v } })} label={r.name} />
              </Row>
            ))}
          </Section>
          )}

          {/* BILLING */}
          {current === 'billing' && (
          <Section id="billing" title="Billing" line="The plan and the card behind it">
            <Row name="Plan" line="Free reads the delayed tape; Pro is the live terminal; Desk adds seats and the data keys" testId="plan">
              <span className="inline-flex rounded-md border border-borderSubtle overflow-hidden" role="group" aria-label="Plan">
                {(['Free', 'Pro', 'Desk'] as const).map(p => (
                  <button key={p} type="button" aria-pressed={account.plan === p} onClick={() => updateAccount({ plan: p })} className="h-7 px-3 font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary aria-pressed:bg-select/[0.12] aria-pressed:text-textPrimary transition-colors" data-plan={p}>
                    {p}
                  </button>
                ))}
              </span>
            </Row>
            <Row name="Card" line="The card on file — arrives with the launch, when the plan is paid" testId="card">
              <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted border border-borderSubtle rounded px-2 py-0.5 whitespace-nowrap">with the launch</span>
            </Row>
            <Row name="Invoices" line="Every charge, as a PDF" testId="invoices">
              <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted border border-borderSubtle rounded px-2 py-0.5 whitespace-nowrap">none yet</span>
            </Row>
          </Section>
          )}

          {/* DATA EXPORT */}
          {current === 'data' && (
          <Section id="data" title="Data export" line="Everything the terminal keeps for you, as a file you own">
            <Row name="Your board, marks and settings" line="The names on your board, your positions, your alerts, your scripts and every preference — one JSON file" testId="export-all">
              <button
                type="button"
                onClick={() => {
                  const dump: Record<string, unknown> = {};
                  try {
                    for (let i = 0; i < localStorage.length; i++) {
                      const k = localStorage.key(i);
                      if (k && k.startsWith('slayer_')) dump[k] = JSON.parse(localStorage.getItem(k) ?? 'null');
                    }
                  } catch {
                    /* storage off — an empty file says so */
                  }
                  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'slayer-terminal-export.json';
                  a.click();
                  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-borderSubtle font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors"
                data-export
              >
                <Download className="w-3 h-3" /> Export
              </button>
            </Row>
            <Row name="Your community posts" line="Your posts, setups and their updates, as JSON" testId="export-posts">
              <button
                type="button"
                onClick={() => {
                  let posts: unknown = [];
                  try {
                    posts = JSON.parse(localStorage.getItem('slayer_room') ?? '[]');
                  } catch {
                    posts = [];
                  }
                  const blob = new Blob([JSON.stringify(posts, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'slayer-community-export.json';
                  a.click();
                  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-borderSubtle font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors"
                data-export-posts
              >
                <Download className="w-3 h-3" /> Export
              </button>
            </Row>
          </Section>
          )}

          {/* DELETE ACCOUNT */}
          {current === 'delete' && (
          <Section id="delete" title="Delete account" line="This cannot be undone — the account, its board, its marks and its posts go with it">
            <Row name="Delete my account" line="Everything the terminal keeps for you in this browser is erased. Export it first if you want a copy." testId="delete">
              {confirmDelete ? (
                <span className="inline-flex items-center gap-2">
                  <span className="text-[11px] text-bear">Sure? This erases everything.</span>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const keys: string[] = [];
                        for (let i = 0; i < localStorage.length; i++) {
                          const k = localStorage.key(i);
                          if (k && k.startsWith('slayer_')) keys.push(k);
                        }
                        keys.forEach(k => localStorage.removeItem(k));
                      } catch {
                        /* storage off */
                      }
                      window.location.assign('/');
                    }}
                    className="inline-flex items-center h-7 px-2.5 rounded-md border border-bear/50 bg-bear/[0.1] font-mono text-[10px] uppercase tracking-wider text-bear"
                    data-delete-confirm
                  >
                    Yes, delete
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="inline-flex items-center h-7 px-2.5 rounded-md border border-borderSubtle font-mono text-[10px] uppercase tracking-wider text-textSecondary">
                    Keep it
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-bear/40 font-mono text-[10px] uppercase tracking-wider text-bear hover:bg-bear/[0.08] transition-colors" data-delete>
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              )}
            </Row>
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
              <Link to="/feedback" className="ml-auto shrink-0 inline-flex items-center h-7 px-2.5 rounded-md border border-borderSubtle font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors">
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
