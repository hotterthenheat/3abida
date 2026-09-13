/*
==================================================
  SLAYER TERMINAL - A POST IN THE ROOM
  (components/community/PostCard.tsx)

  One post as the room draws it (Noah, 2026-09-13):
  the avatar, the name with its verified badge, the
  @handle and the age; the words with every $NAME
  and @handle a door; the pasted screenshots; and,
  for a TRADE SETUP, the card — bullish or bearish,
  entry · target · stop · timeframe, the outcome
  badge, every update in order, and for the
  author's own the Add update door and the four
  ways to finish it (target hit · stopped out ·
  scratched · closed) so the track record is built
  from every trade, not the winners. Under it the
  actions: like, comment, repost, save, and the ⋯
  menu with report and block.
==================================================
*/

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { BadgeCheck, Bookmark, Flag, Heart, MessageCircle, MoreHorizontal, Repeat2, ShieldBan } from 'lucide-react';
import { addUpdate, blocked, comment, finishSetup, isMe, liked, memberOf, report, reported, reposted, saved, toggleBlock, toggleLike, toggleRepost, toggleSave, unreport, type Outcome, type Post, type UpdateKind } from '../../data/room';
import { timeShort } from '../../data/when';
import CompanyLogo from '../ui/CompanyLogo';
import { knownTicker } from '../ui/Name';
import { useAnchoredMenu } from '../ui/useAnchoredMenu';

/** The ⋯ menu's width — named so the placement can keep its far edge on screen */
const MENU_W = 208;

/** The avatar — the member's initial on their own hue; the house has no photos yet */
export const Avatar = ({ handle, size = 36 }: { handle: string; size?: number }) => {
  const m = memberOf(handle);
  const hue = m?.hue ?? 45;
  const initial = (m?.name ?? handle).charAt(0).toUpperCase();
  return (
    <span className="inline-flex items-center justify-center rounded-full font-semibold text-[#0a0a0a] shrink-0" style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: `hsl(${hue} 70% 62%)` }} aria-hidden data-avatar={handle}>
      {initial}
    </span>
  );
};

