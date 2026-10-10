/*
==================================================
  SLAYER TERMINAL - THE GLOSSARY (data/glossary.ts)

  The ideas report's "a glossary page grown from
  data/terms.ts" (2026-10-10). Every word the terminal
  defines in one list: the Term cards' dictionary
  (data/terms.ts) and the rooms' own words at the foot
  of Pinpoint's guides (components/levels/Glossary.tsx),
  each said once — where both define a word, the room's
  newer line stands, so a word means one thing.

  EACH WORD SAYS WHAT IT STANDS ON, in the landing's
  three kinds (the read's "Observed / Calculated /
  Modeled", the Data page's): observed is read off the
  feed as it prints, calculated is arithmetic on what
  was observed, modeled comes from a model — and a
  modeled word says what the model assumes. The
  dealers' words share one assumption, the line every
  "How sure" prints (data/levelSureness.ts).
==================================================
*/

import { TERMS, type TermKey } from './terms';
import { ROOM_WORDS } from '../components/levels/Glossary';
import { ASSUMPTION_WORDS } from './levelSureness';

export type WordKind = 'Observed' | 'Calculated' | 'Modeled';
export type WordGroup = 'Dealers and levels' | 'The tape' | 'Contracts' | 'Earnings' | 'The chart' | 'On the desk';
export const WORD_GROUPS: readonly WordGroup[] = ['Dealers and levels', 'The tape', 'Contracts', 'Earnings', 'The chart', 'On the desk'];

export interface GlossaryEntry {
  /** The word as the terminal prints it */
  term: string;
  /** Its one line */
  meaning: string;
  kind: WordKind;
  /** What it stands on — for a modeled word, what the model assumes */
  assumes: string;
  group: WordGroup;
  /** The anchor on the glossary page: /glossary#call-wall */
  slug: string;
  /** It stands on the dealers' side (DEALERS_SIDE) — the group says it once; `more` is what it adds */
  dealers: boolean;
  more: string;
}

/* ---- what each kind stands on, said once ---------------------------------------------------------------------- */

const OBSERVED = 'Nothing beyond the feed — it is read as it prints.';
const CALCULATED = 'Only arithmetic on figures the feed printed — nothing is estimated.';
/** The dealers' side, as every "How sure" says it — without its own "Assumes", which the page prints beside it */
export const DEALERS_SIDE = `${ASSUMPTION_WORDS.replace(/^Assumes c/, 'C')} Open interest is counted once a day; the price it is read at is live.`;
const DEALERS = DEALERS_SIDE;
const PRICING = 'A pricing model fed the contract’s own implied volatility: moves follow the bell that volatility draws, with no jumps. A real move can be wider than the bell.';
const AGGRESSOR = 'That a fill at the ask was a buyer and one at the bid a seller. A fill does not say who started it, and a print can be one leg of something larger.';
const HISTORY = 'That the name’s past reports say something about this one. Eight reports are few.';

type Row = [WordGroup, WordKind, string?];

