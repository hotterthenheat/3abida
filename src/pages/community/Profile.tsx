/*
==================================================
  SLAYER TERMINAL - A PROFILE
  (pages/community/Profile.tsx)

  A member's page (Noah, 2026-09-13): @handle, the
  name and the badge, the bio and the links,
  followers and following and a follow button; then
  their setups, their quick thoughts, and their
  TRADE HISTORY — every finished setup with its
  outcome, and the record they add up to. Yours at
  /community/me.
==================================================
*/

import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { BadgeCheck, ShieldBan } from 'lucide-react';
import { useAccount } from '../../data/account';
import { blocked, follows, isMe, memberOf, postsBy, toggleBlock, toggleFollow, trackRecord, useRoom, followList } from '../../data/room';
import { timeShort } from '../../data/when';
import PostCard, { Avatar } from '../../components/community/PostCard';
import CardTabs from '../../components/ui/CardTabs';
import CompanyLogo from '../../components/ui/CompanyLogo';

type Tab = 'setups' | 'thoughts' | 'history' | 'following';
const TABS = [
  { value: 'setups', label: 'Setups' },
  { value: 'thoughts', label: 'Quick thoughts' },
  { value: 'history', label: 'Trade history' },
  { value: 'following', label: 'Following' },
] as const;

