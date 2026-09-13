/*
==================================================
  SLAYER TERMINAL - FEEDBACK AND BUGS
  (pages/Feedback.tsx)

  Its own page (Noah, 2026-09-13). The reference he
  sent set the shape — the list at the left, the
  form at the right — and the logic below is the
  desk's own.

  HOW IT WORKS (the fix, 2026-09-13 — the first cut
  got four things wrong):

    THE FEATURED ROW is the loudest ask STILL OPEN,
    and it is the same entry whatever the sort. It
    used to be "whatever sorted first", which
    changed meaninglessly with the sort and, worse,
    was REMOVED from the list below — so the list
    was short by one and the count never added up.
    It is a highlight now, not a subtraction.

    A ROW OPENS. The description, the attachments,
    the team's note on the status and the whole
    comment thread sit under it, with a box to
    reply. The comment count used to be a number
    with nothing behind it — a board you could not
    read.

    THE CATEGORY AND THE PRIORITY show every choice
    at once. Nine categories behind a closed menu
    means typing a title before you know what the
    board files it under.

    THE FILTER AND THE FORM AGREE: "bugs only" puts
    the form on bug reports and the head's button
    puts it on suggestions — filing a bug from the
    suggestions tab used to file it as a suggestion.

  Votes and replies survive a reload (the store
  keeps your vote as a delta over the seed, never a
  second copy of the count).
==================================================
*/

import { useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, MessageCircle, Paperclip, Plus } from 'lucide-react';
import { CATEGORIES, commentOnFeedback, submitFeedback, tally, useFeedback, useVotes, voteFeedback, type FeedbackCategory, type FeedbackItem, type FeedbackKind, type FeedbackPriority, type FeedbackStatus } from '../data/feedback';
import { timeAgo } from '../data/when';
import { Name } from '../components/ui/Name';

type Filter = 'all' | 'suggestion' | 'bug';
type Sort = 'newest' | 'supported' | 'priority';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All feedback' },
  { value: 'suggestion', label: 'Suggestions only' },
  { value: 'bug', label: 'Bugs only' },
];
const SORTS: { value: Sort; label: string }[] = [
  { value: 'newest', label: 'newest' },
  { value: 'supported', label: 'most supported' },
  { value: 'priority', label: 'highest priority' },
];
const PRIORITIES: FeedbackPriority[] = ['nice to have', 'important', 'critical'];
const PRIORITY_RANK: Record<FeedbackPriority, number> = { critical: 3, important: 2, 'nice to have': 1 };
/** Open = the team has not finished with it; the featured ask is drawn from these */
const OPEN: FeedbackStatus[] = ['new', 'under review', 'planned', 'building'];
const STATUS_STYLE: Record<FeedbackStatus, string> = {
  new: 'bg-ink/[0.06] text-textSecondary border-borderSubtle',
  'under review': 'bg-warn/15 text-warn border-warn/30',
  planned: 'bg-select/15 text-select border-select/30',
  building: 'bg-silver/15 text-silver border-silver/40',
  shipped: 'bg-bull/15 text-bull border-bull/30',
  declined: 'bg-bear/10 text-bear border-bear/30',
};
const MAX_DESC = 2000;

/* ---- the pieces ------------------------------------------------------------------------ */

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

/** Every choice on show, one click to pick — nine categories behind a menu is a guess */
const PickRow = <T extends string>({ label, options, value, onChange, testId }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void; testId: string }) => (
  <div data-feedback-pick={testId}>
    <div className="text-[11px] text-textSecondary mb-1">{label}</div>
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

const Votes = ({ item, vote }: { item: FeedbackItem; vote: 1 | -1 | 0 }) => (
  <span className="inline-flex items-center gap-1.5 shrink-0">
    <span className="font-mono text-[12px] tnum text-textPrimary whitespace-nowrap">{item.votes} upvotes</span>
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          voteFeedback(item.id, 1);
        }}
        aria-pressed={vote === 1}
        aria-label="Upvote"
        className={`leading-none ${vote === 1 ? 'text-bull' : 'text-textMuted hover:text-textPrimary'}`}
        data-vote-up
      >
        <ChevronUp className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          voteFeedback(item.id, -1);
        }}
        aria-pressed={vote === -1}
        aria-label="Downvote"
        className={`leading-none ${vote === -1 ? 'text-bear' : 'text-textMuted hover:text-textPrimary'}`}
        data-vote-down
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
    </span>
  </span>
);