/* EVERY TERM'S PLACE: its group, its kind, and what it stands on where the kind's own line does not say it */
const PLACE: Record<TermKey, Row> = {
  'Expected move': ['Earnings', 'Modeled', 'That the at-the-money straddle’s price is the market’s whole estimate of the move. It carries no direction.'],
  'Typical move': ['Earnings', 'Calculated', HISTORY],
  'Priced vs typical': ['Earnings', 'Calculated', `Today’s straddle against the last eight reports’ moves. ${HISTORY}`],
  'Last 8 reports': ['Earnings', 'Observed', 'The company’s reported figures against the estimates of the day.'],
  'Up vs down': ['Earnings', 'Modeled', 'That flow and analysts’ revisions lean the way the move goes. They often do not.'],
  'IV rank': ['Earnings', 'Calculated', 'That the past year is a fair yardstick for this name’s option prices.'],
  'Straddle cost': ['Earnings', 'Observed'],
  Revisions: ['Earnings', 'Observed', 'The analysts’ published estimates, as they changed.'],
  'Implied vs realized': ['Earnings', 'Calculated', HISTORY],
  'Beat rate': ['Earnings', 'Calculated', HISTORY],
  Pricing: ['Earnings', 'Calculated', `Today’s expected move against the name’s typical one. ${HISTORY}`],
  'Exp · DTE': ['The tape', 'Observed'],
  OTM: ['The tape', 'Calculated'],
  Spread: ['The tape', 'Observed'],
  Prem: ['The tape', 'Calculated'],
  Flow: ['The tape', 'Observed', AGGRESSOR],
  'Day ratio': ['The tape', 'Calculated', AGGRESSOR],
  Sentiment: ['The tape', 'Calculated', AGGRESSOR],
  'ΔOI': ['The tape', 'Observed', 'Open interest is counted once a day, after the close — the change is overnight, never intraday.'],
  'V/OI': ['The tape', 'Calculated'],
  IV: ['The tape', 'Modeled', 'The volatility a pricing model needs to return the option’s price. It is backed out of the price, not observed.'],
  Tag: ['The tape', 'Observed', 'How the print was routed, as the feed tags it.'],
  'Exposure ledger': ['On the desk', 'Modeled', DEALERS],
  'Exposure matrix': ['On the desk', 'Modeled', DEALERS],
  GEX: ['Dealers and levels', 'Modeled', DEALERS],
  'Net GEX': ['Dealers and levels', 'Modeled', DEALERS],
  'Net DEX': ['Dealers and levels', 'Modeled', DEALERS],
  'Net VEX': ['Dealers and levels', 'Modeled', DEALERS],
  BPS: ['On the desk', 'Calculated'],
  NBR: ['On the desk', 'Calculated'],
  Priority: ['Dealers and levels', 'Modeled', `${DEALERS} The reasons are weighed inside the engine.`],
  'Ranked by': ['On the desk', 'Calculated'],
  Class: ['Dealers and levels', 'Modeled', DEALERS],
  'Call wall': ['Dealers and levels', 'Modeled', DEALERS],
  'Put wall': ['Dealers and levels', 'Modeled', DEALERS],
  'Gamma flip': ['Dealers and levels', 'Modeled', DEALERS],
  Pin: ['Dealers and levels', 'Calculated', 'Only open interest, counted once a day.'],
  Supreme: ['Dealers and levels', 'Modeled', DEALERS],
  'Size at a strike': ['Dealers and levels', 'Modeled', DEALERS],
  'Net at a strike': ['Dealers and levels', 'Modeled', DEALERS],
  'The wall now': ['Dealers and levels', 'Modeled', DEALERS],
  'What a move forces': ['Dealers and levels', 'Modeled', `${DEALERS} And that dealers hedge every step of the way, where real desks hedge in bands.`],
  'Gamma share': ['Dealers and levels', 'Modeled', DEALERS],
  'From spot': ['On the desk', 'Calculated'],
  Exposure: ['Dealers and levels', 'Modeled', DEALERS],
  'In the path': ['Dealers and levels', 'Modeled', DEALERS],
  'Open interest': ['The tape', 'Observed', 'Counted once a day, after the close — it does not say who holds the contracts.'],
  Volume: ['The tape', 'Observed'],
  Tail: ['Dealers and levels', 'Modeled', DEALERS],
  Puts: ['Dealers and levels', 'Modeled', DEALERS],
  Calls: ['Dealers and levels', 'Modeled', DEALERS],
  Charm: ['Dealers and levels', 'Modeled', `${DEALERS} ${PRICING}`],
  Vanna: ['Dealers and levels', 'Modeled', `${DEALERS} ${PRICING}`],
  Mark: ['Contracts', 'Calculated', 'Halfway between the bid and the ask the feed printed.'],
  'ITM odds': ['Contracts', 'Modeled', PRICING],
  'OTM odds': ['Contracts', 'Modeled', PRICING],
  'Touch odds': ['Contracts', 'Modeled', PRICING],
  'Profit odds': ['Contracts', 'Modeled', PRICING],
  Breakeven: ['Contracts', 'Calculated', 'The premium paid at the mark, held to expiry.'],
  'To breakeven': ['Contracts', 'Calculated'],
  'Intrinsic value': ['Contracts', 'Calculated'],
  'Extrinsic value': ['Contracts', 'Calculated'],
  Delta: ['Contracts', 'Modeled', PRICING],
  Gamma: ['Contracts', 'Modeled', PRICING],
  Theta: ['Contracts', 'Modeled', PRICING],
  Vega: ['Contracts', 'Modeled', PRICING],
  Rho: ['Contracts', 'Modeled', PRICING],
  'Prior day': ['The chart', 'Observed'],
  'Opening range': ['The chart', 'Observed'],
  'Initial balance': ['The chart', 'Observed'],
  'Expected move cone': ['The chart', 'Modeled', 'That the day’s move follows the bell the options priced this morning.'],
  'Model error': ['Dealers and levels', 'Modeled', `${DEALERS} The error is measured against a reference the model does not see.`],
  'Time machine': ['On the desk', 'Observed', 'Only the readings recorded at the time — nothing is filled in between.'],
  'Structural divergence': ['Dealers and levels', 'Modeled', DEALERS],
  'Cost basis': ['The tape', 'Calculated', AGGRESSOR],
  'Charm clock': ['Dealers and levels', 'Modeled', `${DEALERS} ${PRICING}`],
  'Map stability': ['Dealers and levels', 'Modeled', `${DEALERS} Implied volatility moved two points, open interest held as it stands.`],
  'ΔOI heat': ['Dealers and levels', 'Modeled', DEALERS],
  'Spot scenario': ['Dealers and levels', 'Modeled', `${DEALERS} Open interest held exactly as it stands at the price not yet reached.`],
  'Expected hedging flow': ['Dealers and levels', 'Modeled', `${DEALERS} And continuous hedging, where real desks hedge in bands.`],
  'Air pocket': ['Dealers and levels', 'Modeled', DEALERS],
  'Expiry ladder': ['Dealers and levels', 'Modeled', DEALERS],
  'Event markers': ['The chart', 'Observed', 'The published calendar and the tape’s own prints.'],
  'RSI 14': ['The chart', 'Calculated'],
  'VWAP bands': ['The chart', 'Calculated'],
  'Distance unit': ['On the desk', 'Calculated', 'ATR is the name’s own past range; σ is the options’ priced move for the day — the one unit a model stands behind.'],
  'σ distance': ['The chart', 'Modeled', 'The day’s move the options priced, read as a bell.'],
  'Bar clock': ['The chart', 'Calculated'],
  'Range bars': ['The chart', 'Calculated', 'Built from the live 15-second tape: they start at connect and carry no history.'],
  'Volume bars': ['The chart', 'Calculated', 'Built from the live 15-second tape: they start at connect and carry no history.'],
  'Alert kinds': ['On the desk', 'Observed', 'Alerts run while this tab is open; nothing runs when it is closed.'],
  'Armed rail': ['On the desk', 'Observed', 'Alerts run while this tab is open; nothing runs when it is closed.'],
  'Value area': ['The chart', 'Calculated'],
  'Timeframe trend': ['The chart', 'Calculated'],
  'Max pain': ['Dealers and levels', 'Calculated', 'Only arithmetic on open interest, counted once a day. It assumes nothing about where price goes.'],
  'Gamma pin': ['Dealers and levels', 'Modeled', DEALERS],
  'GEX percentile': ['Dealers and levels', 'Modeled', `${DEALERS} The rank is only as long as the history behind it.`],
  'Price scale': ['On the desk', 'Calculated'],
  Attribution: ['The tape', 'Observed', 'The day’s prints at the strike. A print does not say who sent it.'],
  Provenance: ['On the desk', 'Observed', 'It names the kind each figure is; it assumes nothing itself.'],
  MACD: ['The chart', 'Calculated'],
  Bollinger: ['The chart', 'Calculated'],
  ATR: ['The chart', 'Calculated'],
  Globex: ['The chart', 'Observed'],
  VPOC: ['The chart', 'Calculated'],
  Measure: ['On the desk', 'Calculated'],
  Annualized: ['On the desk', 'Calculated', 'Trading time, not calendar time: a weekend does not count against it.'],
};

