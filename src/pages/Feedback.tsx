/*
==================================================
  SLAYER TERMINAL - FEEDBACK AND BUGS
  (pages/Feedback.tsx)

  Its own page, in the reference's shape (Noah,
  2026-09-13: "the feedback and bug page should
  kinda look like these two"): the list at the
  left — all feedback, suggestions only, bugs only;
  sorted newest, most supported or highest
  priority; every row an (s) or a (b) mark, the
  title, the category and its age, the status
  pill, the votes with their arrows, the comment
  count — and the form at the right on two tabs,
  suggestions / ideas and bug reports: the title,
  the category, the description with its counter,
  the priority, a name if it is about one, an
  attachment, submit. Every note is kept
  (data/feedback.ts).
==================================================
*/

import { useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, MessageCircle, Paperclip, Plus } from 'lucide-react';
import { CATEGORIES, submitFeedback, timeAgo, useFeedback, useVotes, voteFeedback, type FeedbackCategory, type FeedbackItem, type FeedbackKind, type FeedbackPriority, type FeedbackStatus } from '../data/feedback';
import CardTabs from '../components/ui/CardTabs';
import DropdownSelect, { type DropdownOption } from '../components/ui/DropdownSelect';
import { Name } from '../components/ui/Name';

type Filter = 'all' | 'suggestion' | 'bug';
type Sort = 'newest' | 'supported' | 'priority';
const FILTERS = [
  { value: 'all', label: 'All feedback' },
  { value: 'suggestion', label: 'Suggestions only' },
  { value: 'bug', label: 'Bugs only' },
] as const;
const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'supported', label: 'Most supported' },
  { value: 'priority', label: 'Highest priority' },
] as const;
const FORM_TABS = [
  { value: 'suggestion', label: 'Suggestions / ideas' },
  { value: 'bug', label: 'Bug reports' },
] as const;
const PRIORITY_RANK: Record<FeedbackPriority, number> = { critical: 3, important: 2, 'nice to have': 1 };
const STATUS_STYLE: Record<FeedbackStatus, string> = {
  new: 'bg-ink/[0.06] text-textSecondary border-borderSubtle',
  'under review': 'bg-warn/15 text-warn border-warn/30',
  planned: 'bg-select/15 text-select border-select/30',
  building: 'bg-silver/15 text-silver border-silver/40',
  shipped: 'bg-bull/15 text-bull border-bull/30',
  declined: 'bg-bear/10 text-bear border-bear/30',
};
const CATEGORY_OPTIONS: DropdownOption<FeedbackCategory>[] = CATEGORIES.map(c => ({ value: c, label: c }));
const PRIORITY_OPTIONS: DropdownOption<FeedbackPriority>[] = [
  { value: 'nice to have', label: 'Nice to have', hint: 'Would be good, nobody is stuck' },
  { value: 'important', label: 'Important', hint: 'Slows the work down every day' },
  { value: 'critical', label: 'Critical', hint: 'Blocks trading, or loses data' },
];
const MAX_DESC = 2000;

