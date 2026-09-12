import type { NewsCategory } from '../../data/news';

/*
  Category identity colors — a CATEGORICAL palette (same idea as the Dark Pool
  sector dots), deliberately muted so it never impersonates the semantic set:
  nothing here is mint (bullish), hot red (bearish), neon lime (interface) or
  the supreme magenta (engine standout). The hue names the beat; the ± exp number beside it
  still carries the direction. Shared by the News page and the desk widget.
*/
export const CAT_COLOR: Record<NewsCategory, string> = {
  Earnings: '#E8C468', // amber — the numbers print
  Guidance: '#7EA6F0', // cornflower — forward-looking
  Analyst: '#9B8FE8', // periwinkle — opinion
  Macro: '#6ECFC4', // teal — the big picture
  'M&A': '#E89AC0', // pink — deals
  Product: '#7DD3A8', // sage — launches
  Regulatory: '#D98F8F', // muted rose — friction
};

const CatTag = ({ category, size = 10 }: { category: NewsCategory; size?: 9 | 10 }) => (
  <span
    className={`inline-flex items-center gap-1.5 font-mono font-semibold uppercase tracking-wider whitespace-nowrap ${size === 9 ? 'text-[9px]' : 'text-[10px]'}`}
    style={{ color: CAT_COLOR[category] }}
  >
    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CAT_COLOR[category] }} />
    {category}
  </span>
);

export default CatTag;
