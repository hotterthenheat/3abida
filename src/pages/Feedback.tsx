/*
==================================================
  SLAYER TERMINAL - FEEDBACK AND BUGS
  (pages/Feedback.tsx)

  Its own page (Noah, 2026-09-13). The reference he
  sent set the shape — the board at the left, the
  form at the right — and the logic below is the
  desk's own.

  WHAT THE SECOND PASS CHANGED, and why:

  THE SPOTLIGHT IS PINNED, ONCE. The loudest open
  ask was drawn at the top AND again in the list, so
  the same row appeared twice — adjacent, on the
  "most supported" sort. It is lifted out of the
  list now and the count still counts it.

  THE BOARD IS SEARCHABLE, AND IT WATCHES FOR
  DOUBLES. This was the biggest hole. At ten entries
  nobody notices; at two hundred the same ask
  arrives five times and reads as five things nobody
  wants instead of one thing forty people do. There
  is a search over the board, and while a title is
  being typed the nearest things already on it
  appear under the field with a button to support
  one instead of filing another.

  A BUG IS NOT A SUGGESTION. Different statuses
  (confirmed / fixing / fixed / cannot reproduce /
  not a bug, rather than planned / shipped), a
  severity the reporter actually knows instead of a
  priority they do not, a vote that reads "I have
  this too" and cannot go down, a description in the
  three parts a bug report needs, the page picked
  off the terminal's own registry rather than typed,
  and the browser and screen read off the machine.

  THE HEAD'S COUNTS ARE FILTERS. "2 planned · 1
  building" is the proof that notes get read; it
  should be a way in.

  ONE IDENTITY. The board used to say "you" and
  "yours" with no face while the room two doors
  along had your handle and your avatar.
==================================================
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronUp, MessageCircle, Paperclip, Plus, Search, X } from 'lucide-react';
import {
  CATEGORIES,
  DEFAULT_CATEGORY,
  OPEN_STATUSES,
  PAGES,
  SEVERITIES,
  commentOnFeedback,
  environmentLine,
  nearest,
  pageLabel,
  readEnvironment,
  search as searchBoard,
  submitFeedback,
  tally,
  useFeedback,
  useVotes,
  voteFeedback,
  type Environment,
  type FeedbackCategory,
  type FeedbackItem,
  type FeedbackKind,
  type FeedbackStatus,
  type Severity,
} from '../data/feedback';
import { timeAgo } from '../data/when';
import { useAccount } from '../data/account';
import { Avatar } from '../components/community/PostCard';
import { Name, knownTicker } from '../components/ui/Name';
import CompanyLogo from '../components/ui/CompanyLogo';
import { shrinkAll } from '../components/ui/shrinkImage';

type Filter = 'all' | 'suggestion' | 'bug';
type Sort = 'newest' | 'supported' | 'open';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All feedback' },
  { value: 'suggestion', label: 'Suggestions only' },
  { value: 'bug', label: 'Bugs only' },
];
const SORTS: { value: Sort; label: string }[] = [
  { value: 'newest', label: 'newest' },
  { value: 'supported', label: 'most supported' },
  { value: 'open', label: 'still open' },
];
const STATUS_STYLE: Record<FeedbackStatus, string> = {
  new: 'bg-ink/[0.06] text-textSecondary border-borderSubtle',
  'under review': 'bg-warn/15 text-warn border-warn/30',
  confirmed: 'bg-warn/15 text-warn border-warn/30',
  planned: 'bg-select/15 text-select border-select/30',
  fixing: 'bg-silver/15 text-silver border-silver/40',
  building: 'bg-silver/15 text-silver border-silver/40',
  shipped: 'bg-bull/15 text-bull border-bull/30',
  fixed: 'bg-bull/15 text-bull border-bull/30',
  declined: 'bg-bear/10 text-bear border-bear/30',
  'cannot reproduce': 'bg-bear/10 text-bear border-bear/30',
  'not a bug': 'bg-bear/10 text-bear border-bear/30',
};
const SEVERITY_INK: Record<Severity, string> = { 'blocks me': 'text-bear', 'has a workaround': 'text-warn', cosmetic: 'text-textSecondary' };
const MAX_DESC = 2000;
/* One grid, on the row and on the spotlight, so the pills and the counts line
   up down the board instead of wandering with the length of a title */
