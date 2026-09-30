/*
==================================================
  SLAYER TERMINAL - THE STORY'S BODY (data/newsBody.ts)

  Noah, 2026-09-28: "the current news page lacks the
  actual news read of what happened and just shows us
  the headline + what effect it can have on the
  market but some users actually want to read the
  story". A story on the wire carried a headline and
  a read, nothing to read. Now every item carries a
  BODY — a few paragraphs under the headline.

  IN THE SIMULATOR the bodies are templated like the
  headlines are: wire copy by the story's kind and
  its lean, the name and its figures filled in, the
  sentences picked by the item's own seed so a story
  reads the same every time it is opened. They are
  placeholders for the look, the way the headlines
  are. AT LAUNCH the body is what the provider
  licenses — the opening paragraphs or a summary and
  the link to the source (never a whole article) —
  and this file is not called.
==================================================
*/

import type { NewsCategory } from './news';
import type { UniverseName } from './universe';

interface StoryFacts {
  category: NewsCategory;
  /** −1…+1 */
  sentiment: number;
  headline: string;
  source: string;
  /** The name the story is about — none for a macro story */
  name?: UniverseName;
  /** The session's weekday in New York — "Monday" */
  weekday: string;
}

/** The dateline a wire puts first, by the source */
const DATELINE: Record<string, string> = { Reuters: 'NEW YORK (Reuters)', Bloomberg: 'New York (Bloomberg)', WSJ: 'NEW YORK', CNBC: 'New York', Barrons: 'New York', FT: 'New York' };

const pick = <T,>(h: (tag: string) => number, tag: string, arr: T[]): T => arr[Math.min(arr.length - 1, Math.floor(h(tag) * arr.length))];
const pct = (h: (tag: string) => number, tag: string, lo: number, hi: number, dp = 1) => (lo + h(tag) * (hi - lo)).toFixed(dp);

const SECTOR_LINE: Record<string, string[]> = {
  Technology: ['demand for its data-centre products', 'the pace of enterprise spending on its software', 'the mix shift toward higher-margin services'],
  Healthcare: ['pricing on its largest drugs', 'the timing of its next approvals', 'utilisation trends in its managed-care book'],
  Financials: ['net interest income as the curve moves', 'trading revenue in a quieter quarter', 'credit costs in its card book'],
  Energy: ['realised prices against the strip', 'production growth in the Permian', 'the pace of buybacks at current crude prices'],
  Consumer: ['traffic in its North American stores', 'the health of the lower-income shopper', 'freight and input costs into the holiday quarter'],
  Industrials: ['backlog conversion in its aerospace unit', 'pricing power as input costs ease', 'orders from its largest customers'],
};
const sectorLine = (u: UniverseName | undefined, h: (tag: string) => number) => pick(h, 'sec', SECTOR_LINE[u?.sector ?? ''] ?? ['the outlook for the rest of the year', 'margins in its core business', 'demand from its largest customers']);

