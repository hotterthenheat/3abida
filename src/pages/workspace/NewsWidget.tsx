/*
==================================================
  SLAYER TERMINAL - WORKSPACE NEWS
  The wire on the desk (Noah, 2026-08-22): the same
  feed the News page reads, by beat, each headline
  with the model's next-session read. A click opens
  the News page with that headline already selected.
==================================================
*/

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CatTag from '../../components/news/CatTag';
import { buildNewsFeed, type NewsCategory } from '../../data/news';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';

type Filter = 'ALL' | NewsCategory;

const FILTERS: DropdownOption<Filter>[] = [
  { value: 'ALL', label: 'Every beat', hint: 'The whole wire' },
  { value: 'Earnings', label: 'Earnings', hint: 'Reports and the reaction' },
  { value: 'Guidance', label: 'Guidance', hint: 'What companies say comes next' },
  { value: 'Analyst', label: 'Analyst', hint: 'Upgrades, downgrades, targets' },
  { value: 'Macro', label: 'Macro', hint: 'Rates, data, the Fed' },
];

const NewsWidget = () => {
  const navigate = useNavigate();
  const feed = useMemo(() => buildNewsFeed(), []);
  const [filter, setFilter] = useState<Filter>('ALL');
  const rows = useMemo(() => (filter === 'ALL' ? feed : feed.filter(n => n.category === filter)), [feed, filter]);

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="shrink-0 px-2 py-1.5 border-b border-borderSubtle/60 flex items-center gap-2">
        <DropdownSelect label="Beat" value={filter} options={FILTERS} onChange={setFilter} title="Which beat of the wire" testId="news-beat" />
        <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-textMuted tnum">{rows.length} on the wire</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {rows.map(n => {
          const move = n.prediction.expMove1dPct;
          const tone = n.sentiment > 0.12 ? 'text-bull' : n.sentiment < -0.12 ? 'text-bear' : 'text-textSecondary';
          return (
            <button
              key={n.id}
              onClick={() => navigate('/record/news', { state: { selectedId: n.id } })}
              title="Open on the News page"
              className="w-full flex flex-col gap-1 px-2.5 py-2 border-b border-borderSubtle/30 text-left transition-colors hover:bg-ink/[0.03]"
            >
              <span className="flex items-center gap-2 min-w-0">
                <CatTag category={n.category} size={9} />
                {n.ticker && <span className="font-mono text-[10px] font-bold text-textPrimary">{n.ticker}</span>}
                <span className="ml-auto font-mono text-[9px] text-textMuted whitespace-nowrap">
                  {n.source} · {n.time}
                </span>
              </span>
              <span className="block text-[11px] text-textPrimary leading-snug line-clamp-2">{n.headline}</span>
              {/* The model's read — the direction the wire implies, in the market's ink */}
              <span className="flex items-center gap-2 font-mono text-[10px] tnum">
                <span className={`font-semibold ${tone}`}>
                  {move > 0 ? '+' : ''}
                  {move.toFixed(1)}% next session
                </span>
                <span className="text-textMuted">·</span>
                <span className="text-textSecondary">up {Math.round(n.prediction.probUpPct)}%</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default NewsWidget;