const Mark = ({ kind }: { kind: FeedbackKind }) => (
  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full border font-mono text-[13px] font-semibold ${kind === 'suggestion' ? 'border-bull/40 text-bull bg-bull/[0.06]' : 'border-bear/40 text-bear bg-bear/[0.06]'}`} aria-label={kind}>
    ({kind === 'suggestion' ? 's' : 'b'})
  </span>
);

const FeedbackRow = ({ item, vote, onVote }: { item: FeedbackItem; vote: 1 | -1 | 0; onVote: (dir: 1 | -1) => void }) => (
  <div className="grid items-center gap-x-3 px-3 py-2.5 border-t border-borderSubtle/50 hover:bg-ink/[0.03] transition-colors" style={{ gridTemplateColumns: '36px minmax(0,1fr) auto auto auto' }} data-feedback-row={item.id} data-kind={item.kind}>
    <Mark kind={item.kind} />
    <div className="min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[13px] text-textPrimary truncate">
          ({item.kind === 'suggestion' ? 's' : 'b'}) {item.title}
        </span>
        {item.ticker && <Name t={item.ticker} size={12} className="font-mono text-[11px] text-textSecondary" />}
      </div>
      <div className="text-[11px] text-textSecondary">
        {item.where ?? item.category} · {timeAgo(item.createdAt)}
        {item.author === 'you' && <span className="text-select"> · yours</span>}
        {item.priority === 'critical' && <span className="text-bear"> · critical</span>}
      </div>
    </div>
    <span className={`inline-flex items-center h-6 px-2.5 rounded-full border text-[11px] whitespace-nowrap ${STATUS_STYLE[item.status]}`} data-status={item.status}>
      {item.status}
    </span>
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-[12px] tnum text-textPrimary whitespace-nowrap">{item.votes} upvotes</span>
      <span className="inline-flex flex-col">
        <button type="button" onClick={() => onVote(1)} aria-pressed={vote === 1} aria-label="Upvote" className={`leading-none ${vote === 1 ? 'text-bull' : 'text-textMuted hover:text-textPrimary'}`}>
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => onVote(-1)} aria-pressed={vote === -1} aria-label="Downvote" className={`leading-none ${vote === -1 ? 'text-bear' : 'text-textMuted hover:text-textPrimary'}`}>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </span>
    </span>
    <span className="inline-flex items-center gap-1 font-mono text-[11px] tnum text-textSecondary" title={`${item.comments} comments`}>
      <MessageCircle className="w-3.5 h-3.5" /> {item.comments}
    </span>
  </div>
);

const Feedback = () => {
  const items = useFeedback();
  const votes = useVotes();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [tab, setTab] = useState<FeedbackKind>('suggestion');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<FeedbackCategory>('new feature');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState<FeedbackPriority>('nice to have');
  const [ticker, setTicker] = useState('');
  const [where, setWhere] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [sent, setSent] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  const shown = useMemo(() => {
    const kept = items.filter(i => filter === 'all' || i.kind === filter);
    const by: Record<Sort, (a: FeedbackItem, b: FeedbackItem) => number> = {
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      supported: (a, b) => b.votes - a.votes,
      priority: (a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || b.votes - a.votes,
    };
    return [...kept].sort(by[sort]);
  }, [items, filter, sort]);
  const top = shown[0];
  const canSubmit = title.trim().length >= 4 && desc.trim().length >= 10;
  const submit = () => {
    if (!canSubmit) return;
    const item = submitFeedback({ kind: tab, title: title.trim(), category, description: desc.trim(), priority, ticker: ticker.trim() ? ticker.trim().toUpperCase() : undefined, attachments: files, where: tab === 'bug' && where.trim() ? where.trim() : undefined });
    setTitle('');
    setDesc('');
    setTicker('');
    setWhere('');
    setFiles([]);
    setSent(item.id);
    window.setTimeout(() => setSent(null), 3000);
  };

  return (
    <div className="flex flex-col gap-4" data-feedback-page>
      <header className="flex items-start gap-6 flex-wrap pb-3 border-b border-borderSubtle" data-shell>
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold leading-tight text-textPrimary">feedback</h1>
          <p className="mt-0.5 text-[11px] text-textSecondary">Suggest what to build, report what broke — every note is read, every vote counts</p>
        </div>
        <button type="button" onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-[#ededed] text-[#0a0a0a] text-[13px] font-medium hover:brightness-95 transition" data-feedback-submit-door>
          <Plus className="w-4 h-4" /> submit suggestion
        </button>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_440px] gap-4 items-start">
        {/* THE LIST */}
        <div className="min-w-0 border border-borderSubtle rounded-md bg-panel" data-feedback-list>
          <div className="px-4 pt-3 pb-2 flex items-center gap-4 flex-wrap border-b border-borderSubtle">
            <CardTabs options={FILTERS} value={filter} onChange={setFilter} ariaLabel="Which feedback" />
            <span className="ml-auto inline-flex items-center gap-2 font-mono text-[10px] text-textSecondary">
              Sort by
              <CardTabs options={SORTS} value={sort} onChange={setSort} ariaLabel="Sort" />
            </span>
          </div>
          {top && (
            <div className="px-3 pt-3 pb-1">
              <div className="rounded-md bg-ink/[0.04] border border-borderSubtle" data-feedback-top>
                <FeedbackRow item={top} vote={votes[top.id] ?? 0} onVote={d => voteFeedback(top.id, d)} />
              </div>
            </div>
          )}
          <div className="px-4 pt-3 pb-1 text-[12px] text-textSecondary">{filter === 'bug' ? 'Bug reports' : filter === 'suggestion' ? 'Suggestions' : 'Suggestions and bug reports'}</div>
          {shown.slice(1).map(item => (
            <FeedbackRow key={item.id} item={item} vote={votes[item.id] ?? 0} onVote={d => voteFeedback(item.id, d)} />
          ))}
          {shown.length === 0 && <div className="px-4 py-8 text-center font-mono text-[10px] uppercase tracking-widest text-textSecondary">Nothing here yet</div>}
        </div>

        {/* THE FORM */}
        <div ref={formRef} className="min-w-0 border border-borderSubtle rounded-md bg-panel xl:sticky xl:top-4 scroll-mt-4" data-feedback-form>
          <div className="grid grid-cols-2 border-b border-borderSubtle">
            {FORM_TABS.map(t => (
              <button key={t.value} type="button" onClick={() => setTab(t.value)} aria-pressed={tab === t.value} className={`h-11 text-[13px] transition-colors ${tab === t.value ? 'text-textPrimary border-b-2 border-textPrimary' : 'text-textSecondary hover:text-textPrimary'}`} data-form-tab={t.value}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="px-5 py-4 flex flex-col gap-3">
            <div className="text-[15px] text-textPrimary">{tab === 'suggestion' ? 'suggest something new' : 'report a bug'}</div>
            <label className="block">
              <div className="text-[11px] text-textSecondary mb-1">{tab === 'suggestion' ? 'suggestion title' : 'what broke, in one line'}</div>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder={tab === 'suggestion' ? 'suggestion title' : 'e.g. login error on safari'} maxLength={120} className="w-full h-9 bg-inputBg border border-borderSubtle rounded-md px-3 text-[12px] text-textPrimary placeholder:text-textMuted focus:border-silver/50 outline-none" data-form-title />
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              <DropdownSelect label="Category" value={category} options={CATEGORY_OPTIONS} onChange={setCategory} title="What it is about" testId="feedback-category" />
              <DropdownSelect label="Priority" value={priority} options={PRIORITY_OPTIONS} onChange={setPriority} title="How much it matters" testId="feedback-priority" />
            </div>
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
            {tab === 'bug' && (
              <label className="block">
                <div className="text-[11px] text-textSecondary mb-1">where it happened</div>
                <input value={where} onChange={e => setWhere(e.target.value)} placeholder="e.g. pinpoint/map · the alerts drawer" className="w-full h-9 bg-inputBg border border-borderSubtle rounded-md px-3 text-[12px] text-textPrimary placeholder:text-textMuted focus:border-silver/50 outline-none" data-form-where />
              </label>
            )}
            <label className="block">
              <div className="text-[11px] text-textSecondary mb-1">
                ticker / symbol <span className="text-textMuted">(optional)</span>
              </div>
              <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} placeholder="ticker / symbol" maxLength={6} className="w-full h-9 bg-inputBg border border-borderSubtle rounded-md px-3 font-mono text-[12px] uppercase text-textPrimary placeholder:text-textMuted placeholder:normal-case focus:border-silver/50 outline-none" data-form-ticker />
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
            <button type="button" onClick={submit} disabled={!canSubmit} className="w-full h-11 rounded-full border border-borderSubtle bg-ink/[0.05] text-[13px] text-textPrimary hover:bg-ink/[0.09] disabled:opacity-40 disabled:cursor-not-allowed transition-colors" data-form-submit>
              {tab === 'suggestion' ? 'submit suggestion' : 'submit bug report'}
            </button>
            {sent && <div className="text-center font-mono text-[11px] text-bull animate-slide-in">Got it — it is on the list with your vote on it</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Feedback;
