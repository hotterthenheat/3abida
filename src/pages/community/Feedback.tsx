import { useState } from 'react';
import { Check, Send } from 'lucide-react';
import Panel from '../../components/ui/Panel';
import SegmentedControl from '../../components/ui/SegmentedControl';
import { SHIPPED_FROM_FEEDBACK, loadCommunity, saveCommunity, timeAgo } from '../../data/community';
import type { FeedbackCategory, FeedbackEntry } from '../../types/community';

const CATEGORY_OPTIONS = [
  { value: 'BUG', label: 'Bug' },
  { value: 'UX', label: 'Usability' },
  { value: 'DATA', label: 'Data' },
  { value: 'OTHER', label: 'Other' },
] as const;

const Feedback = () => {
  const [state, setState] = useState(loadCommunity);
  const [category, setCategory] = useState<FeedbackCategory>('UX');
  const [message, setMessage] = useState('');
  const [justSent, setJustSent] = useState(false);

  const submit = () => {
    const body = message.trim();
    if (body.length < 10) return;
    const entry: FeedbackEntry = {
      id: `fb-${Date.now()}`,
      category,
      message: body,
      createdAt: new Date().toISOString(),
    };
    const next = { ...state, feedback: [entry, ...state.feedback] };
    setState(next);
    saveCommunity(next);
    setMessage('');
    setJustSent(true);
    setTimeout(() => setJustSent(false), 2500);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
      {/* Form + your notes */}
      <div className="xl:col-span-7 flex flex-col gap-4 min-w-0">
        <Panel title="Tell us what to improve" subtitle="short and honest beats long and polite" className="w-full">
          <div className="flex flex-col gap-3">
            <SegmentedControl ariaLabel="Category" options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="What slowed you down, confused you, or looked wrong?"
              rows={4}
              className="w-full bg-inputBg border border-borderSubtle rounded-md px-2.5 py-2 text-[12px] text-textPrimary placeholder:text-textMuted focus:border-borderMuted outline-none transition-colors resize-y"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={submit}
                disabled={message.trim().length < 10}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-select/40 bg-select/[0.06] hover:bg-select/[0.12] font-mono text-[11px] font-semibold uppercase tracking-wider text-select transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <Send className="w-3.5 h-3.5" /> Send feedback
              </button>
              {justSent && (
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-bull animate-slide-in">
                  <Check className="w-3.5 h-3.5" /> Got it — thank you
                </span>
              )}
            </div>
          </div>
        </Panel>

        {state.feedback.length > 0 && (
          <Panel title="Your notes" subtitle="stored in this browser until accounts launch" flush className="w-full">
            {state.feedback.map(fb => (
              <div key={fb.id} className="px-4 py-2.5 border-b border-borderSubtle/40 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-textSecondary">
                    {fb.category}
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-textMuted tnum">{timeAgo(fb.createdAt)}</span>
                </div>
                <p className="mt-1 text-[12px] text-textSecondary leading-relaxed">{fb.message}</p>
              </div>
            ))}
          </Panel>
        )}
      </div>

      {/* The loop, closed */}
      <div className="xl:col-span-5 min-w-0">
        <Panel title="Shipped from your feedback" subtitle="notes like yours became these" flush className="w-full">
          {SHIPPED_FROM_FEEDBACK.map(item => (
            <div key={item.title} className="flex items-start gap-2.5 px-4 py-3 border-b border-borderSubtle/40 last:border-0">
              <Check className="w-3.5 h-3.5 text-bull shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="block text-[12px] font-semibold text-textPrimary">{item.title}</span>
                <span className="block text-[11px] text-textSecondary leading-snug">{item.note}</span>
              </div>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
};

export default Feedback;