/** The words with every $NAME and @handle a door */
export const RichPost = ({ text }: { text: string }) => {
  const parts = text.split(/(\$[A-Z][A-Z0-9.]{0,5}\b|@[a-z0-9_]{2,24}\b)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (/^\$[A-Z]/.test(part)) {
          const t = part.slice(1);
          return (
            <Link key={i} to={`/community/t/${t}`} className="inline-flex items-center gap-1 font-mono font-semibold text-select hover:underline underline-offset-2" data-post-ticker={t} onClick={e => e.stopPropagation()}>
              {knownTicker(t) && <CompanyLogo ticker={t} size={12} />}
              {part}
            </Link>
          );
        }
        if (/^@/.test(part)) {
          return (
            <Link key={i} to={`/community/u/${part.slice(1)}`} className="text-silver hover:underline underline-offset-2" data-post-mention={part.slice(1)} onClick={e => e.stopPropagation()}>
              {part}
            </Link>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
};

const OUTCOME_STYLE: Record<Outcome, string> = {
  open: 'bg-select/15 text-select border-select/30',
  'target hit': 'bg-bull/15 text-bull border-bull/30',
  'stopped out': 'bg-bear/15 text-bear border-bear/30',
  scratched: 'bg-warn/15 text-warn border-warn/30',
  closed: 'bg-ink/[0.06] text-textPrimary border-borderSubtle',
};
const UPDATE_WORD: Record<UpdateKind, string> = { trim: 'Trimmed', stop: 'Stop moved', invalidated: 'Invalidated', target: 'Target hit', note: 'Note', closed: 'Closed' };

const Action = ({ on, onClick, children, title, ink = 'text-textSecondary', onInk = 'text-select' }: { on?: boolean; onClick: () => void; children: ReactNode; title: string; ink?: string; onInk?: string }) => (
  <button
    type="button"
    title={title}
    aria-pressed={on}
    onClick={e => {
      e.stopPropagation();
      onClick();
    }}
    className={`inline-flex items-center gap-1.5 h-7 px-2 rounded-md font-mono text-[11px] tnum transition-colors hover:bg-ink/[0.06] ${on ? onInk : ink} hover:text-textPrimary`}
  >
    {children}
  </button>
);

interface Props {
  post: Post;
  /** Compact: no comments opened, no menu — the profile's and the ticker page's lists */
  compact?: boolean;
}

const PostCard = ({ post, compact = false }: Props) => {
  const m = memberOf(post.author);
  const mine = isMe(post.author);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updKind, setUpdKind] = useState<UpdateKind>('trim');
  const [updText, setUpdText] = useState('');
  /* THE ⋯ MENU WEARS THE HOUSE'S PLUMBING (2026-09-13). It used to close on
     mouse-leave alone: a keyboard could not dismiss it, a click elsewhere left
     it open, two cards could hold one open each, and `absolute top-full` inside
     a feed is the very placement menuPlacement.ts exists to stop. Anchored and
     portalled like every other menu, and dismissed on Escape or a pointer
     landing outside — POINTERDOWN, so opening another menu closes this one. */
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { anchorRef, placed } = useAnchoredMenu<HTMLButtonElement>(menu, 'bottom', MENU_W, 'end');
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setMenu(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [menu]);
  const s = post.setup;
  /* A POST YOU REPORTED is hidden behind a strip, not deleted from under you —
     the report went to the moderators and you can take it back (2026-09-13) */
  if (reported(post.id) && !compact)
    return (
      <div className="border-b border-borderSubtle/60 px-4 py-2.5 flex items-center gap-3 text-[12px] text-textSecondary" data-post={post.id} data-reported>
        <Flag className="w-3.5 h-3.5 text-warn shrink-0" />
        <span>
          Reported — thank you. It is hidden from your feed while the moderators look at it.
        </span>
        <button type="button" onClick={() => unreport(post.id)} className="ml-auto h-7 px-2.5 rounded-md border border-borderSubtle font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors" data-post-unreport>
          Undo
        </button>
      </div>
    );
  const send = () => {
    const e = comment(post.id, draft);
    setErr(e);
    if (!e) setDraft('');
  };
  return (
    <article className="border-b border-borderSubtle/60 px-4 py-3 flex gap-3" data-post={post.id} data-author={post.author} data-setup={s ? s.outcome : undefined}>
      <Link to={mine ? '/community/me' : `/community/u/${post.author}`} className="shrink-0 self-start">
        <Avatar handle={post.author} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link to={mine ? '/community/me' : `/community/u/${post.author}`} className="text-[13px] font-semibold text-textPrimary hover:underline underline-offset-2">
            {m?.name ?? post.author}
          </Link>
          {m?.verified && <BadgeCheck className="w-3.5 h-3.5 text-select" aria-label="verified" data-verified />}
          <span className="font-mono text-[11px] text-textSecondary">@{post.author}</span>
          <span className="font-mono text-[11px] text-textSecondary">· {timeShort(post.at)}</span>
          {s && <span className={`ml-1 inline-flex items-center h-5 px-1.5 rounded border font-mono text-[9px] font-bold uppercase tracking-wider ${s.bias === 'bullish' ? 'text-bull border-bull/30 bg-bull/10' : 'text-bear border-bear/30 bg-bear/10'}`}>{s.bias}</span>}
          {!compact && (
            <span ref={rootRef} className="ml-auto">
              <button ref={anchorRef} type="button" onClick={() => setMenu(v => !v)} aria-label="More" aria-expanded={menu} aria-haspopup="menu" className="inline-flex items-center justify-center w-6 h-6 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.06]" data-post-menu>
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {menu &&
                placed &&
                createPortal(
                  <div ref={menuRef} role="menu" style={{ position: 'fixed', ...placed.box, width: MENU_W }} className="z-[120] border border-borderMuted bg-panel/95 backdrop-blur-xl rounded-md shadow-2xl shadow-black/60 py-1 animate-slide-in" data-post-menu-card>
                    {!mine && (
                      <>
                        <button type="button" role="menuitem" onClick={() => { report(post.id); setMenu(false); }} className="w-full flex items-center gap-2 px-3 h-8 text-left text-[12px] text-textPrimary hover:bg-ink/[0.06]" data-post-report>
                          <Flag className="w-3.5 h-3.5" /> Report this post
                        </button>
                        <button type="button" role="menuitem" onClick={() => { toggleBlock(post.author); setMenu(false); }} className="w-full flex items-center gap-2 px-3 h-8 text-left text-[12px] text-bear hover:bg-bear/[0.06]" data-post-block>
                          <ShieldBan className="w-3.5 h-3.5" /> {blocked(post.author) ? 'Unblock' : 'Block'} @{post.author}
                        </button>
                      </>
                    )}
                    {mine && <div className="px-3 py-1.5 text-[11px] leading-snug text-textSecondary">Your post — updates keep it honest; there is no delete</div>}
                  </div>,
                  document.body
                )}
            </span>
          )}
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-textPrimary whitespace-pre-wrap break-words" data-post-text>
          <RichPost text={post.text} />
        </p>
        {post.images.length > 0 && (
          <div className={`mt-2 grid gap-2 ${post.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`} data-post-images>
            {post.images.map((src, i) => (
              <img key={i} src={src} alt="" className="w-full max-h-[360px] object-cover rounded-md border border-borderSubtle" />
            ))}
          </div>
        )}
        {s && (
          <div className="mt-2 rounded-md border border-borderSubtle bg-ink/[0.02]" data-post-setup>
            <div className="px-3 py-2 flex items-center gap-3 flex-wrap font-mono text-[11px] tnum">
              <Link to={`/community/t/${s.ticker}`} className="inline-flex items-center gap-1.5 font-bold text-[12px] text-textPrimary hover:underline underline-offset-2" onClick={e => e.stopPropagation()}>
                <CompanyLogo ticker={s.ticker} size={14} /> {s.ticker}
              </Link>
              <span className="text-textSecondary">
                entry <span className="text-textPrimary">{s.entry}</span>
              </span>
              <span className="text-textSecondary">
                target <span className="text-bull">{s.target}</span>
              </span>
              <span className="text-textSecondary">
                stop <span className="text-bear">{s.stop}</span>
              </span>
              <span className="text-textSecondary">
                timeframe <span className="text-textPrimary">{s.timeframe}</span>
              </span>
              <span className={`ml-auto inline-flex items-center h-5 px-2 rounded-full border text-[9px] font-bold uppercase tracking-wider ${OUTCOME_STYLE[s.outcome]}`} data-setup-outcome={s.outcome}>
                {s.outcome}
              </span>
            </div>
            {s.updates.length > 0 && (
              <ul className="border-t border-borderSubtle/60 px-3 py-2 space-y-1" data-setup-updates>
                {s.updates.map((u, i) => (
                  <li key={i} className="flex items-baseline gap-2 text-[11.5px]">
                    <span className="font-mono text-[10px] text-textSecondary w-8 shrink-0">{timeShort(u.at)}</span>
                    <span className={`font-mono text-[10px] font-bold uppercase tracking-wider shrink-0 ${u.kind === 'target' ? 'text-bull' : u.kind === 'invalidated' ? 'text-bear' : 'text-textSecondary'}`}>{UPDATE_WORD[u.kind]}</span>
                    <span className="text-textPrimary">{u.text}</span>
                  </li>
                ))}
              </ul>
            )}
            {mine && s.outcome === 'open' && !compact && (
              <div className="border-t border-borderSubtle/60 px-3 py-2 flex items-center gap-2 flex-wrap" data-setup-controls>
                {updating ? (
                  <>
                    <select value={updKind} onChange={e => setUpdKind(e.target.value as UpdateKind)} className="h-7 bg-inputBg border border-borderSubtle rounded-md px-2 font-mono text-[11px] text-textPrimary">
                      <option value="trim">Trimmed</option>
                      <option value="stop">Stop moved</option>
                      <option value="note">Note</option>
                    </select>
                    <input value={updText} onChange={e => setUpdText(e.target.value)} placeholder="what changed" className="flex-1 min-w-[160px] h-7 bg-inputBg border border-borderSubtle rounded-md px-2 text-[12px] text-textPrimary placeholder:text-textMuted outline-none focus:border-silver/50" />
                    <button type="button" onClick={() => { addUpdate(post.id, updKind, updText); setUpdText(''); setUpdating(false); }} className="h-7 px-2.5 rounded-md border border-select/40 bg-select/[0.08] font-mono text-[10px] uppercase tracking-wider text-select">
                      Post update
                    </button>
                    <button type="button" onClick={() => setUpdating(false)} className="h-7 px-2 font-mono text-[10px] uppercase tracking-wider text-textSecondary">
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => setUpdating(true)} className="h-7 px-2.5 rounded-md border border-borderSubtle bg-chip font-mono text-[10px] uppercase tracking-wider text-textPrimary hover:border-borderMuted" data-setup-add-update>
                      + Add update
                    </button>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-textSecondary ml-2">finish as</span>
                    {(['target hit', 'stopped out', 'scratched', 'closed'] as const).map(o => (
                      <button key={o} type="button" onClick={() => finishSetup(post.id, o)} className={`h-7 px-2 rounded-md border font-mono text-[10px] uppercase tracking-wider transition-colors ${OUTCOME_STYLE[o]} hover:brightness-110`} data-setup-finish={o}>
                        {o}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
        {!compact && (
          <div className="mt-1.5 -ml-2 flex items-center gap-1" data-post-actions>
            <Action on={liked(post.id)} onClick={() => toggleLike(post.id)} title="Like" onInk="text-bear">
              <Heart className="w-3.5 h-3.5" fill={liked(post.id) ? 'currentColor' : 'none'} /> {post.likes}
            </Action>
            <Action on={open} onClick={() => setOpen(v => !v)} title="Comments">
              <MessageCircle className="w-3.5 h-3.5" /> {post.comments.length}
            </Action>
            <Action on={reposted(post.id)} onClick={() => toggleRepost(post.id)} title="Repost" onInk="text-bull">
              <Repeat2 className="w-3.5 h-3.5" /> {post.reposts}
            </Action>
            <Action on={saved(post.id)} onClick={() => toggleSave(post.id)} title="Save" onInk="text-warn">
              <Bookmark className="w-3.5 h-3.5" fill={saved(post.id) ? 'currentColor' : 'none'} />
            </Action>
          </div>
        )}
        {open && !compact && (
          <div className="mt-2 border-l-2 border-borderSubtle pl-3" data-post-comments>
            {post.comments.map(c => (
              <div key={c.id} className="py-1.5 flex gap-2">
                <Avatar handle={c.author} size={22} />
                <div className="min-w-0">
                  <span className="text-[12px] font-semibold text-textPrimary">{memberOf(c.author)?.name ?? c.author}</span>
                  <span className="font-mono text-[10px] text-textSecondary"> @{c.author} · {timeShort(c.at)}</span>
                  <p className="text-[12px] text-textPrimary">
                    <RichPost text={c.text} />
                  </p>
                </div>
              </div>
            ))}
            <div className="py-1.5 flex items-center gap-2">
              <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Add a comment" className="flex-1 h-8 bg-inputBg border border-borderSubtle rounded-md px-2.5 text-[12px] text-textPrimary placeholder:text-textMuted outline-none focus:border-silver/50" data-comment-input />
              <button type="button" onClick={send} className="h-8 px-3 rounded-md border border-select/40 bg-select/[0.08] font-mono text-[10px] uppercase tracking-wider text-select">
                Reply
              </button>
            </div>
            {err && <div className="text-[11px] text-bear">{err}</div>}
          </div>
        )}
      </div>
    </article>
  );
};

export default PostCard;