function tickerStory(f: StoryFacts, u: UniverseName, h: (tag: string) => number): string[] {
  const up = f.sentiment >= 0;
  const dl = DATELINE[f.source] ?? 'New York';
  const move = pct(h, 'pm', 0.8, 4.2);
  const line = sectorLine(u, h);
  const react = up
    ? pick(h, 'r', [`${u.name} shares rose ${move}% in premarket trading.`, `The stock was up ${move}% before the open, on track for its best session in weeks.`, `Shares gained ${move}% in early trading, extending a run that began earlier this month.`])
    : pick(h, 'r', [`${u.name} shares fell ${move}% in premarket trading.`, `The stock was down ${move}% before the open, its weakest showing since the last print.`, `Shares lost ${move}% in early trading, giving back most of the month's gain.`]);
  switch (f.category) {
    case 'Analyst': {
      const p1 = `${dl} — ${u.name} drew a fresh ${up ? 'endorsement' : 'warning'} on Wall Street on ${f.weekday}, as the bank behind the call ${up ? 'raised its rating and its price target' : 'cut its rating and trimmed its target'} in a note to clients before the open.`;
      const p2 = up
        ? `The analyst argued that ${line} has been underestimated by the market, and that the shares do not yet reflect it. "${pick(h, 'q', ['The setup into the next two quarters is better than the multiple suggests', 'Estimates look too low from here', 'We think the debate has moved on'])}," the note said.`
        : `The analyst pointed to ${line} as the reason for the change, and said consensus estimates have further to fall. "${pick(h, 'q', ['We see more downside to numbers than the multiple allows', 'The easy part of the recovery is behind it', 'The risk-reward has turned'])}," the note said.`;
      const p3 = `${react} ${pick(h, 'n', [`The company did not immediately respond to a request for comment.`, `${u.name} reports its next quarter in the coming weeks.`, `Options volume in the name was running ahead of its average by mid-morning.`])}`;
      return [p1, p2, p3];
    }
    case 'Earnings': {
      const beat = pct(h, 'b', 1.5, 9);
      const rev = pct(h, 'rv', 3, 18, 0);
      const p1 = `${dl} — ${u.name} reported quarterly results that ${up ? `beat Wall Street's expectations by about ${beat}%` : `fell short of Wall Street's expectations by about ${beat}%`}, with revenue ${up ? 'up' : 'down'} ${rev}% from a year earlier.`;
      const p2 = `The company said ${line} ${up ? 'drove the quarter' : 'weighed on the quarter'}, and ${up ? 'that demand had held into the current period' : 'warned that the pressure would continue into the current period'}. Gross margin ${up ? 'widened' : 'narrowed'} ${pct(h, 'gm', 0.4, 2.6)} percentage points.`;
      const p3 = `${react} Executives will take questions from analysts on a call ${pick(h, 'c', ['at 5 p.m. Eastern', 'after the close', 'later this morning'])}.`;
      return [p1, p2, p3];
    }
    case 'Guidance': {
      const p1 = `${dl} — ${u.name} ${up ? 'raised' : 'cut'} its outlook for the year, telling investors it now expects ${up ? 'stronger' : 'weaker'} results than it forecast ${pick(h, 'w', ['three months ago', 'at the start of the year', 'last quarter'])}.`;
      const p2 = `The company cited ${line} ${up ? 'as the reason for the higher forecast' : 'as the reason for the lower forecast'}, and said ${up ? 'it would keep investing behind the demand it sees' : 'it would slow hiring and review spending'}. ${pick(h, 'x', ['The change was larger than most analysts had expected.', 'The new range brackets the current consensus.', 'The company has moved its outlook twice this year.'])}`;
      return [p1, p2, react];
    }
    case 'M&A': {
      const prem = pct(h, 'pr', 12, 38, 0);
      const p1 = `${dl} — ${u.name} is ${pick(h, 'st', ['in advanced talks', 'nearing a deal', 'in exclusive discussions'])} on a transaction that would value the target at a premium of about ${prem}% to its last close, according to people familiar with the matter.`;
      const p2 = `The terms are not final and the talks could still fall apart, the people said. A deal would ${pick(h, 'rt', ['add scale in a market where it has been losing share', 'bring in technology the company has struggled to build itself', 'be its largest purchase in more than a decade'])}, and would ${pick(h, 'rg', ['likely draw a close look from antitrust regulators', 'need approval in at least two jurisdictions', 'be paid for mostly in cash'])}.`;
      return [p1, p2, react];
    }
    case 'Product': {
      const p1 = `${dl} — ${u.name} ${up ? 'unveiled' : 'delayed'} ${pick(h, 'pd', ['a new generation of its flagship product', 'an expansion of its core service into new markets', 'a product it has been developing for more than two years'])}, ${up ? 'a launch analysts had flagged as the most important on its calendar this year' : 'a setback for a launch analysts had flagged as the most important on its calendar this year'}.`;
      const p2 = up
        ? `The company said ${pick(h, 'pw', ['early orders had exceeded its plan', 'pricing would come in above the prior generation', 'the product would ship to customers within weeks'])}, and that ${line} would benefit as it rolls out.`
        : `The company blamed ${pick(h, 'pw', ['supply constraints at a key partner', 'a late change to the design', 'a longer testing cycle than planned'])}, and said ${line} would carry the quarter until it ships.`;
      return [p1, p2, react];
    }
    case 'Regulatory': {
      const p1 = `${dl} — ${u.name} ${up ? 'won' : 'faces'} ${pick(h, 'rk', ['a ruling', 'a decision by regulators', 'a review'])} that ${up ? 'clears the way for' : 'threatens'} ${pick(h, 'rw', ['a business that accounts for a meaningful share of its profit', 'its plans in one of its fastest-growing markets', 'a practice at the centre of its business model'])}.`;
      const p2 = up
        ? `The company said the outcome ${pick(h, 'rs', ['confirms its reading of the law', 'removes an overhang that has weighed on the shares for a year', 'lets it move ahead with plans it had put on hold'])}. Legal analysts said an appeal was ${pick(h, 'ap', ['unlikely', 'possible but would take months', 'the next step for the other side'])}.`
        : `The company said it ${pick(h, 'rs', ['disagreed with the decision and would appeal', 'was reviewing the decision', 'would work with regulators on a remedy'])}. Legal analysts said the process could take ${pick(h, 'ap', ['months', 'more than a year', 'until the end of the year'])}, and that the financial impact was hard to size.`;
      return [p1, p2, react];
    }
    default:
      return [`${dl} — ${f.headline}.`, react];
  }
}