/* ---- a row, and what opens under it ------------------------------------------------------ */

const Row = ({ item, vote, open, onOpen, featured = false }: { item: FeedbackItem; vote: 1 | -1 | 0; open: boolean; onOpen: () => void; featured?: boolean }) => {
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const send = () => {
    const e = commentOnFeedback(item.id, draft);
    setErr(e);
    if (!e) setDraft('');
  };
  return (
    <div
      className={featured ? 'rounded-md border border-silver/40 bg-silver/[0.05]' : `border-t border-borderSubtle/50 ${open ? 'bg-ink/[0.02]' : ''}`}
      data-feedback-row={item.id}
      data-kind={item.kind}
      data-open={open || undefined}
      data-featured={featured || undefined}
    >
      {/* A DIV THAT BEHAVES LIKE A BUTTON, not a button (2026-09-13): the votes
          are buttons and they sit INSIDE this row, and a <button> inside a
          <button> is invalid HTML — React warned on every render and a screen
          reader was read one control where there are three. Enter and Space
          open it, as a button would. */}
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
        style={{ gridTemplateColumns: '30px minmax(0,1fr) auto auto auto' }}
      >
        <Mark kind={item.kind} />
        <span className="min-w-0">
          <span className="flex items-center gap-2 min-w-0">
            <span className="text-[13px] text-textPrimary truncate">{item.title}</span>
            {item.ticker && <Name t={item.ticker} size={12} className="font-mono text-[11px] text-textSecondary" />}
          </span>
          <span className="block text-[11px] text-textSecondary">
            {item.where ?? item.category} · {timeAgo(item.createdAt)}
            {item.author === 'you' && <span className="text-select"> · yours</span>}
            {item.priority === 'critical' && <span className="text-bear"> · critical</span>}
          </span>
        </span>
        <span className={`inline-flex items-center h-6 px-2.5 rounded-full border text-[11px] whitespace-nowrap ${STATUS_STYLE[item.status]}`} data-status={item.status}>
          {item.status}
        </span>
        <Votes item={item} vote={vote} />
        <span className="inline-flex items-center gap-1 font-mono text-[11px] tnum text-textSecondary" title={`${item.comments.length} ${item.comments.length === 1 ? 'reply' : 'replies'} — click to read`} data-comment-count>
          <MessageCircle className="w-3.5 h-3.5" /> {item.comments.length}
        </span>
      </div>
      {open && (
        <div className="px-3 pb-3 pl-[45px]" data-feedback-detail={item.id}>
          <p className="text-[12.5px] leading-relaxed text-textPrimary whitespace-pre-wrap">{item.description}</p>
          <div className="mt-1.5 flex items-center gap-x-4 gap-y-1 flex-wrap font-mono text-[10px] text-textSecondary">
            <span>
              by <span className="text-textPrimary">{item.author}</span>
            </span>
            <span>
              category <span className="text-textPrimary">{item.category}</span>
            </span>
            <span>
              priority <span className={item.priority === 'critical' ? 'text-bear' : 'text-textPrimary'}>{item.priority}</span>
            </span>
            {item.attachments && item.attachments.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Paperclip className="w-3 h-3" /> {item.attachments.join(' · ')}
              </span>
            )}
          </div>
          {item.statusNote && (
            <div className={`mt-2 rounded-md border px-3 py-2 text-[12px] leading-relaxed ${STATUS_STYLE[item.status]}`} data-status-note>
              <span className="font-mono text-[9px] font-bold uppercase tracking-widest">{item.status}</span> · {item.statusNote}
            </div>
          )}
          <div className="mt-2 border-l-2 border-borderSubtle pl-3" data-feedback-thread>
            {item.comments.length === 0 && <div className="py-1 text-[11px] text-textSecondary">No replies yet — say what you think</div>}
            {item.comments.map(c => (
              <div key={c.id} className="py-1.5">
                <span className={`font-mono text-[11px] font-semibold ${c.team ? 'text-select' : c.author === 'you' ? 'text-silver' : 'text-textPrimary'}`}>{c.author}</span>
                <span className="font-mono text-[10px] text-textSecondary"> · {timeAgo(c.at)}</span>
                <p className="text-[12px] leading-snug text-textPrimary">{c.text}</p>
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

/* ---- the page -------------------------------------------------------------------------- */

const Feedback = () => {
  const items = useFeedback();
  const votes = useVotes();
  const [filter, setFilterState] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [tab, setTab] = useState<FeedbackKind>('suggestion');
  const [openId, setOpenId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<FeedbackCategory>('new feature');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState<FeedbackPriority>('nice to have');
  const [ticker, setTicker] = useState('');
  const [where, setWhere] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [sent, setSent] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  /* THE FILTER AND THE FORM AGREE — a side of the board picks the form's side */
  const setFilter = (f: Filter) => {
    setFilterState(f);
    if (f !== 'all') setTab(f);
  };
  const openForm = (kind: FeedbackKind) => {
    setTab(kind);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const counts = useMemo(() => tally(items), [items]);
  const shown = useMemo(() => {
    const kept = items.filter(i => filter === 'all' || i.kind === filter);
    const by: Record<Sort, (a: FeedbackItem, b: FeedbackItem) => number> = {
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      supported: (a, b) => b.votes - a.votes,
      priority: (a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || b.votes - a.votes,
    };
    return [...kept].sort(by[sort]);
  }, [items, filter, sort]);
  /* THE FEATURED ASK — the loudest still open, the same one whatever the sort */
  const featured = useMemo(() => {
    const open = shown.filter(i => OPEN.includes(i.status));
    return open.length ? open.reduce((best, i) => (i.votes > best.votes ? i : best)) : null;
  }, [shown]);

  const canSubmit = title.trim().length >= 4 && desc.trim().length >= 10;
  const submit = () => {
    if (!canSubmit) return;
    const item = submitFeedback({
      kind: tab,
      title: title.trim(),
      category,
      description: desc.trim(),
      priority,
      ticker: ticker.trim() ? ticker.trim().toUpperCase() : undefined,
      attachments: files.length ? files : undefined,
      where: tab === 'bug' && where.trim() ? where.trim() : undefined,
    });
    setTitle('');
    setDesc('');
    setTicker('');
    setWhere('');
    setFiles([]);
    setSent(true);
    setOpenId(item.id);
    window.setTimeout(() => setSent(false), 3000);
  };

  return (
    <div className="flex flex-col gap-4" data-feedback-page>
      <header className="flex items-start gap-6 flex-wrap pb-3 border-b border-borderSubtle" data-shell>
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold leading-tight text-textPrimary">Feedback</h1>
          <p className="mt-0.5 text-[11px] text-textSecondary">
            Suggest what to build, report what broke — every note is read · {counts.suggestions} suggestions · {counts.bugs} bugs · {counts.planned} planned · {counts.building} building · {counts.shipped} shipped
          </p>
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
        {/* THE LIST */}
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
            <div className="mt-2 flex items-center gap-3 flex-wrap text-[12px]">
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
            </div>
          </div>
          {featured && (
            <div className="px-3 pt-3" data-feedback-featured={featured.id}>
              <div className="mb-1.5 font-mono text-[9px] uppercase tracking-widest text-silver">The loudest ask still open</div>
              <Row item={featured} vote={votes[featured.id] ?? 0} open={openId === `top:${featured.id}`} onOpen={() => setOpenId(openId === `top:${featured.id}` ? null : `top:${featured.id}`)} featured />
            </div>
          )}
          <div className="px-4 pt-3 pb-1 text-[12px] text-textSecondary">{filter === 'bug' ? 'Bug reports' : filter === 'suggestion' ? 'Suggestions' : 'Everything on the board'}</div>
          {shown.map(item => (
            <Row key={item.id} item={item} vote={votes[item.id] ?? 0} open={openId === item.id} onOpen={() => setOpenId(openId === item.id ? null : item.id)} />
          ))}
          {shown.length === 0 && <div className="px-4 py-8 text-center font-mono text-[10px] uppercase tracking-widest text-textSecondary">Nothing here yet — be the first</div>}
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
            <div className="text-[15px] text-textPrimary">{tab === 'suggestion' ? 'Suggest something new' : 'Report a bug'}</div>
            <label className="block">
              <div className="text-[11px] text-textSecondary mb-1">{tab === 'suggestion' ? 'suggestion title' : 'what broke, in one line'}</div>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={tab === 'suggestion' ? 'e.g. multi-timeframe strike ladder' : 'e.g. login error on Safari'}
                maxLength={120}
                className="w-full h-9 bg-inputBg border border-borderSubtle rounded-md px-3 text-[12px] text-textPrimary placeholder:text-textMuted focus:border-silver/50 outline-none"
                data-form-title
              />
            </label>
            <PickRow label="category" options={CATEGORIES} value={category} onChange={setCategory} testId="category" />
            <label className="block">
              <div className="text-[11px] text-textSecondary mb-1">detailed description</div>
              <textarea
                value={desc}
                onChange={e => setDesc(e.target.value.slice(0, MAX_DESC))}
                rows={6}
                placeholder={tab === 'suggestion' ? 'what to build\nwhy it is useful\nhow you expect it to work\nwhere it should go' : 'what you did\nwhat you expected\nwhat happened instead\nhow often'}
                className="w-full bg-inputBg border border-borderSubtle rounded-md px-3 py-2 text-[12px] leading-relaxed text-textPrimary placeholder:text-textMuted focus:border-silver/50 outline-none resize-y"
                data-form-desc
              />
              <div className="text-right font-mono text-[10px] tnum text-textSecondary">
                {desc.length} / {MAX_DESC}
              </div>
            </label>
            <PickRow label="priority" options={PRIORITIES} value={priority} onChange={setPriority} testId="priority" />
            {tab === 'bug' && (
              <label className="block">
                <div className="text-[11px] text-textSecondary mb-1">where it happened</div>
                <input
                  value={where}
                  onChange={e => setWhere(e.target.value)}
                  placeholder="e.g. pinpoint/map · the alerts drawer"
                  className="w-full h-9 bg-inputBg border border-borderSubtle rounded-md px-3 text-[12px] text-textPrimary placeholder:text-textMuted focus:border-silver/50 outline-none"
                  data-form-where
                />
              </label>
            )}
            <label className="block">
              <div className="text-[11px] text-textSecondary mb-1">
                ticker / symbol <span className="text-textMuted">(optional)</span>
              </div>
              <input
                value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase())}
                placeholder="SPY"
                maxLength={6}
                className="w-full h-9 bg-inputBg border border-borderSubtle rounded-md px-3 font-mono text-[12px] uppercase text-textPrimary placeholder:text-textMuted focus:border-silver/50 outline-none"
                data-form-ticker
              />
            </label>
            <div>
              <div className="text-[11px] text-textSecondary mb-1">attachment</div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  setFiles(f => [...f, ...Array.from(e.dataTransfer.files).map(x => x.name)]);
                }}
                className="w-full h-16 rounded-md border border-dashed border-borderMuted text-[12px] text-textSecondary hover:text-textPrimary hover:border-silver/50 transition-colors flex items-center justify-center gap-4"
                data-form-attach
              >
                <Paperclip className="w-4 h-4" />
                <span>screenshot</span>
                <span>image</span>
                <span>video</span>
              </button>
              <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={e => setFiles(f => [...f, ...Array.from(e.target.files ?? []).map(x => x.name)])} />
              {files.length > 0 && <div className="mt-1 font-mono text-[10px] text-textSecondary truncate">{files.join(' · ')}</div>}
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              title={canSubmit ? undefined : 'A title of four characters and a description of ten'}
              className="w-full h-11 rounded-full border border-borderSubtle bg-ink/[0.05] text-[13px] text-textPrimary hover:bg-ink/[0.09] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              data-form-submit
            >
              {tab === 'suggestion' ? 'Submit suggestion' : 'Submit bug report'}
            </button>
            {sent && <div className="text-center font-mono text-[11px] text-bull animate-slide-in">Got it — it is on the board with your vote on it</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Feedback;