const Profile = () => {
  const rev = useRoom();
  const account = useAccount();
  const { handle: raw } = useParams();
  const [params, setParams] = useSearchParams();
  const handle = !raw || raw === 'me' ? account.handle : raw;
  const m = memberOf(handle);
  const mine = isMe(handle);
  /* THE TAB LIVES IN THE URL (2026-09-13). It used to be state seeded from the
     query on mount only, so the room's own "Following" door — which is this
     page with ?tab=following — did nothing at all when you were already on
     your profile: the route did not change, so nothing remounted. Reading it
     every render fixes that door, and makes a tab a link somebody can send. */
  const asked = params.get('tab');
  const tab: Tab = TABS.some(t => t.value === asked) ? (asked as Tab) : 'setups';
  const setTab = (next: Tab) => {
    const q = new URLSearchParams(params);
    if (next === 'setups') q.delete('tab');
    else q.set('tab', next);
    setParams(q, { replace: true });
  };
  const posts = useMemo(() => postsBy(handle), [handle, rev]);
  const record = trackRecord(handle);
  if (!m)
    return (
      <div className="border border-borderSubtle rounded-md bg-panel px-5 py-10 text-center font-mono text-[10px] uppercase tracking-widest text-textSecondary">
        No one here by @{handle} · <Link to="/community" className="text-select">back to the room</Link>
      </div>
    );
  const setups = posts.filter(p => p.setup);
  const thoughts = posts.filter(p => !p.setup);

  return (
    <div className="flex flex-col gap-4" data-profile={handle}>
      <div className="border border-borderSubtle rounded-md bg-panel px-5 py-4 flex items-start gap-4 flex-wrap">
        <Avatar handle={handle} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[18px] font-semibold text-textPrimary">{m.name}</span>
            {m.verified && <BadgeCheck className="w-4 h-4 text-select" aria-label="verified" />}
            <span className="font-mono text-[12px] text-textSecondary">@{handle}</span>
          </div>
          <p className="mt-1 text-[12.5px] text-textPrimary max-w-[620px]">{m.bio || 'No bio yet.'}</p>
          <div className="mt-1 flex items-center gap-3 flex-wrap font-mono text-[11px]">
            {m.links.map(l => (
              <a key={l} href={`https://${l.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer" className="text-select hover:underline underline-offset-2">
                {l}
              </a>
            ))}
            <span className="text-textSecondary">joined {new Date(m.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
          </div>
          <div className="mt-2 flex items-center gap-4 font-mono text-[11px] tnum text-textSecondary">
            <span>
              <span className="text-textPrimary font-semibold">{m.followers >= 1000 ? `${(m.followers / 1000).toFixed(1)}k` : m.followers}</span> followers
            </span>
            <span>
              <span className="text-textPrimary font-semibold">{m.following}</span> following
            </span>
            <span>
              <span className="text-textPrimary font-semibold">{posts.length}</span> posts
            </span>
            {record.winRate != null && (
              <span data-profile-record>
                record <span className="text-bull">{record.wins}W</span> <span className="text-bear">{record.losses}L</span> {record.scratched > 0 && <span>{record.scratched} scratched</span>} · <span className="text-textPrimary font-semibold">{record.winRate}%</span>
              </span>
            )}
          </div>
        </div>
        {mine ? (
          <Link to="/settings/profile" className="h-8 px-3 rounded-full border border-borderSubtle font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary inline-flex items-center">
            Edit profile
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => toggleFollow(handle)} aria-pressed={follows(handle)} className={`h-8 px-4 rounded-full font-mono text-[10px] uppercase tracking-wider transition-colors ${follows(handle) ? 'border border-borderSubtle text-textPrimary' : 'bg-select/[0.15] border border-select/40 text-textPrimary hover:bg-select/[0.25]'}`} data-profile-follow>
              {follows(handle) ? 'Following' : 'Follow'}
            </button>
            <button type="button" onClick={() => toggleBlock(handle)} title={blocked(handle) ? 'Unblock' : 'Block'} className={`inline-flex items-center justify-center w-8 h-8 rounded-full border ${blocked(handle) ? 'border-bear/50 text-bear' : 'border-borderSubtle text-textSecondary hover:text-bear'}`} data-profile-block>
              <ShieldBan className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="border border-borderSubtle rounded-md bg-panel">
        <div className="px-4 py-2 border-b border-borderSubtle">
          <CardTabs options={TABS} value={tab} onChange={setTab} ariaLabel="Profile tabs" />
        </div>
        {tab === 'setups' && (setups.length ? setups.map(p => <PostCard key={p.id} post={p} />) : <div className="px-4 py-8 text-center font-mono text-[10px] uppercase tracking-widest text-textSecondary">No setups posted</div>)}
        {tab === 'thoughts' && (thoughts.length ? thoughts.map(p => <PostCard key={p.id} post={p} />) : <div className="px-4 py-8 text-center font-mono text-[10px] uppercase tracking-widest text-textSecondary">No quick thoughts yet</div>)}
        {tab === 'history' && (
          <div data-profile-history>
            <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-5 gap-3 font-mono text-[11px] tnum border-b border-borderSubtle/60">
              {[
                ['Open', record.open, 'text-select'],
                ['Target hit', record.wins, 'text-bull'],
                ['Stopped out', record.losses, 'text-bear'],
                ['Scratched', record.scratched, 'text-warn'],
                ['Win rate', record.winRate == null ? '—' : `${record.winRate}%`, 'text-textPrimary'],
              ].map(([k, v, ink]) => (
                <div key={k as string}>
                  <div className="text-[10px] text-textSecondary">{k as string}</div>
                  <div className={`text-[16px] font-bold ${ink as string}`}>{v as string | number}</div>
                </div>
              ))}
            </div>
            {record.finished.length === 0 && <div className="px-4 py-8 text-center font-mono text-[10px] uppercase tracking-widest text-textSecondary">No finished trades yet — the record is built as setups close</div>}
            {record.finished.map(({ post, setup }) => (
              <div key={post.id} className="px-4 py-2 border-b border-borderSubtle/50 grid items-center gap-x-3 font-mono text-[11px] tnum" style={{ gridTemplateColumns: '90px 70px 60px 60px 60px minmax(0,1fr) 100px 60px' }} data-history-row={post.id}>
                <span className="inline-flex items-center gap-1.5 font-bold text-textPrimary">
                  <CompanyLogo ticker={setup.ticker} size={13} /> {setup.ticker}
                </span>
                <span className={setup.bias === 'bullish' ? 'text-bull' : 'text-bear'}>{setup.bias}</span>
                <span className="text-textPrimary">{setup.entry}</span>
                <span className="text-bull">{setup.target}</span>
                <span className="text-bear">{setup.stop}</span>
                <span className="text-textSecondary truncate">{setup.updates[setup.updates.length - 1]?.text ?? setup.timeframe}</span>
                <span className={`font-bold uppercase tracking-wider ${setup.outcome === 'target hit' ? 'text-bull' : setup.outcome === 'stopped out' ? 'text-bear' : setup.outcome === 'scratched' ? 'text-warn' : 'text-textPrimary'}`}>{setup.outcome}</span>
                <span className="text-textSecondary text-right">{timeShort(post.at)}</span>
              </div>
            ))}
          </div>
        )}
        {tab === 'following' && (
          <div data-profile-following>
            {(mine ? followList() : []).length === 0 && <div className="px-4 py-8 text-center font-mono text-[10px] uppercase tracking-widest text-textSecondary">{mine ? 'You follow no one yet' : 'Who they follow is theirs to show'}</div>}
            {(mine ? followList() : []).map(h => {
              const f = memberOf(h);
              return (
                <div key={h} className="px-4 py-2 flex items-center gap-2.5 border-b border-borderSubtle/50">
                  <Avatar handle={h} size={28} />
                  <Link to={`/community/u/${h}`} className="text-[12px] font-semibold text-textPrimary hover:underline underline-offset-2">
                    {f?.name ?? h}
                  </Link>
                  <span className="font-mono text-[10px] text-textSecondary">@{h}</span>
                  <button type="button" onClick={() => toggleFollow(h)} className="ml-auto h-7 px-3 rounded-full border border-borderSubtle font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary">
                    Unfollow
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
