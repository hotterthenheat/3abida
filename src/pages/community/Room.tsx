/*
==================================================
  SLAYER TERMINAL - THE ROOM
  (pages/community/Room.tsx)

  The community as one room (Noah, 2026-09-13): the
  layout of the photo he sent — you at the left with
  your numbers and your doors, and the names the
  room is talking about; the feed in the middle,
  Feed and Following, with the composer over it — a
  quick thought or a TRADE SETUP, screenshots pasted
  straight in with Cmd+V; the bell and who to follow
  at the right. Every $NAME a door to its own page;
  every @handle a door to a profile. The store is
  data/room.ts; the card is components/community.
==================================================
*/

import { useMemo, useRef, useState, type ClipboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Bell, Bookmark, Flame, ImagePlus, LogOut, Settings as SettingsIcon, UserRound, Users, X } from 'lucide-react';
import { useAccount } from '../../data/account';
import { allPosts, blockList, followingPosts, markNotesRead, me, memberOf, notes, post as postToRoom, postGate, savedPosts, suggestions, timeAgo, toggleBlock, toggleFollow, trackRecord, trending, unreadNotes, useRoom, type Bias, type NoteKind } from '../../data/room';
import PostCard, { Avatar } from '../../components/community/PostCard';
import CardTabs from '../../components/ui/CardTabs';
import CompanyLogo from '../../components/ui/CompanyLogo';

type Tab = 'feed' | 'following' | 'saved';
const TABS = [
  { value: 'feed', label: 'Feed' },
  { value: 'following', label: 'Following' },
  { value: 'saved', label: 'Saved' },
] as const;
const TIMEFRAMES = ['intraday', '0DTE', '2 sessions', '3–5 sessions', '2 weeks', 'into earnings'];
const NOTE_WORD: Record<NoteKind, string> = { like: 'liked', comment: 'commented', follow: 'followed', post: 'posted', update: 'updated', mention: 'mentioned you' };

const Card = ({ title, children, right }: { title?: string; children: React.ReactNode; right?: React.ReactNode }) => (
  <div className="border border-borderSubtle rounded-md bg-panel">
    {title && (
      <div className="px-4 pt-3 pb-2 flex items-center gap-2">
        <span className="text-[13px] font-semibold text-textPrimary">{title}</span>
        {right}
      </div>
    )}
    {children}
  </div>
);