const ROW_COLUMNS = '30px minmax(0,1fr) 116px 84px 40px';

/* ---- the pieces -------------------------------------------------------------------------- */

/** The (s) / (b) mark — a suggestion in the bull ink, a bug in the bear */
const Mark = ({ kind, size = 30 }: { kind: FeedbackKind; size?: number }) => (
  <span
    className={`inline-flex items-center justify-center rounded-full border font-mono font-semibold shrink-0 ${kind === 'suggestion' ? 'border-bull/40 text-bull bg-bull/[0.06]' : 'border-bear/40 text-bear bg-bear/[0.06]'}`}
    style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    aria-label={kind === 'suggestion' ? 'a suggestion' : 'a bug'}
  >
    ({kind === 'suggestion' ? 's' : 'b'})
  </span>
);

/*
  ONE BUTTON, TWO MEANINGS, NO DOWN ARROW.

  The board used to print "42 upvotes" beside an up arrow AND a down arrow,
  which made the number a NET — a thing nobody could read off the screen. On a
  suggestion a vote is support; on a bug it is "I have this too", and that
  cannot be negative. Either way it is one toggle: press it again to take it
  back.
*/
const Support = ({ item, on }: { item: FeedbackItem; on: boolean }) => {
  const bug = item.kind === 'bug';
  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        voteFeedback(item.id);
      }}
      aria-pressed={on}
      title={bug ? `${item.votes} ${item.votes === 1 ? 'person has' : 'people have'} this too${on ? ' — including you' : '. Say you do.'}` : `${item.votes} support this${on ? ', you included' : '. Add yours.'}`}
      className={`inline-flex items-center justify-end gap-1.5 h-7 w-full px-2 rounded-md border transition-colors ${on ? (bug ? 'border-bear/40 bg-bear/[0.10] text-bear' : 'border-bull/40 bg-bull/[0.10] text-bull') : 'border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted'}`}
      data-vote={item.id}
      data-voted={on || undefined}
    >
      {bug ? <Plus className="w-3.5 h-3.5 shrink-0" /> : <ChevronUp className="w-3.5 h-3.5 shrink-0" />}
      <span className="font-mono text-[12px] tnum">{item.votes}</span>
    </button>
  );
};

/** Every choice on show, one click to pick — nine categories behind a menu is a guess */
const PickRow = <T extends string>({ label, options, value, onChange, testId, hint }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void; testId: string; hint?: string }) => (
  <div data-feedback-pick={testId}>
    <div className="text-[11px] text-textSecondary mb-1">
      {label}
      {hint && <span className="text-textMuted"> · {hint}</span>}
    </div>
    <div className="rounded-md border border-borderSubtle bg-inputBg px-1.5 py-1 flex items-center gap-1 flex-wrap" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={`h-7 px-2.5 rounded text-[12px] whitespace-nowrap transition-colors ${value === o ? 'bg-ink/[0.10] text-textPrimary font-medium' : 'text-textSecondary hover:text-textPrimary hover:bg-ink/[0.05]'}`}
          data-pick-option={o}
        >
          {o}
        </button>
      ))}
    </div>
  </div>
);

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <label className="block">
    <div className="text-[11px] text-textSecondary mb-1">
      {label}
      {hint && <span className="text-textMuted"> · {hint}</span>}
    </div>
    {children}
  </label>
);

const INPUT = 'w-full h-9 bg-inputBg border border-borderSubtle rounded-md px-3 text-[12px] text-textPrimary placeholder:text-textMuted focus:border-silver/50 outline-none';
const AREA = 'w-full bg-inputBg border border-borderSubtle rounded-md px-3 py-2 text-[12px] leading-relaxed text-textPrimary placeholder:text-textMuted focus:border-silver/50 outline-none resize-y';

