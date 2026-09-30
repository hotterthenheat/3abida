/*
==================================================
  SLAYER TERMINAL - THE ROOM (pages/community/Room.tsx)
  Community is one room (2026-09-13; Noah, with
  his partner's page: "basically a community
  chatroom… his design pattern is not that bad but
  i think we can hone it to the next level… build
  it, you can delete everything on the community
  page"). Three columns, read left to right:

    THE READER      their picture, their handle,
                    their counts and the record
                    their settled setups build;
                    under it TRENDING — every $name
                    the room mentioned in the last
                    day, the most mentioned first,
                    a click cuts the feed to it
    THE FEED        the composer, then one box of
                    posts as rows: the person, the
                    body with every $name and
                    @handle a door, the lean in its
                    ink, a setup card that settles
                    on the record; the View · Lean ·
                    Name cards cut the rows; a click
                    keeps a post the Pulse way and
                    opens its replies under it
    THE ROOM'S EDGE notices, who to follow, the
                    rules

  It opens after launch: the whole room is drawn,
  then a translucent wall stands over it — the
  house glass — with one line. The wall is DOWN
  while the room is walked (WALL_DEFAULT); `?wall`
  on the URL puts it up to see it.

  Everything runs on the seeded room and this
  browser's storage (data/room.ts) — the shapes are
  the room's future contract.
==================================================
*/

import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Bell, Bookmark, Heart, MessageCircle, Send, Users, X } from 'lucide-react';
import Avatar from '../../components/ui/Avatar';
import CompanyLogo from '../../components/ui/CompanyLogo';
import ComingSoonWall, { useWalled } from '../../components/ui/ComingSoonWall';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import { initials, useProfile } from '../../data/profile';
import { fmtFollowers, fmtR, loadRoom, ME, PEOPLE, personOf, rMultiple, recordOf, saveRoom, SEED_NOTICES, SEED_POSTS, timeAgo, tokenize, trendingOf } from '../../data/room';
import type { Lean, Post, RoomState, Setup, SetupState } from '../../types/room';
import { ROOM_FOLLOW_H, ROOM_GRID, ROOM_NOTICE_H, ROOM_POST_H, ROOM_TREND_H } from './roomSkeleton';

const SILVER = 'rgb(var(--silver))';
const num = (v: number) => v.toLocaleString('en-US');
const leanInk = (l: Lean) => (l === 'BULLISH' ? 'text-bull' : 'text-bear');

/* THE CARDS — the feed's cuts as labelled cards (the house's, never chip rows) */
type View = 'feed' | 'following' | 'saved';
const VIEW_OPTIONS: DropdownOption<View>[] = [
  { value: 'feed', label: 'The room', hint: 'Every post, newest first' },
  { value: 'following', label: 'Following', hint: 'The people you follow' },
  { value: 'saved', label: 'Saved', hint: 'The posts you kept' },
];
type LeanCut = 'all' | Lean;
const LEAN_OPTIONS: DropdownOption<LeanCut>[] = [
  { value: 'all', label: 'Every post', hint: 'With a lean or without' },
  { value: 'BULLISH', label: 'Bullish', hint: 'Posts that lean up', tone: 'bull' },
  { value: 'BEARISH', label: 'Bearish', hint: 'Posts that lean down', tone: 'bear' },
];
const TIMEFRAMES: DropdownOption<string>[] = ['Same day', '1 week', '2 weeks', '1 month'].map(t => ({ value: t, label: t }));
const SETUP_LEANS: DropdownOption<Lean>[] = [
  { value: 'BULLISH', label: 'Bullish', hint: 'Long — the target above the entry', tone: 'bull' },
  { value: 'BEARISH', label: 'Bearish', hint: 'Short — the target below the entry', tone: 'bear' },
];