function macroStory(f: StoryFacts, h: (tag: string) => number): string[] {
  const up = f.sentiment >= 0;
  const dl = DATELINE[f.source] ?? 'New York';
  const head = f.headline.replace(/\s*[—;:].*$/, '');
  const hl = f.headline.toLowerCase();
  const yld = pct(h, 'y', 3, 11, 0);
  const fut = pct(h, 'f', 0.2, 1.1);
  const day = f.weekday;
  /* the quote and the desk, once */
  const desk = pick(h, 'who', ['a strategist at a large asset manager', 'an economist at a Wall Street bank', 'a rates trader at a primary dealer']);
  const yields = up
    ? `Treasury yields fell, with the 10-year note down about ${yld} basis points, and stock futures rose ${fut}%. The dollar ${pick(h, 'dx', ['slipped against most major currencies', 'gave back its early gain', 'was little changed'])}.`
    : `Treasury yields rose, with the 10-year note up about ${yld} basis points, and stock futures fell ${fut}%. The dollar ${pick(h, 'dx', ['strengthened against most major currencies', 'extended its gain', 'was little changed'])}.`;
  const fedOdds = `${pick(h, 'fed', ['Traders now see', 'Futures markets now price', 'Investors now expect'])} ${up ? 'a greater chance' : 'a smaller chance'} of a rate cut at the Federal Reserve's next meeting. "${pick(h, 'q', ['The data keep the Fed on hold for now', 'This changes the conversation at the next meeting', 'One print does not make a trend, but the direction is clear'])}," said ${desk}.`;

  /* OIL — a barrel story, not a rates story (the equity lean says which way crude went) */
  if (/opec|brent|wti|crude|\boil\b|aramco|cushing|barrel/.test(hl)) {
    const move = pct(h, 'om', 0.8, 3.4);
    const p1 = `${dl} — ${head}, ${pick(h, 'wh', ['traders said on', 'the group said on', 'a statement said on'])} ${day}, sending crude ${up ? 'lower' : 'higher'} and ${up ? 'lifting' : 'pressuring'} airline and transport shares.`;
    const p2 = `Brent traded ${up ? 'down' : 'up'} ${move}% by midday in London, with West Texas Intermediate ${up ? 'lower' : 'higher'} by a similar amount. Energy shares ${up ? 'lagged' : 'led'} the index, and ${pick(h, 'o2', ['the front of the futures curve moved the most', 'refiners moved with the crude price', 'the move was larger in the near-dated contracts'])}.`;
    const p3 = `"${pick(h, 'oq', ['The market is tighter than the strip suggests', 'Demand is doing the work here, not supply', 'This puts a floor under the front of the curve', 'Inventories tell you the rest of the story'])}," said an analyst at ${pick(h, 'od', ['a commodities trading house', 'an energy-focused fund', 'a Wall Street bank'])}. ${pick(h, 'o3', ['OPEC+ meets again next month.', 'The next inventory report is due Wednesday.', 'Hedge funds had cut their long positions into the announcement, positioning data showed.'])}`;
    return [p1, p2, p3];
  }
  /* AN ECONOMIC PRINT */
  if (/cpi|ppi|payroll|jobless|claims|\bism\b|pmi|gdp|retail sales|inflation|housing|sentiment|spending/.test(hl)) {
    const p1 = `${dl} — ${head}: ${pick(h, 'wh', ['data released on', 'a report published on', 'figures out on'])} ${day} ${up ? 'eased worries about the economy' : 'revived worries about the economy'} and ${up ? 'firmed bets on lower interest rates' : 'pushed back bets on lower interest rates'}.`;
    return [p1, yields, fedOdds];
  }
  /* THE FED SPEAKING */
  if (/\bfed\b|fed's|fomc|powell|waller|jefferson|williams|the fed/.test(hl)) {
    const p1 = `${dl} — ${head}, in remarks on ${day} that markets read as ${up ? 'leaning toward lower rates' : 'leaning against lower rates'} ${pick(h, 'fw', ['at the next meeting', 'before the end of the year', 'sooner than the committee had signalled'])}.`;
    const p2 = `${yields} ${pick(h, 'f2', ['The remarks followed a week of data that had left the committee divided.', 'Other officials have struck a more cautious tone this month.', 'The committee meets again in three weeks.'])}`;
    return [p1, p2, fedOdds];
  }
  /* RATES AND THE BOND MARKET */
  if (/yield|treasur|10-yr|bond|auction/.test(hl)) {
    const p1 = `${dl} — ${head} on ${day}, ${up ? 'a relief for stocks' : 'pressuring stocks'} as ${pick(h, 'r1', ['a heavy week of Treasury supply', 'stronger-than-expected data', 'hawkish remarks from Fed officials'])} ${up ? 'gave way' : 'weighed on the long end'}.`;
    const p2 = `${up ? 'Rate-sensitive shares led the gain, with homebuilders and utilities out front.' : 'Rate-sensitive shares fell the most, with homebuilders and utilities out front.'} Stock futures ${up ? 'rose' : 'fell'} ${fut}%. ${pick(h, 'r2', ['The move was concentrated in the long end of the curve.', 'The two-year note moved less, steepening the curve.', 'Volumes were heavy for the hour.'])}`;
    return [p1, p2, fedOdds];
  }
  /* ANYTHING ELSE ON THE MACRO WIRE */
  const p1 = `${dl} — ${head}, ${pick(h, 'g1', ['according to people familiar with the matter', 'the parties said on ' + day, 'a statement on ' + day + ' said'])}, ${up ? 'lifting' : 'weighing on'} stock futures and ${up ? 'the sectors most exposed to it' : 'the sectors most exposed to it'}.`;
  const p2 = `${pick(h, 'g2', ['The news landed before the open and moved the most exposed names first.', 'Traders had been positioned for a smaller move.', 'The reaction was sharpest in the names with the most to gain or lose.'])} Stock futures ${up ? 'rose' : 'fell'} ${fut}% within the hour.`;
  const p3 = `"${pick(h, 'gq', ['This is the kind of headline that sets the tone for the week', 'The market will want detail before it commits', 'It changes the calculus for the sector, not the index'])}," said ${desk}.`;
  return [p1, p2, p3];
}

/** The story's paragraphs, from its facts and its own seed */
export function storyBody(f: StoryFacts, h: (tag: string) => number): string[] {
  return f.name ? tickerStory(f, f.name, h) : macroStory(f, h);
}