/* THE ROOM'S WORDS (Pinpoint's guides), and what each stands on */
const ROOM_PLACE: Record<keyof typeof ROOM_WORDS, Row> = {
  wall: ['Dealers and levels', 'Modeled', DEALERS],
  shelf: ['Dealers and levels', 'Modeled', DEALERS],
  trapdoor: ['Dealers and levels', 'Modeled', DEALERS],
  pocket: ['Dealers and levels', 'Modeled', DEALERS],
  flip: ['Dealers and levels', 'Modeled', DEALERS],
  supreme: ['Dealers and levels', 'Modeled', DEALERS],
  pin: ['Dealers and levels', 'Calculated', 'Only open interest, counted once a day.'],
  maxPain: ['Dealers and levels', 'Calculated', 'Only arithmetic on open interest, counted once a day. It assumes nothing about where price goes.'],
  run: ['Dealers and levels', 'Modeled', `${PRICING} The strikes’ pull bends the bell.`],
  pull: ['Dealers and levels', 'Modeled', `${DEALERS} How much the hedging bends the odds is the engine’s own.`],
  ruler: ['On the desk', 'Calculated'],
  reach: ['Dealers and levels', 'Modeled', PRICING],
  sign: ['Dealers and levels', 'Modeled', DEALERS],
};

