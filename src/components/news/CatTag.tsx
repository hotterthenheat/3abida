import type { NewsCategory } from '../../data/news';

/*
  Category identity colors — a CATEGORICAL palette (same idea as the Dark Pool
  sector dots), deliberately muted so it never impersonates the semantic set:
  nothing here is mint (bullish), hot red (bearish), the silver (interface) or
  the supreme magenta (engine standout). The hue names the beat; the ± exp number beside it
  still carries the direction. Shared by the News page and the desk widget.
*/
/* AS TOKENS (2026-09-16): the seven hues live in theme/tokens.css — the dark set is these pastels,
   the light set cuts each to 5.6:1 or better on white (printed on paper they were 1.5:1 to 1.9:1) */
export const CAT_COLOR: Record<NewsCategory, string> = {
  Earnings: 'rgb(var(--cat-earnings))', // amber — the numbers print
  Guidance: 'rgb(var(--cat-guidance))', // cornflower — forward-looking
  Analyst: 'rgb(var(--cat-analyst))', // periwinkle — opinion
  Macro: 'rgb(var(--cat-macro))', // teal — the big picture
  'M&A': 'rgb(var(--cat-ma))', // pink — deals
  Product: 'rgb(var(--cat-product))', // sage — launches
  Regulatory: 'rgb(var(--cat-regulatory))', // muted rose — friction
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
