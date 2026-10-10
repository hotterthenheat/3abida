/*
==================================================
  SLAYER TERMINAL - THE PERIOD'S FIGURES
  (components/review/JournalStats.tsx)

  The card beside the month (the partner's journal kept
  its figures there, and Noah keeps that): what the
  period made, then its figures in rows — a label at the
  left, the figure at the right, hairlines between the
  groups. Every figure a plain word:

    won · lost           how many each, and the rate
    winners made         what the winners made, added up
    losers lost          what the losers lost
    average win · loss
    best · worst trade
    best · worst day
    longest run          of wins, of losses — and the run
                         you stand in
    profit factor        the winners' dollars over the
                         losers'
    a trade was worth    the period's total over its
                         trades
    worst drop from a    the most the running total fell
    high                 from its best
    kept of the best     of all your trades were up at
                         their best, added, what you took
    held on average

  THESE ARE THE READER'S NUMBERS about their own trades.
==================================================
*/

import type { ReactNode } from 'react';
import { card } from './DeskShell';
import { dirInk, heldWords, pct, usd, usdSigned } from './words';
import { statsOf } from '../../data/review/engine';
import { keptOf } from '../../data/review/excursion';
import { dayMinOf, type JournalRow } from '../../data/review/journal';
import { grossOf, runsOf, type DayTotal } from '../../data/review/journalFigures';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayWords = (day: string) => {
  const d = new Date(`${day}T12:00:00`);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

const Row = ({ label, title, children, testId }: { label: string; title?: string; children: ReactNode; testId: string }) => (
  <div className="h-7 flex items-center justify-between gap-4" title={title} data-journal-stat={testId}>
    <span className="font-mono text-[10px] uppercase tracking-wider text-textMuted whitespace-nowrap">{label}</span>
    <span className="font-mono text-[12px] tnum text-textPrimary whitespace-nowrap">{children}</span>
  </div>
);
/** A group of rows; the groups share whatever height the row beside the calendar leaves, so the two cards end level */
const Group = ({ children }: { children: ReactNode }) => <div className="px-5 py-1.5 border-t border-borderSubtle/70 flex-1 flex flex-col justify-center">{children}</div>;

interface Props {
  rows: JournalRow[];
  /** The period's days, from the page */
  periodDays: Map<string, DayTotal>;
  /** "This month" · "All time" — what the figures are of */
  periodLabel: string;
}

const JournalStats = ({ rows, periodDays, periodLabel }: Props) => {
  const s = statsOf(rows.map(r => r.t));
  const gross = grossOf(rows);
  const runs = runsOf(rows);
  const kept = keptOf(rows);
  const ranked = [...periodDays.values()].sort((a, b) => b.net - a.net);
  const bestDay = ranked[0];
  const worstDay = ranked[ranked.length - 1];
  const losses = s.n - s.wins;
  const avgHeld = s.n ? heldWords(s.avgHeldMin, rows[0] ? dayMinOf(rows[0]) : 390) : '—';
  const none = <span className="text-textMuted">—</span>;

  return (
    <div className={`${card} flex flex-col min-w-0 h-full`} data-journal-stats={s.n}>
      <div className="px-5 pt-3.5 pb-2.5">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-widest text-textPrimary">{periodLabel}</div>
        <div className={`mt-1.5 font-mono text-[24px] font-semibold tnum leading-none ${s.n ? dirInk(s.net) : 'text-textMuted'}`} data-journal-stats-net>
          {s.n ? usdSigned(s.net) : '$0.00'}
        </div>
        <div className="mt-1.5 font-mono text-[11px] tnum text-textSecondary">{s.n ? `${s.n} ${s.n === 1 ? 'trade' : 'trades'} · ${periodDays.size} ${periodDays.size === 1 ? 'day' : 'days'} traded` : 'Nothing closed in this period'}</div>
      </div>
      <Group>
        <Row label="Won · lost" testId="won">
          {s.n ? (
            <>
              <span className="text-bull">{s.wins}</span> · <span className="text-bear">{losses}</span> <span className="text-textMuted">· {pct(s.winRate)}</span>
            </>
          ) : (
            none
          )}
        </Row>
        <Row label="Winners made" testId="gross-made">{s.wins ? <span className="text-bull">{usdSigned(gross.made)}</span> : none}</Row>
        <Row label="Losers lost" testId="gross-lost">{losses ? <span className="text-bear">{usdSigned(gross.lost)}</span> : none}</Row>
        <Row label="Profit factor" title="What the winners made, over what the losers lost" testId="pf">
          {!s.n ? none : s.profitFactor == null ? <span className="text-bull">no losses</span> : <span className={s.profitFactor >= 1 ? 'text-bull' : 'text-bear'}>{s.profitFactor.toFixed(2)}</span>}
        </Row>
      </Group>
      <Group>
        <Row label="Average win" testId="avg-win">{s.wins ? <span className="text-bull">{usdSigned(s.avgWin)}</span> : none}</Row>
        <Row label="Average loss" testId="avg-loss">{losses ? <span className="text-bear">{usdSigned(s.avgLoss)}</span> : none}</Row>
        <Row label="A trade was worth" title="The period's total, over how many trades" testId="expectancy">{s.n ? <span className={dirInk(s.expectancy)}>{usdSigned(s.expectancy)}</span> : none}</Row>
        <Row label="Best · worst trade" testId="best-worst">
          {s.n ? (
            <>
              <span className={dirInk(s.best)}>{usdSigned(s.best, 0)}</span> · <span className={dirInk(s.worst)}>{usdSigned(s.worst, 0)}</span>
            </>
          ) : (
            none
          )}
        </Row>
      </Group>
      <Group>
        <Row label="Best day" testId="best-day">
          {bestDay ? (
            <>
              <span className={dirInk(bestDay.net)}>{usdSigned(bestDay.net, 0)}</span> <span className="text-textMuted">{dayWords(bestDay.day)}</span>
            </>
          ) : (
            none
          )}
        </Row>
        <Row label="Worst day" testId="worst-day">
          {worstDay && periodDays.size > 1 ? (
            <>
              <span className={dirInk(worstDay.net)}>{usdSigned(worstDay.net, 0)}</span> <span className="text-textMuted">{dayWords(worstDay.day)}</span>
            </>
          ) : (
            none
          )}
        </Row>
        <Row label="Longest run" title={runs.now ? `The most wins in a row, and the most losses — and the run the last trades make: ${runs.now.n} ${runs.now.won ? 'won' : 'lost'} in a row` : 'The most wins in a row, and the most losses in a row'} testId="runs">
          {s.n ? (
            <>
              <span className="text-bull">{runs.wins} {runs.wins === 1 ? 'win' : 'wins'}</span> · <span className="text-bear">{runs.losses} {runs.losses === 1 ? 'loss' : 'losses'}</span>
              {runs.now && runs.now.n > 1 && <span className="text-textMuted"> · now {runs.now.n} {runs.now.won ? 'won' : 'lost'}</span>}
            </>
          ) : (
            none
          )}
        </Row>
      </Group>
      <Group>
        <Row label="Worst drop from a high" title="The most the running total fell from its best before it made a new one" testId="drop">{!s.n ? none : s.maxDrawdown > 0 ? <span className="text-bear">−{usd(s.maxDrawdown)}</span> : <span className="text-textSecondary">none</span>}</Row>
        <Row label="Kept of the best run-up" title={kept.share != null ? `Your trades were up ${usdSigned(kept.best, 0)} at their best, added together; ${usdSigned(kept.made, 0)} of it was taken` : 'None of these trades was ever up'} testId="kept">
          {kept.share != null ? pct(kept.share) : none}
        </Row>
        <Row label="Held on average" testId="held">{s.n ? avgHeld : none}</Row>
      </Group>
    </div>
  );
};

export default JournalStats;