/** A screenshot on a row, opened to full width on a click */
const Shots = ({ srcs }: { srcs: string[] }) => {
  const [big, setBig] = useState<string | null>(null);
  return (
    <div className="mt-2" data-feedback-shots>
      <div className="flex gap-2 flex-wrap">
        {srcs.map((src, i) => (
          <button key={i} type="button" onClick={() => setBig(b => (b === src ? null : src))} className="rounded-md border border-borderSubtle overflow-hidden hover:border-silver/50 transition-colors">
            <img src={src} alt={`screenshot ${i + 1}`} className="h-16 w-auto max-w-[160px] object-cover block" />
          </button>
        ))}
      </div>
      {big && <img src={big} alt="" className="mt-2 w-full max-h-[420px] object-contain rounded-md border border-borderSubtle bg-ink/[0.03]" />}
    </div>
  );
};

/* ---- a row, and what opens under it -------------------------------------------------------- */

const Row = ({ item, on, open, onOpen, pinned = false }: { item: FeedbackItem; on: boolean; open: boolean; onOpen: () => void; pinned?: boolean }) => {
  const account = useAccount();
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const yours = item.author === account.handle;
  const send = () => {
    const e = commentOnFeedback(item.id, draft);
    setErr(e);
    if (!e) setDraft('');
  };
  return (
    <div
      className={pinned ? 'rounded-md border border-silver/40 bg-silver/[0.05]' : `border-t border-borderSubtle/50 ${open ? 'bg-ink/[0.02]' : ''}`}
      data-feedback-row={item.id}
      data-kind={item.kind}
      data-open={open || undefined}
      data-pinned={pinned || undefined}
    >
      {/* A DIV THAT BEHAVES LIKE A BUTTON, not a button: the support control
          sits inside this row and a <button> inside a <button> is invalid. */}
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={e => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          onOpen();
        }}
        aria-expanded={open}
        className="w-full text-left grid items-center gap-x-3 px-3 py-2.5 hover:bg-ink/[0.03] transition-colors rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-silver/60"
        style={{ gridTemplateColumns: ROW_COLUMNS }}
      >
        <Mark kind={item.kind} />
        <span className="min-w-0">
          <span className="flex items-center gap-2 min-w-0">
            <span className="text-[13px] text-textPrimary truncate">{item.title}</span>
            {item.ticker && <Name t={item.ticker} size={12} className="font-mono text-[11px] text-textSecondary" />}
            {item.attachments && item.attachments.length > 0 && <Paperclip className="w-3 h-3 text-textSecondary shrink-0" />}
          </span>
          <span className="block text-[11px] text-textSecondary truncate">
            {item.where ? pageLabel(item.where) : item.category} · {timeAgo(item.createdAt)}
            {yours && <span className="text-select"> · yours</span>}
            {item.severity && item.severity !== 'cosmetic' && <span className={SEVERITY_INK[item.severity]}> · {item.severity}</span>}
          </span>
        </span>
        <span className={`inline-flex items-center justify-center h-6 px-2 rounded-full border text-[11px] whitespace-nowrap ${STATUS_STYLE[item.status]}`} data-status={item.status}>
          {item.status}
        </span>
        <Support item={item} on={on} />
        <span className="inline-flex items-center justify-end gap-1 font-mono text-[11px] tnum text-textSecondary" title={`${item.comments.length} ${item.comments.length === 1 ? 'reply' : 'replies'} — click to read`} data-comment-count>
          <MessageCircle className="w-3.5 h-3.5" /> {item.comments.length}
        </span>
      </div>
      {open && (
        <div className="px-3 pb-3 pl-[45px]" data-feedback-detail={item.id}>
          <p className="text-[12.5px] leading-relaxed text-textPrimary whitespace-pre-wrap">{item.description}</p>
          <div className="mt-1.5 flex items-center gap-x-4 gap-y-1 flex-wrap font-mono text-[10px] text-textSecondary">
            <span className="inline-flex items-center gap-1.5">
              <Avatar handle={item.author} size={16} /> {item.author}
            </span>
            <span>
              category <span className="text-textPrimary">{item.category}</span>
            </span>
            {item.severity && (
              <span>
                severity <span className={SEVERITY_INK[item.severity]}>{item.severity}</span>
              </span>
            )}
            {item.priority && (
              <span>
                the team calls it <span className={item.priority === 'critical' ? 'text-bear' : 'text-textPrimary'}>{item.priority}</span>
              </span>
            )}
          </div>
          {item.environment && (
            <div className="mt-1.5 font-mono text-[10px] text-textSecondary" data-feedback-env>
              on <span className="text-textPrimary">{environmentLine(item.environment)}</span>
            </div>
          )}
          {item.attachments && item.attachments.length > 0 && <Shots srcs={item.attachments} />}
          {item.statusNote && (
            <div className={`mt-2 rounded-md border px-3 py-2 text-[12px] leading-relaxed ${STATUS_STYLE[item.status]}`} data-status-note>
              <span className="font-mono text-[9px] font-bold uppercase tracking-widest">{item.status}</span> · {item.statusNote}
            </div>
          )}
          <div className="mt-2 border-l-2 border-borderSubtle pl-3" data-feedback-thread>
            {item.comments.length === 0 && <div className="py-1 text-[11px] text-textSecondary">No replies yet — say what you think</div>}
            {item.comments.map(c => (
              <div key={c.id} className="py-1.5 flex gap-2">
                <Avatar handle={c.author} size={20} />
                <div className="min-w-0">
                  <span className={`font-mono text-[11px] font-semibold ${c.team ? 'text-select' : c.author === account.handle ? 'text-silver' : 'text-textPrimary'}`}>{c.author}</span>
                  <span className="font-mono text-[10px] text-textSecondary"> · {timeAgo(c.at)}</span>
                  <p className="text-[12px] leading-snug text-textPrimary">{c.text}</p>
                </div>
              </div>
            ))}
            <div className="py-1.5 flex items-center gap-2">
              <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder="Add a reply"
                className="flex-1 h-8 bg-inputBg border border-borderSubtle rounded-md px-2.5 text-[12px] text-textPrimary placeholder:text-textMuted outline-none focus:border-silver/50"
                data-feedback-reply
              />
              <button type="button" onClick={send} className="h-8 px-3 rounded-md border border-select/40 bg-select/[0.08] font-mono text-[10px] uppercase tracking-wider text-select">
                Reply
              </button>
            </div>
            {err && <div className="text-[11px] text-bear">{err}</div>}
          </div>
        </div>
      )}
    </div>
  );
};