const DEFAULT_ASSUMES: Record<WordKind, string> = { Observed: OBSERVED, Calculated: CALCULATED, Modeled: PRICING };

export const slugOf = (term: string): string =>
  term
    .toLowerCase()
    .replace(/δ/g, 'delta-')
    .replace(/σ/g, 'sigma-')
    .replace(/’/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const entry = (term: string, meaning: string, [group, kind, assumes]: Row): GlossaryEntry => {
  const said = assumes ?? DEFAULT_ASSUMES[kind];
  const dealers = said.startsWith(DEALERS);
  return { term, meaning, kind, assumes: said, group, slug: slugOf(term), dealers, more: dealers ? said.slice(DEALERS.length).trim() : said };
};

/** Every word, once — the room's line where both define it — in each group's alphabetical order */
export const GLOSSARY: GlossaryEntry[] = (() => {
  const byName = new Map<string, GlossaryEntry>();
  for (const k of Object.keys(TERMS) as TermKey[]) byName.set(k.toLowerCase(), entry(k, TERMS[k], PLACE[k]));
  for (const k of Object.keys(ROOM_WORDS) as (keyof typeof ROOM_WORDS)[]) {
    const [term, meaning] = ROOM_WORDS[k];
    byName.set(term.toLowerCase(), entry(term, meaning, ROOM_PLACE[k]));
  }
  /* the room's "Flip" and "Supreme" say what the dictionary's "Gamma flip" and "Supreme" say: one entry each */
  byName.delete('gamma flip');
  const order = (e: GlossaryEntry) => WORD_GROUPS.indexOf(e.group);
  return [...byName.values()].sort((a, b) => order(a) - order(b) || a.term.localeCompare(b.term));
})();

const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

/** The words a search finds: the word itself first, then a word whose line holds the search */
export function searchGlossary(query: string, kind?: WordKind | null): GlossaryEntry[] {
  const q = fold(query.trim());
  const pool = kind ? GLOSSARY.filter(e => e.kind === kind) : GLOSSARY;
  if (!q) return pool;
  /* the word itself, then a word that starts with it, then one that holds it */
  const rank = (e: GlossaryEntry) => {
    const t = fold(e.term);
    return t === q ? 0 : t.startsWith(q) ? 1 : t.split(/[^a-z0-9]+/).some(w => w.startsWith(q)) ? 2 : 3;
  };
  const named = pool.filter(e => fold(e.term).includes(q)).sort((a, b) => rank(a) - rank(b));
  const said = pool.filter(e => !named.includes(e) && (fold(e.meaning).includes(q) || fold(e.assumes).includes(q)));
  return [...named, ...said];
}

/** One word by its name or its anchor */
export const glossaryEntry = (word: string): GlossaryEntry | undefined => {
  const w = word.toLowerCase();
  return GLOSSARY.find(e => e.term.toLowerCase() === w || e.slug === w);
};