/** The house's small button — quiet at rest, silver when armed */
const Small = ({ children, onClick, armed = false, disabled = false, title, testId, className = '' }: { children: ReactNode; onClick?: () => void; armed?: boolean; disabled?: boolean; title?: string; testId?: string; className?: string }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border font-mono text-[10px] uppercase tracking-wider whitespace-nowrap transition-colors disabled:opacity-40 disabled:pointer-events-none ${
      armed ? 'border-silver/50 bg-silver/[0.08] text-silver hover:bg-silver/[0.14]' : 'border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted'
    } ${className}`}
    data-room-button={testId}
  >
    {children}
  </button>
);

/** A person's mark: their initials on the chip ground — monochrome, a person is not a colour */
const Mark = ({ handle, size }: { handle: string; size: number }) => {
  const p = personOf(handle);
  return (
    <span className="rounded-full shrink-0 inline-flex items-center justify-center border border-borderSubtle bg-chip font-mono font-bold text-textPrimary select-none" style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }} aria-hidden>
      {initials(p?.name ?? handle)}
    </span>
  );
};

/** The verified member's mark, in the silver */
const Verified = () => <BadgeCheck className="w-3.5 h-3.5 shrink-0" style={{ color: SILVER }} aria-label="Verified member" />;

const STATE_INK: Record<SetupState, string> = { OPEN: 'border-silver/50 text-silver', 'TARGET HIT': 'border-bull/50 text-bull', STOPPED: 'border-bear/50 text-bear' };

/** The setup as the record's row: the levels, the state, the settled line, the events as whispers */
const SetupCard = ({ s }: { s: Setup }) => {
  const r = rMultiple(s);
  return (
    <div className="mt-2 rounded-md border border-borderSubtle bg-chip/40 px-3 py-2" data-room-setup={s.ticker} data-state={s.state}>
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[11px]">
        <span className="inline-flex items-center gap-1.5">
          <CompanyLogo ticker={s.ticker} size={14} />
          <span className="font-mono font-bold text-textPrimary">{s.ticker}</span>
        </span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-textMuted">entry</span>
        <span className="font-mono tnum text-textPrimary">{s.entry}</span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-textMuted">target</span>
        <span className="font-mono tnum text-bull">{s.target}</span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-textMuted">stop</span>
        <span className="font-mono tnum text-bear">{s.stop}</span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-textMuted">over</span>
        <span className="text-textPrimary">{s.timeframe.toLowerCase()}</span>
        <span className={`ml-auto inline-flex items-center h-5 px-1.5 rounded border font-mono text-[9px] font-semibold uppercase tracking-wider ${STATE_INK[s.state]}`}>{s.state === 'OPEN' ? 'open' : s.state}</span>
      </div>
      {s.settledAt != null && r != null && (
        <div className="mt-1.5 flex items-center gap-2 text-[11px]">
          <span className="font-mono text-[9px] uppercase tracking-wider text-textMuted">settled at</span>
          <span className="font-mono tnum text-textPrimary">{s.settledAt}</span>
          <span className={`font-mono tnum font-semibold ${r >= 0 ? 'text-bull' : 'text-bear'}`} data-room-r>
            {fmtR(r)}
          </span>
          <span className="text-textMuted">· {s.state === 'TARGET HIT' ? 'the target printed' : 'the stop printed'}</span>
        </div>
      )}
      {s.events.map((e, i) => (
        <div key={i} className="mt-1 flex items-center gap-3 text-[10.5px]">
          <span className="font-mono tnum text-textMuted w-7 shrink-0">{timeAgo(e.at)}</span>
          <span className="font-mono text-[9px] uppercase tracking-wider text-textSecondary shrink-0">{e.kind}</span>
          <span className="text-textSecondary truncate">{e.note}</span>
        </div>
      ))}
    </div>
  );
};

/** The wall's rest state — UP (Noah, 2026-09-13 night: the coming-soon wall stands over the
    Community and the Watchlist pages, and nowhere else); `?open` on the URL takes it down for a walk */
const WALL_DEFAULT = true;

/* The room's own name is the reader's — remembered across route changes within a session */
let viewMemory: View = 'feed';

const Room = () => {
  const profile = useProfile();
  /* THE WALL (the first launch) — UP by rest since 2026-09-13 night (it stood down for the
     walk: Noah, "remove the coming soon part for now i want to see how the page looks");
     `?open` on the URL takes it down, `?wall` puts it up. The wall itself — the lamp, the
     beam, the countdown, the notify field — is the house's (components/ui/ComingSoonWall),
     the same glass over the Watchlist. */
  const walled = useWalled(WALL_DEFAULT);

  const [state, setState] = useState<RoomState>(loadRoom);
  const update = (next: RoomState) => {
    setState(next);
    saveRoom(next);
  };
  const [view, setViewState] = useState<View>(viewMemory);
  const setView = (v: View) => {
    viewMemory = v;
    setViewState(v);
  };
  const [lean, setLean] = useState<LeanCut>('all');
  const [name, setName] = useState<string>('all');
  const [person, setPerson] = useState<string | null>(null);
  const [kept, setKept] = useState<string | null>(null);

  /* The composer */
  const [text, setText] = useState('');
  const [setupOpen, setSetupOpen] = useState(false);
  const [sName, setSName] = useState('');
  const [sLean, setSLean] = useState<Lean>('BULLISH');
  const [sEntry, setSEntry] = useState('');
  const [sTarget, setSTarget] = useState('');
  const [sStop, setSStop] = useState('');
  const [sFrame, setSFrame] = useState('2 weeks');

  /* Every post: the reader's own first, then the seeded room, newest first */
  const posts = useMemo(() => [...state.posts, ...SEED_POSTS].sort((a, b) => b.at.localeCompare(a.at)), [state.posts]);
  const trending = useMemo(() => trendingOf(posts), [posts]);
  const nameOptions = useMemo<DropdownOption<string>[]>(() => [{ value: 'all', label: 'Every name', hint: 'Whatever the room is naming' }, ...trending.map(t => ({ value: t.name, label: `$${t.name}`, hint: `${t.posts} post${t.posts === 1 ? '' : 's'} in the last day` }))], [trending]);

  const shown = useMemo(
    () =>
      posts.filter(p => {
        if (view === 'following' && !state.following.includes(p.handle)) return false;
        if (view === 'saved' && !state.saved.includes(p.id)) return false;
        if (lean !== 'all' && p.lean !== lean) return false;
        if (name !== 'all' && !tokenize(p.body).some(t => t.kind === 'name' && t.text === name)) return false;
        if (person && p.handle !== person) return false;
        return true;
      }),
    [posts, view, lean, name, person, state.following, state.saved]
  );

  /* THE KEPT POST — the Pulse focus: the row lifted, the rest behind one blurred scrim */
  const pinned = kept != null && shown.some(p => p.id === kept);
  const [scrim, setScrim] = useState(false);
  useEffect(() => {
    if (pinned) {
      setScrim(true);
      return;
    }
    const t = window.setTimeout(() => setScrim(false), 460);
    return () => window.clearTimeout(t);
  }, [pinned]);
  useEffect(() => {
    if (!pinned) return;
    const onClick = (ev: MouseEvent) => {
      const t = ev.target as Element | null;
      if (t?.closest('[data-room-post],[data-dropdown],[data-dropdown-card],[role="menu"],[role="dialog"],button,a,input,textarea,select')) return;
      setKept(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setKept(null);
    };
    document.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [pinned]);

  const toggleIn = (key: 'liked' | 'saved' | 'following', id: string) => {
    const has = state[key].includes(id);
    const list = has ? state[key].filter(x => x !== id) : [...state[key], id];
    if (key === 'liked') {
      /* a like counts on the reader's own posts too */
      update({ ...state, liked: list, posts: state.posts.map(p => (p.id === id ? { ...p, likes: p.likes + (has ? -1 : 1) } : p)) });
    } else update({ ...state, [key]: list });
  };
  const likesOf = (p: Post) => p.likes + (p.handle !== ME && state.liked.includes(p.id) ? 1 : 0);

  /* THE POST — the setup rides along when its levels read */
  const setupValid = sName.trim().length > 0 && [sEntry, sTarget, sStop].every(v => v.trim() !== '' && Number.isFinite(Number(v)));
  const canPost = text.trim().length > 0 && (!setupOpen || setupValid);
  const post = () => {
    if (!canPost) return;
    const body = text.trim();
    const s: Setup | undefined =
      setupOpen && setupValid
        ? { ticker: sName.trim().toUpperCase().replace(/^\$/, ''), lean: sLean, entry: Number(sEntry), target: Number(sTarget), stop: Number(sStop), timeframe: sFrame, state: 'OPEN', events: [] }
        : undefined;
    const p: Post = { id: `me-${Date.now()}`, handle: ME, at: new Date().toISOString(), body: s && !body.includes(`$${s.ticker}`) ? `$${s.ticker} ${body}` : body, lean: s?.lean, setup: s, likes: 0, replies: [] };
    update({ ...state, posts: [p, ...state.posts] });
    setText('');
    setSetupOpen(false);
    setSName('');
    setSEntry('');
    setSTarget('');
    setSStop('');
    setView('feed');
  };

  /* The reader's record and counts */
  const myRecord = useMemo(() => recordOf(ME, posts), [posts]);
  const myPosts = state.posts.length;
  const top = trending[0] ?? null;
  const latestSettled = useMemo(() => posts.find(p => p.setup && p.setup.state !== 'OPEN') ?? null, [posts]);

  /* Who to follow: the people you do not, the most followed first */
  const suggested = useMemo(() => PEOPLE.filter(p => !state.following.includes(p.handle)).slice(0, 5), [state.following]);
  const nameOf = (handle: string) => (handle === ME ? profile.name : personOf(handle)?.name ?? handle);
  const handleOf = (handle: string) => (handle === ME ? profile.handle : handle);

  /* The body's doors: a $name to the name's page, an @handle to that person's posts */
  const drawBody = (body: string) =>
    tokenize(body).map((t, i) =>
      t.kind === 'text' ? (
        <Fragment key={i}>{t.text}</Fragment>
      ) : t.kind === 'name' ? (
        <Link key={i} to={`/dossier/stocks/${t.text}`} onClick={e => e.stopPropagation()} className="inline-flex items-baseline gap-1 align-baseline font-mono font-bold text-textPrimary hover:text-silver transition-colors" title={`${t.text}'s page`} data-room-name={t.text}>
          <CompanyLogo ticker={t.text} size={13} />${t.text}
        </Link>
      ) : (
        <button
          key={i}
          type="button"
          onClick={e => {
            e.stopPropagation();
            setPerson(t.text);
          }}
          className="font-mono text-textSecondary hover:text-silver transition-colors"
          title={`@${t.text}'s posts`}
          data-room-handle={t.text}
        >
          @{t.text}
        </button>
      )
    );

  const emptyWords = view === 'following' ? (state.following.length ? 'The people you follow have not posted on this cut.' : 'You follow no one yet — Who to follow is at the right.') : view === 'saved' ? 'Nothing saved yet — the bookmark on a post keeps it here.' : 'Nothing on this cut.';

  /* ---- the sentence ---------------------------------------------------------------- */
  const sentence = (
    <>
      {top ? (
        <>
          <button type="button" onClick={() => setName(name === top.name ? 'all' : top.name)} className="font-mono font-bold text-textPrimary hover:text-silver transition-colors" data-room-top={top.name}>
            ${top.name}
          </button>
          {` is the room's name today — ${top.posts} post${top.posts === 1 ? '' : 's'} in the last day${top.lean ? `, ` : ', split down the middle.'}`}
          {top.lean && (
            <>
              <span className={leanInk(top.lean)}>{top.lean.toLowerCase()}</span>
              {` ${Math.max(top.bullish, top.bearish)} to ${Math.min(top.bullish, top.bearish)}.`}
            </>
          )}
        </>
      ) : (
        'The room is quiet — nothing named in the last day.'
      )}
      {latestSettled?.setup && (
        <>
          {' '}
          <button type="button" onClick={() => setKept(latestSettled.id)} className="text-textPrimary hover:text-silver transition-colors" data-room-settled>
            {nameOf(latestSettled.handle)}'s ${latestSettled.setup.ticker} setup
          </button>
          {` ${latestSettled.setup.state === 'TARGET HIT' ? 'hit its target' : 'stopped out'} for `}
          <span className={`font-mono tnum font-semibold ${(rMultiple(latestSettled.setup) ?? 0) >= 0 ? 'text-bull' : 'text-bear'}`}>{fmtR(rMultiple(latestSettled.setup) ?? 0)}</span>.
        </>
      )}
    </>
  );

  return (
    <>
      {/* THE HEAD — the shell's own grammar */}
      <header className="flex items-start gap-6 flex-wrap pb-3 border-b border-borderSubtle" data-shell data-room-shell>
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-2.5" data-shell-page>
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-borderSubtle text-textSecondary shrink-0" aria-hidden="true">
              <Users className="w-3.5 h-3.5" />
            </span>
            <h1 className="text-[15px] font-semibold leading-tight text-textPrimary">Community</h1>
            <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">· the room</span>
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">Traders, their setups and the record they build — every $name a door, every @handle a person</p>
        </div>
      </header>

      <div className="relative" data-room data-walled={walled || undefined}>
        <div className={`${ROOM_GRID} ${walled ? 'pointer-events-none select-none' : ''}`} aria-hidden={walled || undefined} data-room-grid>
          {/* ---- THE READER ---------------------------------------------------------- */}
          <div className="flex flex-col gap-2.5 min-w-0">
            <div className="border border-borderSubtle rounded-md bg-panel overflow-hidden" data-room-profile>
              <div className="px-4 pt-4 pb-3 flex items-center gap-3">
                <Avatar profile={profile} size={44} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold text-textPrimary truncate">{profile.name}</div>
                  <div className="font-mono text-[11px] text-textMuted truncate">@{profile.handle}</div>
                </div>
              </div>
              <dl className="px-4 pb-3 flex gap-6">
                {[
                  ['Posts', num(myPosts)],
                  ['Followers', '0'],
                  ['Following', num(state.following.length)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dd className="font-mono text-[13px] font-bold tnum text-textPrimary">{v}</dd>
                    <dt className="text-[10px] text-textMuted">{k}</dt>
                  </div>
                ))}
              </dl>
              {/* THE RECORD the reader's settled setups build — the partner's subtitle promised it and his page never showed it */}
              <div className="px-4 py-2.5 border-t border-borderSubtle/60 text-[11px] text-textSecondary" data-room-record>
                {myRecord.settled === 0 ? (
                  <span className="text-textMuted">No setup settled yet.</span>
                ) : (
                  <>
                    <span className="font-mono tnum text-textPrimary">{myRecord.settled}</span> settled · <span className="font-mono tnum text-textPrimary">{myRecord.hit}</span> hit ·{' '}
                    <span className={`font-mono tnum font-semibold ${myRecord.r >= 0 ? 'text-bull' : 'text-bear'}`}>{fmtR(myRecord.r)}</span>
                  </>
                )}
              </div>
              <div className="px-4 py-2.5 border-t border-borderSubtle/60 flex items-center gap-2">
                <Link to="/settings/account" className="inline-flex items-center h-7 px-2.5 rounded-md border border-borderSubtle font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors">
                  Profile
                </Link>
                <Link to="/settings" className="inline-flex items-center h-7 px-2.5 rounded-md border border-borderSubtle font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors">
                  Settings
                </Link>
              </div>
            </div>

            {/* TRENDING — what the room is naming; the most mentioned wears the magenta */}
            <div className="border border-borderSubtle rounded-md bg-panel overflow-hidden" data-room-trending>
              <div className="px-4 h-10 flex items-center gap-2">
                <h3 className="text-[12px] font-semibold text-textPrimary">Trending</h3>
                <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-textMuted">last 24h</span>
              </div>
              {trending.slice(0, 8).map((t, i) => {
                const on = name === t.name;
                return (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => setName(on ? 'all' : t.name)}
                    title={on ? 'Every name again' : `Only posts naming $${t.name}`}
                    className={`w-full px-4 flex items-center gap-2.5 border-t border-borderSubtle/60 text-left transition-colors ${on ? 'bg-silver/[0.06] shadow-[inset_2px_0_0_0_rgb(var(--silver)/0.7)]' : 'hover:bg-silver/[0.04]'}`}
                    style={{ height: ROOM_TREND_H }}
                    data-room-trend={t.name}
                    data-on={on || undefined}
                  >
                    <span className="font-mono text-[9px] tnum text-textMuted w-3">{i + 1}</span>
                    <CompanyLogo ticker={t.name} size={15} />
                    <span className={`font-mono text-[11px] font-bold ${i === 0 ? 'text-supreme' : 'text-textPrimary'}`}>${t.name}</span>
                    {t.lean && <span className={`font-mono text-[8px] font-semibold uppercase tracking-wider ${leanInk(t.lean)}`}>{t.lean}</span>}
                    <span className="ml-auto font-mono text-[10px] tnum text-textMuted whitespace-nowrap">
                      {t.posts} post{t.posts === 1 ? '' : 's'}
                    </span>
                  </button>
                );
              })}
              {trending.length === 0 && <div className="px-4 py-3 border-t border-borderSubtle/60 text-[11px] text-textMuted">Nothing named in the last day.</div>}
            </div>
          </div>

          {/* ---- THE FEED ------------------------------------------------------------ */}
          {/* First on a phone: the room IS the feed; the reader's card and the notices follow it */}
          <div className="flex flex-col gap-2.5 min-w-0 max-lg:order-first">
            {/* THE COMPOSER */}
            <div className="border border-borderSubtle rounded-md bg-panel px-4 py-3 flex gap-3" data-room-composer>
              <Avatar profile={profile} size={32} />
              <div className="flex-1 min-w-0 flex flex-col gap-3">
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value.slice(0, 1000))}
                  rows={2}
                  placeholder="Share a read · $SPY, $NVDA and @handles are doors"
                  className="w-full bg-inputBg border border-borderSubtle rounded-md px-3 py-2 text-[12.5px] text-textPrimary placeholder:text-textMuted focus:border-borderMuted outline-none transition-colors resize-y"
                  data-room-field
                />
                {setupOpen && (
                  <div className="flex items-center gap-2 flex-wrap" data-room-setup-fields>
                    <input value={sName} onChange={e => setSName(e.target.value.toUpperCase())} placeholder="Name" maxLength={6} className="w-20 h-7 bg-inputBg border border-borderSubtle rounded-md px-2 font-mono text-[11px] uppercase text-textPrimary placeholder:text-textMuted placeholder:normal-case focus:border-borderMuted outline-none" />
                    <DropdownSelect label="Lean" value={sLean} options={SETUP_LEANS} onChange={setSLean} testId="room-setup-lean" />
                    {(
                      [
                        ['Entry', sEntry, setSEntry],
                        ['Target', sTarget, setSTarget],
                        ['Stop', sStop, setSStop],
                      ] as const
                    ).map(([label, v, set]) => (
                      <label key={label} className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md border border-borderSubtle bg-chip">
                        <span className="font-mono text-[9px] uppercase tracking-wider text-textMuted">{label}</span>
                        <input value={v} onChange={e => set(e.target.value)} inputMode="decimal" placeholder="0.00" className="w-16 bg-transparent font-mono text-[11px] tnum text-textPrimary placeholder:text-textMuted outline-none" />
                      </label>
                    ))}
                    <DropdownSelect label="Over" value={sFrame} options={TIMEFRAMES} onChange={setSFrame} testId="room-setup-frame" />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Small onClick={() => setSetupOpen(v => !v)} armed={setupOpen} title="Post a trade with its levels — it settles on your record" testId="setup">
                    Trade setup
                  </Small>
                  <span className="font-mono text-[10px] tnum text-textMuted">{text.length} / 1000</span>
                  <Small onClick={post} armed={canPost} disabled={!canPost} className="ml-auto" testId="post">
                    <Send className="w-3 h-3" /> Post
                  </Small>
                </div>
              </div>
            </div>

            {/* THE FEED BOX — the head, the cards, the sentence, the rows */}
            <div className="border border-borderSubtle rounded-md bg-panel overflow-clip" data-room-feed data-view={view} data-lean={lean} data-name={name} data-person={person ?? undefined} data-shown={shown.length}>
              <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="h-6 flex items-center gap-3">
                    <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">The room</h3>
                  </div>
                  <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">Every post, newest first · a click keeps a post and opens its replies · the cards cut the rows</p>
                </div>
                <dl className="flex flex-wrap gap-x-6 gap-y-2" data-room-facts>
                  <div>
                    <dt className="text-[10px] text-textMuted">Posts</dt>
                    <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary">{num(posts.length)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-textMuted">People</dt>
                    <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary">{PEOPLE.length + 1}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-supreme">Most named</dt>
                    <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary">{top ? `$${top.name} · ${top.posts} posts` : '—'}</dd>
                  </div>
                </dl>
              </div>
              <div className="px-5 pb-2 flex items-center gap-2 flex-wrap" data-room-cards>
                <DropdownSelect label="View" value={view} options={VIEW_OPTIONS} onChange={setView} title="Whose posts" testId="room-view" />
                <DropdownSelect label="Lean" value={lean} options={LEAN_OPTIONS} onChange={setLean} title="Which way the posts lean" testId="room-lean" />
                <DropdownSelect label="Name" value={name} options={nameOptions} onChange={setName} title="Only posts naming one name" testId="room-name" />
                {person && (
                  <span className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1 rounded-md border border-silver/50 bg-silver/[0.08] font-mono text-[10px] text-silver" data-room-person-chip>
                    @{handleOf(person)}'s posts
                    <button type="button" onClick={() => setPerson(null)} className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-ink/[0.08]" aria-label="Every person again">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                <span className="ml-auto font-mono text-[10px] tnum text-textMuted whitespace-nowrap">{shown.length} shown</span>
              </div>
              <p className="px-5 pb-3 text-[12px] leading-relaxed text-textSecondary" data-room-sentence>
                {sentence}
              </p>
              <div className="relative border-t border-borderSubtle">
                {/* THE FOCUS SCRIM — one layer for the blur and the dim; only its opacity animates (the ladder's own) */}
                <div
                  aria-hidden
                  data-room-scrim={pinned ? '' : undefined}
                  className={`pointer-events-none absolute inset-0 z-20 transition-opacity duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${pinned ? 'opacity-100' : 'opacity-0'}`}
                  style={{ backdropFilter: `blur(${scrim ? 3 : 0}px)`, WebkitBackdropFilter: `blur(${scrim ? 3 : 0}px)`, background: 'rgba(10,10,10,0.66)' }}
                />
                {shown.length === 0 && <div className="px-5 py-6 text-[11.5px] text-textMuted">{emptyWords}</div>}
                {shown.map(p => {
                  const who = personOf(p.handle);
                  const isKept = kept === p.id;
                  const liked = state.liked.includes(p.id);
                  const saved = state.saved.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => setKept(isKept ? null : p.id)}
                      className={`group px-4 py-3 flex gap-3 border-b border-borderSubtle/60 cursor-pointer transition-colors ${isKept ? 'relative z-30 bg-silver/[0.06] shadow-[inset_2px_0_0_0_rgb(var(--silver)/0.7)]' : 'hover:bg-silver/[0.04]'}`}
                      style={{ minHeight: ROOM_POST_H }}
                      title={isKept ? 'Let go of this post' : 'Keep this post and read its replies'}
                      data-room-post={p.id}
                      data-kept={isKept || undefined}
                    >
                      {p.handle === ME ? <Avatar profile={profile} size={32} /> : <Mark handle={p.handle} size={32} />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[12px] min-w-0">
                          <span className="font-semibold text-textPrimary truncate">{nameOf(p.handle)}</span>
                          {who?.verified && <Verified />}
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setPerson(p.handle);
                            }}
                            className="font-mono text-[11px] text-textMuted hover:text-silver transition-colors truncate"
                            title={`@${handleOf(p.handle)}'s posts`}
                          >
                            @{handleOf(p.handle)}
                          </button>
                          <span className="font-mono text-[11px] tnum text-textMuted">· {timeAgo(p.at)}</span>
                          {p.lean && <span className={`ml-auto font-mono text-[9px] font-semibold uppercase tracking-wider shrink-0 ${leanInk(p.lean)}`}>{p.lean}</span>}
                        </div>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-textPrimary">{drawBody(p.body)}</p>
                        {p.setup && <SetupCard s={p.setup} />}
                        <div className="mt-2 flex items-center gap-4 text-[11px]">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              toggleIn('liked', p.id);
                            }}
                            className={`inline-flex items-center gap-1.5 font-mono tnum transition-colors ${liked ? 'text-silver' : 'text-textMuted hover:text-textPrimary'}`}
                            title={liked ? 'Unlike' : 'Like'}
                            data-room-like
                          >
                            <Heart className="w-3.5 h-3.5" fill={liked ? 'currentColor' : 'none'} /> {num(likesOf(p))}
                          </button>
                          <span className="inline-flex items-center gap-1.5 font-mono tnum text-textMuted">
                            <MessageCircle className="w-3.5 h-3.5" /> {p.replies.length}
                          </span>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              toggleIn('saved', p.id);
                            }}
                            className={`inline-flex items-center gap-1.5 transition-colors ${saved ? 'text-silver' : 'text-textMuted hover:text-textPrimary'}`}
                            title={saved ? 'Let go of this post' : 'Keep this post on your shelf'}
                            data-room-save
                          >
                            <Bookmark className="w-3.5 h-3.5" fill={saved ? 'currentColor' : 'none'} />
                          </button>
                        </div>
                        {isKept && (
                          <div className="mt-3 border-t border-borderSubtle/60 pt-2.5 flex flex-col gap-2.5" data-room-replies>
                            {p.replies.length === 0 && <span className="text-[11px] text-textMuted">No replies yet.</span>}
                            {p.replies.map(r => (
                              <div key={r.id} className="flex gap-2.5">
                                <Mark handle={r.handle} size={22} />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 text-[11px]">
                                    <span className="font-semibold text-textPrimary">{nameOf(r.handle)}</span>
                                    {personOf(r.handle)?.verified && <Verified />}
                                    <span className="font-mono text-textMuted">@{r.handle}</span>
                                    <span className="font-mono tnum text-textMuted">· {timeAgo(r.at)}</span>
                                  </div>
                                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-textSecondary">{drawBody(r.body)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ---- THE ROOM'S EDGE ------------------------------------------------------ */}
          <div className="flex flex-col gap-2.5 min-w-0">
            <div className="border border-borderSubtle rounded-md bg-panel overflow-hidden" data-room-notices>
              <div className="px-4 h-10 flex items-center gap-2">
                <h3 className="text-[12px] font-semibold text-textPrimary">Notifications</h3>
                <Bell className="ml-auto w-3.5 h-3.5 text-textMuted" aria-hidden />
              </div>
              {SEED_NOTICES.map(n => (
                <div key={n.id} className="px-4 flex items-center gap-3 border-t border-borderSubtle/60" style={{ height: ROOM_NOTICE_H }}>
                  <Mark handle={n.handle} size={24} />
                  <div className="min-w-0">
                    <div className="text-[11.5px] text-textSecondary truncate">
                      <span className="font-semibold text-textPrimary">{nameOf(n.handle)}</span> {n.what}
                    </div>
                    <div className="font-mono text-[10px] tnum text-textMuted">{timeAgo(n.at)} ago</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border border-borderSubtle rounded-md bg-panel overflow-hidden" data-room-follow>
              <div className="px-4 h-10 flex items-center">
                <h3 className="text-[12px] font-semibold text-textPrimary">Who to follow</h3>
              </div>
              {suggested.map(p => (
                <div key={p.handle} className="px-4 flex items-center gap-3 border-t border-borderSubtle/60" style={{ height: ROOM_FOLLOW_H }} data-room-suggest={p.handle}>
                  <Mark handle={p.handle} size={28} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[12px] font-semibold text-textPrimary truncate">
                      {p.name}
                      {p.verified && <Verified />}
                    </div>
                    <div className="font-mono text-[10px] text-textMuted truncate">
                      @{p.handle} · {fmtFollowers(p.followers)}
                    </div>
                  </div>
                  <Small onClick={() => toggleIn('following', p.handle)} className="ml-auto" testId={`follow-${p.handle}`}>
                    Follow
                  </Small>
                </div>
              ))}
              {state.following.length > 0 && (
                <div className="px-4 py-2.5 border-t border-borderSubtle/60 flex flex-wrap gap-1.5" data-room-following>
                  {state.following.map(h => (
                    <button key={h} type="button" onClick={() => toggleIn('following', h)} className="inline-flex items-center gap-1 h-6 px-2 rounded-md border border-silver/50 bg-silver/[0.08] font-mono text-[10px] text-silver hover:bg-silver/[0.14] transition-colors" title="Unfollow">
                      @{h} <X className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="px-1 text-[10px] leading-relaxed text-textMuted" data-room-rules>
              New accounts read before they post · five posts in ten minutes at most · a report goes to the moderators and hides the post from your feed · block anyone · the silver mark is a verified member
            </p>
          </div>
        </div>

        {/* THE WALL — the house glass over the whole room until launch (Noah, 2026-09-13, with two
            references — a gradient wordmark over a dark page with a notify field, and a spotlight
            cone over "Coming Soon" with a countdown: "take inspiration from these 2 but make the
            room in the background seeable to some extent"); the room's two materials — the people
            and the names — stand at its foot */}
        {walled && (
          <ComingSoonWall
            kicker="The room"
            blurb="One room for the people trading with the terminal — their reads, their setups and the record those setups build. What stands under the glass is the shape of it."
            foot={
              <>
                <div className="flex items-center">
                  {PEOPLE.map((p, i) => (
                    <span key={p.handle} className={`rounded-full ring-2 ring-canvas ${i > 0 ? '-ml-2' : ''}`}>
                      <Mark handle={p.handle} size={26} />
                    </span>
                  ))}
                </div>
                <span className="font-mono text-[10px] text-textMuted whitespace-nowrap">{PEOPLE.length} traders already in</span>
                <span className="w-px h-4 bg-borderSubtle" />
                <div className="flex items-center gap-1.5">
                  {['SPY', 'NVDA', 'META', 'AAPL'].map(t => (
                    <span key={t} className="inline-flex items-center gap-1 h-6 px-2 rounded-md border border-borderSubtle bg-chip font-mono text-[10px] font-bold text-textPrimary">
                      <CompanyLogo ticker={t} size={12} />${t}
                    </span>
                  ))}
                </div>
              </>
            }
          />
        )}
      </div>
    </>
  );
};

export default Room;