/* ---- the page ------------------------------------------------------------------------------ */

const Feedback = () => {
  const items = useFeedback();
  const votes = useVotes();
  const [filter, setFilterState] = useState<Filter>('all');
  const [status, setStatus] = useState<FeedbackStatus | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const [tab, setTab] = useState<FeedbackKind>('suggestion');
  const [openId, setOpenId] = useState<string | null>(null);
  /* the form */
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<FeedbackCategory>(DEFAULT_CATEGORY.suggestion);
  /* Switching side moves the category to that side's default — until the
     reader picks one themselves, after which it is theirs and stays put */
  const categoryPicked = useRef(false);
  const [desc, setDesc] = useState('');
  const [did, setDid] = useState('');
  const [expected, setExpected] = useState('');
  const [happened, setHappened] = useState('');
  const [severity, setSeverity] = useState<Severity>('has a workaround');
  const [where, setWhere] = useState('');
  const [ticker, setTicker] = useState('');
  const [shots, setShots] = useState<string[]>([]);
  const [sendEnv, setSendEnv] = useState(true);
  const [sent, setSent] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  /* THE MACHINE, read once when the page opens rather than asked for */
  const [environment] = useState<Environment>(() => readEnvironment());

  /* THE FILTER AND THE FORM AGREE — a side of the board picks the form's side */
  const setFilter = (f: Filter) => {
    setFilterState(f);
    if (f !== 'all') setTab(f);
  };
  const openForm = (kind: FeedbackKind) => {
    setTab(kind);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => titleRef.current?.focus(), 320);
  };

  const counts = useMemo(() => tally(items), [items]);
  const shown = useMemo(() => {
    const kept = searchBoard(
      items.filter(i => (filter === 'all' || i.kind === filter) && (!status || i.status === status)),
      query
    );
    const by: Record<Sort, (a: FeedbackItem, b: FeedbackItem) => number> = {
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      supported: (a, b) => b.votes - a.votes,
      open: (a, b) => Number(OPEN_STATUSES.includes(b.status)) - Number(OPEN_STATUSES.includes(a.status)) || b.votes - a.votes,
    };
    return [...kept].sort(by[sort]);
  }, [items, filter, status, query, sort]);

  /* THE SPOTLIGHT — the loudest ask still open, pinned once. It used to be
     drawn here AND left in the list below, so the same row appeared twice. */
  const pinned = useMemo(() => {
    const open = shown.filter(i => OPEN_STATUSES.includes(i.status));
    return open.length > 1 ? open.reduce((best, i) => (i.votes > best.votes ? i : best)) : null;
  }, [shown]);
  const rest = useMemo(() => (pinned ? shown.filter(i => i.id !== pinned.id) : shown), [shown, pinned]);

  /* SAYING THE SAME THING TWICE — what is already on the board like this */
  const doubles = useMemo(() => nearest(title, tab), [title, tab]);

  useEffect(() => {
    if (!categoryPicked.current) setCategory(DEFAULT_CATEGORY[tab]);
  }, [tab]);

  const pickShots = (files: FileList | File[]) => {
    void shrinkAll(files, 3).then(got => {
      if (got.length) setShots(s => [...s, ...got].slice(0, 3));
    });
  };
  /* Cmd+V a screenshot straight into a bug report — the whole point of one */
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter(f => f.type.startsWith('image/'));
      if (files.length) pickShots(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  const bug = tab === 'bug';
  const description = bug ? [did && `What I did: ${did.trim()}`, expected && `What I expected: ${expected.trim()}`, happened && `What happened: ${happened.trim()}`].filter(Boolean).join('\n') : desc.trim();
  const canSubmit = title.trim().length >= 4 && description.length >= 10;

  const submit = () => {
    const made = submitFeedback({
      kind: tab,
      title,
      category,
      description,
      severity: bug ? severity : undefined,
      ticker: bug ? undefined : ticker,
      where: bug && where ? where : undefined,
      environment: bug && sendEnv ? environment : undefined,
      screenshots: shots,
    });
    if (typeof made === 'string') {
      setErr(made);
      return;
    }
    setErr(null);
    setTitle('');
    setDesc('');
    setDid('');
    setExpected('');
    setHappened('');
    setTicker('');
    setWhere('');
    setShots([]);
    setOpenId(made.id);
    setSent(bug ? 'Logged, with your screen and your browser on it.' : 'On the board, with your support on it.');
    window.setTimeout(() => setSent(null), 4000);
  };

  return (
    <div className="flex flex-col gap-4" data-feedback-page>
      <header className="flex items-start gap-6 flex-wrap pb-3 border-b border-borderSubtle" data-shell>
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold leading-tight text-textPrimary">Feedback</h1>
          <p className="mt-0.5 text-[11px] text-textSecondary">Suggest what to build, report what broke — every note is read</p>
          {/* THE COUNTS ARE THE WAY IN. They are the proof that notes get read;
              a reader who sees "2 planned" should be one click from the two. */}
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap" data-feedback-counts>
            <span className="font-mono text-[10px] tnum text-textSecondary">
              {counts.suggestions} suggestions · {counts.bugs} bugs
            </span>
            {counts.byStatus.map(s => (
              <button
                key={s.status}
                type="button"
                onClick={() => setStatus(cur => (cur === s.status ? null : s.status))}
                aria-pressed={status === s.status}
                className={`inline-flex items-center h-5 px-2 rounded-full border font-mono text-[10px] tnum transition-colors ${status === s.status ? STATUS_STYLE[s.status] : 'border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted'}`}
                data-count-filter={s.status}
              >
                {s.count} {s.status}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => openForm('bug')} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-borderSubtle text-[13px] text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors" data-feedback-bug-door>
            Report a bug
          </button>
          <button type="button" onClick={() => openForm('suggestion')} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-[#ededed] text-[#0a0a0a] text-[13px] font-medium hover:brightness-95 transition" data-feedback-submit-door>
            <Plus className="w-4 h-4" /> Submit a suggestion
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_440px] gap-4 items-start">
        {/* THE BOARD */}
        <div className="min-w-0 border border-borderSubtle rounded-md bg-panel" data-feedback-list>
          <div className="px-4 pt-3 pb-2 border-b border-borderSubtle">
            <div className="flex items-center gap-5 flex-wrap">
              {FILTERS.map(f => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  aria-pressed={filter === f.value}
                  className={`text-[13px] pb-1 border-b-2 transition-colors ${filter === f.value ? 'text-textPrimary border-textPrimary' : 'text-textSecondary border-transparent hover:text-textPrimary'}`}
                  data-feedback-filter={f.value}
                >
                  {f.label}
                </button>
              ))}
              <span className="ml-auto font-mono text-[10px] tnum text-textSecondary">{shown.length} shown</span>
            </div>
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              <span className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -mt-[7px] w-3.5 h-3.5 text-textMuted pointer-events-none" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search the board before you add to it"
                  className="w-full h-8 bg-inputBg border border-borderSubtle rounded-md pl-8 pr-8 text-[12px] text-textPrimary placeholder:text-textMuted outline-none focus:border-silver/50"
                  data-feedback-search
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')} aria-label="Clear the search" className="absolute right-2 top-1/2 -mt-[7px] text-textMuted hover:text-textPrimary">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </span>
              <span className="flex items-center gap-3 text-[12px]">
                <span className="text-textSecondary">Sort by</span>
                {SORTS.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSort(s.value)}
                    aria-pressed={sort === s.value}
                    className={`transition-colors ${sort === s.value ? 'text-textPrimary font-medium underline underline-offset-4' : 'text-textSecondary hover:text-textPrimary'}`}
                    data-feedback-sort={s.value}
                  >
                    {s.label}
                  </button>
                ))}
              </span>
            </div>
            {status && (
              <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-textSecondary">
                showing only <span className="text-textPrimary">{status}</span>
                <button type="button" onClick={() => setStatus(null)} className="inline-flex items-center gap-1 text-textSecondary hover:text-textPrimary" data-clear-status>
                  <X className="w-3 h-3" /> clear
                </button>
              </div>
            )}
          </div>
          {pinned && (
            <div className="px-3 pt-3" data-feedback-featured={pinned.id}>
              <div className="mb-1.5 font-mono text-[9px] uppercase tracking-widest text-silver">The loudest ask still open</div>
              <Row item={pinned} on={votes.includes(pinned.id)} open={openId === pinned.id} onOpen={() => setOpenId(openId === pinned.id ? null : pinned.id)} pinned />
            </div>
          )}
          <div className="px-4 pt-3 pb-1 text-[12px] text-textSecondary">
            {pinned ? 'The rest of the board' : filter === 'bug' ? 'Bug reports' : filter === 'suggestion' ? 'Suggestions' : 'Everything on the board'}
          </div>
          {rest.map(item => (
            <Row key={item.id} item={item} on={votes.includes(item.id)} open={openId === item.id} onOpen={() => setOpenId(openId === item.id ? null : item.id)} />
          ))}
          {shown.length === 0 && (
            <div className="px-4 py-8 text-center text-[12px] text-textSecondary">
              {query ? (
                <>
                  Nothing on the board matches “{query}”.{' '}
                  <button type="button" onClick={() => openForm(tab)} className="text-select hover:underline underline-offset-2">
                    Be the first to say it
                  </button>
                </>
              ) : (
                'Nothing here yet — be the first'
              )}
            </div>
          )}
        </div>

        {/* THE FORM */}
        <div ref={formRef} className="min-w-0 border border-borderSubtle rounded-md bg-panel xl:sticky xl:top-4 scroll-mt-4" data-feedback-form={tab}>
          <div className="grid grid-cols-2 border-b border-borderSubtle">
            {(['suggestion', 'bug'] as FeedbackKind[]).map(k => (
              <button key={k} type="button" onClick={() => setTab(k)} aria-pressed={tab === k} className={`h-11 text-[13px] transition-colors ${tab === k ? 'text-textPrimary border-b-2 border-textPrimary' : 'text-textSecondary hover:text-textPrimary'}`} data-form-tab={k}>
                {k === 'suggestion' ? 'Suggestions / ideas' : 'Bug reports'}
              </button>
            ))}
          </div>
          <div className="px-5 py-4 flex flex-col gap-3">
            <div className="text-[15px] text-textPrimary">{bug ? 'Report a bug' : 'Suggest something new'}</div>

            <Field label={bug ? 'what broke, in one line' : 'suggestion title'}>
              <input
                ref={titleRef}
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={bug ? 'e.g. login loops back to the sign-in page on Safari' : 'e.g. multi-timeframe strike ladder'}
                maxLength={120}
                className={INPUT}
                data-form-title
              />
            </Field>

            {/* SAYING THE SAME THING TWICE — offered while the title is typed,
                with a way to support the existing one instead of filing again */}
            {doubles.length > 0 && (
              <div className="rounded-md border border-warn/30 bg-warn/[0.06] px-3 py-2" data-feedback-doubles>
                <div className="font-mono text-[10px] uppercase tracking-widest text-warn">{bug ? 'Already reported?' : 'Already asked for?'}</div>
                {doubles.map(({ item }) => (
                  <div key={item.id} className="mt-1.5 flex items-center gap-2">
                    <span className="min-w-0 flex-1 text-[12px] text-textPrimary truncate" title={item.title}>
                      {item.title}
                    </span>
                    <span className={`inline-flex items-center h-5 px-1.5 rounded-full border text-[10px] whitespace-nowrap ${STATUS_STYLE[item.status]}`}>{item.status}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!votes.includes(item.id)) voteFeedback(item.id);
                        setOpenId(item.id);
                        setTitle('');
                      }}
                      className="h-6 px-2 rounded-md border border-bull/40 bg-bull/[0.08] font-mono text-[10px] uppercase tracking-wider text-bull whitespace-nowrap"
                      data-double-support={item.id}
                    >
                      {votes.includes(item.id) ? 'Supported' : bug ? '+1 me too' : '+1 this'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* BOTH KINDS ARE FILED SOMEWHERE. The bug form used to have no
                category control, so a bug inherited the suggestion form's
                state and was filed under "new feature". */}
            <PickRow
              label="category"
              options={CATEGORIES}
              value={category}
              onChange={c => {
                categoryPicked.current = true;
                setCategory(c);
              }}
              testId="category"
            />

            {bug ? (
              <>
                <Field label="where it happened" hint="the page you were on">
                  <select value={where} onChange={e => setWhere(e.target.value)} className={`${INPUT} px-2`} data-form-where>
                    <option value="">— pick a page —</option>
                    {PAGES.map(p => (
                      <option key={p.path} value={p.path}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="what you did">
                  <input value={did} onChange={e => setDid(e.target.value)} placeholder="signed in on Safari and entered the code" className={INPUT} data-form-did />
                </Field>
                <Field label="what you expected">
                  <input value={expected} onChange={e => setExpected(e.target.value)} placeholder="the terminal" className={INPUT} data-form-expected />
                </Field>
                <Field label="what happened instead">
                  <textarea value={happened} onChange={e => setHappened(e.target.value.slice(0, MAX_DESC))} rows={3} placeholder="back to the sign-in page, every time" className={AREA} data-form-happened />
                </Field>
                <PickRow label="how much it hurts" options={SEVERITIES} value={severity} onChange={setSeverity} testId="severity" hint="you are the one who knows this" />
              </>
            ) : (
              <>
                <Field label="detailed description">
                  <textarea
                    value={desc}
                    onChange={e => setDesc(e.target.value.slice(0, MAX_DESC))}
                    rows={6}
                    placeholder={'what to build\nwhy it is useful\nhow you expect it to work\nwhere it should go'}
                    className={AREA}
                    data-form-desc
                  />
                  <div className="text-right font-mono text-[10px] tnum text-textSecondary">
                    {desc.length} / {MAX_DESC}
                  </div>
                </Field>
                {/* THE NAME, typed the way the room's composer takes one — the
                    shared TickerSearch draws an empty logo and an empty label
                    when it has no value, which reads as a broken control in a
                    field that is optional and usually left alone. */}
                <Field label="ticker / symbol" hint="optional">
                  <span className="relative block">
                    <input
                      value={ticker}
                      onChange={e => setTicker(e.target.value.toUpperCase().slice(0, 6))}
                      placeholder="SPY"
                      className={`${INPUT} font-mono uppercase ${knownTicker(ticker) ? 'pl-8' : ''}`}
                      data-form-ticker
                    />
                    {knownTicker(ticker) && (
                      <span className="absolute left-2.5 top-1/2 -mt-[7px] pointer-events-none">
                        <CompanyLogo ticker={ticker} size={14} />
                      </span>
                    )}
                  </span>
                </Field>
                {/* NO PRIORITY FIELD. Everyone picks critical, and it tells the
                    team nothing they cannot read off the votes. Priority is the
                    team's word, and the board prints it when they have said it. */}
              </>
            )}

            <div>
              <div className="text-[11px] text-textSecondary mb-1">
                screenshot <span className="text-textMuted">· drop one, pick one, or paste one with Cmd+V</span>
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  pickShots(e.dataTransfer.files);
                }}
                className="w-full h-16 rounded-md border border-dashed border-borderMuted text-[12px] text-textSecondary hover:text-textPrimary hover:border-silver/50 transition-colors flex items-center justify-center gap-3"
                data-form-attach
              >
                <Paperclip className="w-4 h-4" />
                <span>{shots.length ? `${shots.length} attached — add another` : 'Attach a screenshot'}</span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => e.target.files && pickShots(e.target.files)} />
              {shots.length > 0 && (
                <div className="mt-2 flex gap-2 flex-wrap" data-form-shots>
                  {shots.map((src, i) => (
                    <span key={i} className="relative">
                      <img src={src} alt="" className="h-16 rounded-md border border-borderSubtle object-cover" />
                      <button
                        type="button"
                        onClick={() => setShots(s => s.filter((_, k) => k !== i))}
                        aria-label="Remove"
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-panel border border-borderMuted text-textPrimary inline-flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* THE MACHINE, READ NOT ASKED — and the reporter can see exactly
                what goes with the report, and switch it off */}
            {bug && (
              <div className="rounded-md border border-borderSubtle bg-inputBg px-3 py-2" data-form-environment>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-textSecondary">sent with it</span>
                  <button type="button" onClick={() => setSendEnv(v => !v)} aria-pressed={sendEnv} className="ml-auto font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary" data-env-toggle>
                    {sendEnv ? 'do not send' : 'send it'}
                  </button>
                </div>
                <div className={`mt-0.5 font-mono text-[11px] ${sendEnv ? 'text-textPrimary' : 'text-textMuted line-through'}`}>{environmentLine(environment)}</div>
              </div>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              title={canSubmit ? undefined : bug ? 'A line on what broke, and what happened' : 'A title of four characters and a description of ten'}
              className="w-full h-11 rounded-full border border-borderSubtle bg-ink/[0.05] text-[13px] text-textPrimary hover:bg-ink/[0.09] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              data-form-submit
            >
              {bug ? 'Submit bug report' : 'Submit suggestion'}
            </button>
            {sent && (
              <div className="text-center font-mono text-[11px] text-bull animate-slide-in" data-form-sent>
                {sent}
              </div>
            )}
            {err && (
              <div className="text-center text-[11px] text-bear" data-form-error>
                {err}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Feedback;