const Room = () => {
  const rev = useRoom();
  const account = useAccount();
  const myself = me();
  const [tab, setTab] = useState<Tab>('feed');
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [asSetup, setAsSetup] = useState(false);
  const [bias, setBias] = useState<Bias>('bullish');
  const [ticker, setTicker] = useState('');
  const [entry, setEntry] = useState('');
  const [target, setTarget] = useState('');
  const [stop, setStop] = useState('');
  const [tf, setTf] = useState(TIMEFRAMES[0]);
  const [err, setErr] = useState<string | null>(null);
  const [bellOpen, setBellOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const gate = postGate();
  /* THE VERSION is the dep, not the hook — `useRoom` never changes identity, so
     the feed froze the moment anything was written to the room (2026-09-13) */
  const posts = useMemo(() => (tab === 'feed' ? allPosts() : tab === 'following' ? followingPosts() : savedPosts()), [tab, rev]);
  const record = trackRecord(account.handle);
  const hot = trending();
  const who = suggestions();
  const bell = notes();
  const unread = unreadNotes();

  const readFiles = (files: FileList | File[]) => {
    Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .slice(0, 4)
      .forEach(f => {
        const r = new FileReader();
        r.onload = () => setImages(imgs => [...imgs, String(r.result)].slice(0, 4));
        r.readAsDataURL(f);
      });
  };
  /* Cmd+V / Ctrl+V a screenshot straight into the composer */
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files ?? []).filter(f => f.type.startsWith('image/'));
    if (files.length) {
      e.preventDefault();
      readFiles(files);
    }
  };
  const submit = () => {
    const setup = asSetup ? { ticker: ticker.trim().toUpperCase(), bias, entry: Number(entry), target: Number(target), stop: Number(stop), timeframe: tf } : undefined;
    if (setup && (!setup.ticker || !Number.isFinite(setup.entry) || !Number.isFinite(setup.target) || !Number.isFinite(setup.stop) || !entry || !target || !stop)) {
      setErr('A setup needs the name, the entry, the target and the stop.');
      return;
    }
    const body = setup && !text.trim() ? `$${setup.ticker} ${setup.bias} ${setup.timeframe}.` : text;
    const r = postToRoom(body, images, setup);
    if (typeof r === 'string') {
      setErr(r);
      return;
    }
    setErr(null);
    setText('');
    setImages([]);
    setAsSetup(false);
    setTicker('');
    setEntry('');
    setTarget('');
    setStop('');
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_300px] gap-4 items-start" data-room>
      {/* THE LEFT — you, and what the room is talking about */}
      <div className="flex flex-col gap-4 xl:sticky xl:top-4">
        <Card>
          <div className="px-4 pt-4 pb-3 flex items-center gap-3">
            <Avatar handle={account.handle} size={44} />
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-[14px] font-semibold text-textPrimary">
                {myself.name}
                {myself.verified && <BadgeCheck className="w-3.5 h-3.5 text-select" />}
              </div>
              <div className="font-mono text-[11px] text-textSecondary">@{account.handle}</div>
            </div>
          </div>
          <div className="px-4 pb-3 grid grid-cols-3 gap-2 font-mono text-[11px] tnum" data-room-counts>
            {[
              [record.open + record.finished.length + allPosts().filter(p => p.author === account.handle && !p.setup).length, 'Posts'],
              [myself.followers, 'Followers'],
              [myself.following, 'Following'],
            ].map(([n, w]) => (
              <div key={w as string}>
                <div className="text-[14px] font-bold text-textPrimary">{typeof n === 'number' && n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n}</div>
                <div className="text-textSecondary">{w}</div>
              </div>
            ))}
          </div>
          {record.winRate != null && (
            <div className="mx-4 mb-3 rounded-md border border-borderSubtle px-3 py-2 font-mono text-[10px] tnum" data-room-record>
              <span className="uppercase tracking-widest text-textSecondary">Track record</span> <span className="text-bull">{record.wins}W</span> <span className="text-bear">{record.losses}L</span> <span className="text-textSecondary">· {record.winRate}%</span>
            </div>
          )}
          <nav className="border-t border-borderSubtle" data-room-doors>
            {[
              ['/community/me', 'Profile', UserRound],
              ['/community/me?tab=following', 'Following', Users],
              ['#saved', 'Saved', Bookmark],
              ['/settings/profile', 'Settings', SettingsIcon],
              ['/settings/security', 'Log out', LogOut],
            ].map(([to, label, Icon]) => (
              <Link
                key={label as string}
                to={to as string}
                onClick={e => {
                  if (to === '#saved') {
                    e.preventDefault();
                    setTab('saved');
                  }
                }}
                className="flex items-center gap-2.5 px-4 h-9 border-b border-borderSubtle/50 last:border-b-0 text-[12px] text-textPrimary hover:bg-ink/[0.04] transition-colors"
              >
                {(() => {
                  const I = Icon as typeof UserRound;
                  return <I className="w-3.5 h-3.5 text-textSecondary" />;
                })()}
                {label as string}
              </Link>
            ))}
          </nav>
        </Card>
        {blockList().length > 0 && (
          <Card title="Blocked" right={<span className="font-mono text-[9px] uppercase tracking-widest text-textSecondary ml-auto">they cannot reach you</span>}>
            <div className="pb-2" data-room-blocked>
              {blockList().map(h => (
                <div key={h} className="px-4 py-2 flex items-center gap-2.5 border-t border-borderSubtle/50">
                  <Avatar handle={h} size={24} />
                  <span className="min-w-0 truncate text-[12px] text-textPrimary">{memberOf(h)?.name ?? h}</span>
                  <button type="button" onClick={() => toggleBlock(h)} className="ml-auto h-7 px-2.5 rounded-md border border-borderSubtle font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors" data-unblock={h}>
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          </Card>
        )}
        <Card title="Trending" right={<span className="font-mono text-[9px] uppercase tracking-widest text-textSecondary ml-auto">what the room is on</span>}>
          <div className="pb-2" data-room-trending>
            {hot.length === 0 && <div className="px-4 pb-2 text-[11px] text-textSecondary">Quiet — nothing trending in the last six hours</div>}
            {hot.map((t, i) => (
              <Link key={t.ticker} to={`/community/t/${t.ticker}`} className="flex items-center gap-2 px-4 h-9 hover:bg-ink/[0.04] transition-colors" data-trend={t.ticker}>
                <span className="font-mono text-[10px] text-textSecondary w-4">{i + 1}</span>
                <CompanyLogo ticker={t.ticker} size={14} />
                <span className="font-mono text-[12px] font-semibold text-textPrimary">${t.ticker}</span>
                <span className={`font-mono text-[9px] uppercase tracking-wider ${t.bias === 'bullish' ? 'text-bull' : t.bias === 'bearish' ? 'text-bear' : 'text-textSecondary'}`}>{t.bias}</span>
                <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] tnum text-textSecondary">
                  <Flame className="w-3 h-3 text-warn" /> {t.posts} posts
                </span>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* THE MIDDLE — the composer and the feed */}
      <div className="min-w-0 flex flex-col gap-4">
        <Card>
          <div className="px-4 pt-3 pb-3 flex gap-3" data-room-composer>
            <Avatar handle={account.handle} size={36} />
            <div className="min-w-0 flex-1">
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                onPaste={onPaste}
                rows={asSetup ? 2 : 3}
                placeholder={asSetup ? 'The thesis — why this level, why now' : 'Share a thought · $SPY, $NVDA, @handles are doors · paste a screenshot straight in'}
                className="w-full bg-inputBg border border-borderSubtle rounded-md px-3 py-2 text-[13px] leading-relaxed text-textPrimary placeholder:text-textMuted outline-none focus:border-silver/50 resize-y"
                data-composer-text
              />
              {images.length > 0 && (
                <div className="mt-2 flex gap-2 flex-wrap" data-composer-images>
                  {images.map((src, i) => (
                    <span key={i} className="relative">
                      <img src={src} alt="" className="h-20 rounded-md border border-borderSubtle object-cover" />
                      <button type="button" onClick={() => setImages(imgs => imgs.filter((_, k) => k !== i))} aria-label="Remove" className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-panel border border-borderMuted text-textPrimary inline-flex items-center justify-center">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {asSetup && (
                <div className="mt-2 rounded-md border border-borderSubtle px-3 py-2 grid grid-cols-2 md:grid-cols-6 gap-2 items-end" data-composer-setup>
                  <label className="text-[10px] text-textSecondary">
                    Bias
                    <span className="mt-1 inline-flex w-full rounded-md border border-borderSubtle overflow-hidden">
                      {(['bullish', 'bearish'] as Bias[]).map(b => (
                        <button key={b} type="button" aria-pressed={bias === b} onClick={() => setBias(b)} className={`flex-1 h-7 font-mono text-[10px] uppercase tracking-wider ${bias === b ? (b === 'bullish' ? 'bg-bull/20 text-bull' : 'bg-bear/20 text-bear') : 'text-textSecondary'}`}>
                          {b}
                        </button>
                      ))}
                    </span>
                  </label>
                  <label className="text-[10px] text-textSecondary">
                    Name
                    <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} maxLength={6} placeholder="SPY" className="mt-1 w-full h-7 bg-inputBg border border-borderSubtle rounded-md px-2 font-mono text-[12px] uppercase text-textPrimary outline-none focus:border-silver/50" />
                  </label>
                  {[
                    ['Entry', entry, setEntry],
                    ['Target', target, setTarget],
                    ['Stop', stop, setStop],
                  ].map(([l, v, set]) => (
                    <label key={l as string} className="text-[10px] text-textSecondary">
                      {l as string}
                      <input value={v as string} onChange={e => (set as (s: string) => void)(e.target.value)} inputMode="decimal" placeholder="0.00" className="mt-1 w-full h-7 bg-inputBg border border-borderSubtle rounded-md px-2 font-mono text-[12px] text-textPrimary outline-none focus:border-silver/50" />
                    </label>
                  ))}
                  <label className="text-[10px] text-textSecondary">
                    Timeframe
                    <select value={tf} onChange={e => setTf(e.target.value)} className="mt-1 w-full h-7 bg-inputBg border border-borderSubtle rounded-md px-1 font-mono text-[11px] text-textPrimary">
                      {TIMEFRAMES.map(t => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <button type="button" onClick={() => setAsSetup(v => !v)} aria-pressed={asSetup} className={`h-7 px-2.5 rounded-md border font-mono text-[10px] uppercase tracking-wider transition-colors ${asSetup ? 'border-select/50 bg-select/[0.12] text-textPrimary' : 'border-borderSubtle bg-chip text-textSecondary hover:text-textPrimary'}`} data-composer-setup-toggle>
                  {asSetup ? 'Trade setup · on' : 'Trade setup'}
                </button>
                <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-borderSubtle bg-chip font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary" title="Add a screenshot — or paste one with Cmd+V">
                  <ImagePlus className="w-3.5 h-3.5" /> Image
                </button>
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => e.target.files && readFiles(e.target.files)} />
                <span className="font-mono text-[10px] text-textSecondary">{text.length} / 1000</span>
                <button type="button" onClick={submit} disabled={!!gate} title={gate ?? 'Post to the room'} className="ml-auto h-8 px-4 rounded-full bg-[#ededed] text-[#0a0a0a] text-[12px] font-semibold hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed" data-composer-post>
                  Post
                </button>
              </div>
              {(gate || err) && <div className="mt-1.5 text-[11px] text-warn" data-composer-gate>{err ?? gate}</div>}
            </div>
          </div>
        </Card>

        <Card>
          <div className="px-4 py-2 border-b border-borderSubtle flex items-center gap-4">
            <CardTabs options={TABS} value={tab} onChange={setTab} ariaLabel="Which feed" />
            <span className="ml-auto font-mono text-[10px] tnum text-textSecondary">{posts.length} posts</span>
          </div>
          <div data-room-feed={tab}>
            {posts.length === 0 && <div className="px-4 py-10 text-center font-mono text-[10px] uppercase tracking-widest text-textSecondary">{tab === 'following' ? 'Follow someone — their posts gather here' : tab === 'saved' ? 'Nothing saved yet' : 'The room is quiet'}</div>}
            {posts.map(p => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </Card>
      </div>

      {/* THE RIGHT — the bell, who to follow */}
      <div className="flex flex-col gap-4 xl:sticky xl:top-4">
        <Card
          title="Notifications"
          right={
            <button type="button" onClick={() => { setBellOpen(v => !v); if (!bellOpen) markNotesRead(); }} className="ml-auto relative inline-flex items-center justify-center w-7 h-7 rounded-md border border-borderSubtle text-textSecondary hover:text-textPrimary" aria-label="Notifications" data-room-bell>
              <Bell className="w-3.5 h-3.5" />
              {unread > 0 && <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-bear text-[#ededed] font-mono text-[9px] font-bold inline-flex items-center justify-center">{unread}</span>}
            </button>
          }
        >
          <div className="pb-1" data-room-notes>
            {bell.slice(0, bellOpen ? 20 : 5).map(n => (
              <div key={n.id} className={`px-4 py-2 flex gap-2.5 border-t border-borderSubtle/50 ${n.read ? '' : 'bg-select/[0.05]'}`} data-note={n.kind}>
                <Avatar handle={n.from} size={26} />
                <div className="min-w-0 text-[12px] leading-snug text-textPrimary">
                  <Link to={`/community/u/${n.from}`} className="font-semibold hover:underline underline-offset-2">
                    {memberOf(n.from)?.name ?? n.from}
                  </Link>{' '}
                  <span className="text-textSecondary">{n.text.startsWith(NOTE_WORD[n.kind]) ? n.text : n.text}</span>
                  <div className="font-mono text-[10px] text-textSecondary">{timeAgo(n.at)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Who to follow">
          <div className="pb-2" data-room-suggestions>
            {who.map(m => (
              <div key={m.handle} className="px-4 py-2 flex items-center gap-2.5 border-t border-borderSubtle/50">
                <Link to={`/community/u/${m.handle}`}>
                  <Avatar handle={m.handle} size={30} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={`/community/u/${m.handle}`} className="flex items-center gap-1 text-[12px] font-semibold text-textPrimary hover:underline underline-offset-2 truncate">
                    {m.name}
                    {m.verified && <BadgeCheck className="w-3 h-3 text-select" />}
                  </Link>
                  <div className="font-mono text-[10px] text-textSecondary truncate">
                    @{m.handle} · {(m.followers / 1000).toFixed(1)}k
                  </div>
                </div>
                <button type="button" onClick={() => toggleFollow(m.handle)} className="h-7 px-3 rounded-full bg-select/[0.15] border border-select/40 font-mono text-[10px] uppercase tracking-wider text-textPrimary hover:bg-select/[0.25]" data-follow={m.handle}>
                  Follow
                </button>
              </div>
            ))}
          </div>
        </Card>
        <div className="px-1 text-[10px] leading-relaxed text-textSecondary" data-room-rules>
          New accounts read before they post · five posts in ten minutes at most · a report goes to the moderators and hides the post from your feed · block anyone · the badge is verified members
        </div>
      </div>
    </div>
  );
};

export default Room;
