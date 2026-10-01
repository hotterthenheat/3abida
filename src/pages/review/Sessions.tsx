/*
==================================================
  SLAYER TERMINAL - REVIEW › BACKTEST · THE SESSIONS
  (pages/review/Sessions.tsx)

  Where a backtest begins and where it is come back
  to. One line of cards makes a session — the name,
  the money it starts with, the day the clock starts
  on, the fee — and the list under it is every
  session kept on this machine: where its clock
  stands, what it is worth, what its closed trades
  add up to, and the doors to its desk and its report.

  TWO NAMES AND THE READER'S OWN RULES (Noah,
  2026-09-20: two tickers a session, "build it, hard
  blocks"). ONE NAME IS THE DEFAULT AND A SECOND IS
  ADDED (the same day, with a picture of a card that
  read "AND · One name": "seems counterintuitive like
  its forcing you to choose 2 names"): a dashed door,
  "+ A second name", becomes the card when pressed —
  opening straight onto its search — and an × beside it
  takes it away again.
  OPTIONS ONLY since 2026-09-30: the futures card and
  its products went with the futures backtest.
  The rules are three — how many positions may be open
  at once, what one trade may cost, where the day
  stops. They are chosen HERE and nowhere else: the
  sentence under the cards says so before the press,
  because a rule that can be loosened in the middle of
  a losing day is not a rule.
==================================================
*/

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import RenameDoor from '../../components/review/RenameDoor';
import TraceBox, { Fact, TraceGrid } from '../../components/trace/TraceBox';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import DropdownSearch from '../../components/ui/DropdownSearch';
import CompanyLogo from '../../components/ui/CompanyLogo';
import DayCard from '../../components/review/DayCard';
import type { Column } from '../../components/ui/DataTable';
import { accountOf, namesOf, statsOf, DEFAULT_FEE, type Session, type SessionRules } from '../../data/review/engine';
import { createSession, deleteSession, renameSession, runAgain, useSessions } from '../../data/review/store';
import { REVIEW_NAMES, dayWords, reviewName, tapeDays } from '../../data/review/tape';
import { dirInk, momentWords, pct, usd, usdSigned } from '../../components/review/words';

const SILVER_FILL = 'rgb(var(--silver-fill))';
const CASH: DropdownOption<number>[] = [5000, 10000, 25000, 50000, 100000].map(v => ({ value: v, label: usd(v, 0), hint: v === 25000 ? 'The size most day-trading rules start at' : undefined }));
const FEES: DropdownOption<number>[] = [
  { value: DEFAULT_FEE, label: '$0.65 a contract', hint: 'What most brokers charge, each way' },
  { value: 0, label: 'No fee', hint: 'A broker that charges nothing for contracts' },
  { value: 1, label: '$1.00 a contract', hint: 'A dearer broker, or exchange fees on top' },
];
const NAME_OPTIONS = REVIEW_NAMES.map(n => ({ value: n.ticker, label: n.ticker, hint: n.name, logo: n.ticker, keywords: n.name }));
/* THE READER'S OWN RULES — 0 is "no rule". Hard blocks on a way in, never on a way out (data/review/engine). */
const OPEN_RULES: DropdownOption<number>[] = [
  { value: 0, label: 'No limit', hint: 'As many positions as the cash pays for' },
  ...[1, 2, 3, 5].map(v => ({ value: v, label: v === 1 ? '1 position' : `${v} positions`, hint: v === 1 ? 'One trade at a time, across both names' : `A buy that would open a ${v === 2 ? 'third' : v === 3 ? 'fourth' : 'sixth'} is refused` })),
];
const RISK_RULES: DropdownOption<number>[] = [
  { value: 0, label: 'No limit', hint: 'A trade may cost whatever the cash pays for' },
  ...[0.01, 0.02, 0.05, 0.1].map(v => ({ value: v, label: `${v * 100}% of the account`, hint: 'The premium and the fees of one trade — for a bought option, that is its risk' })),
];
const DAY_RULES: DropdownOption<number>[] = [
  { value: 0, label: 'No stop', hint: 'A bad day can go on' },
  ...[0.02, 0.03, 0.05, 0.1].map(v => ({ value: v, label: `Down ${v * 100}%`, hint: 'Measured from what the account was worth at the open — no new positions until the next one' })),
];

interface Row {
  s: Session;
  equity: number;
  net: number;
  trades: number;
  winRate: number;
  open: number;
}

const Sessions = () => {
  const navigate = useNavigate();
  const sessions = useSessions();
  const days = tapeDays();
  const [ticker, setTicker] = useState('SPY');
  const [second, setSecond] = useState('');
  /** The "second name" card has been asked for (it may still be empty) */
  const [adding, setAdding] = useState(false);
  const [maxOpen, setMaxOpen] = useState(0);
  const [maxRisk, setMaxRisk] = useState(0);
  const [dayStop, setDayStop] = useState(0);
  const [cash, setCash] = useState(25000);
  const [fee, setFee] = useState(DEFAULT_FEE);
  /* three months back: room to run forward, and not so far back that today's names look strange */
  const [startDay, setStartDay] = useState(days[Math.max(0, days.length - 63)]);

  const rows = useMemo<Row[]>(
    () =>
      sessions.map(s => {
        const a = accountOf(s);
        const st = statsOf(a.trades);
        return { s, equity: a.equity, net: a.equity - s.startCash, trades: st.n, winRate: st.winRate, open: a.positions.length };
      }),
    [sessions]
  );
  const totals = useMemo(() => ({ trades: rows.reduce((a, r) => a + r.trades, 0), net: rows.reduce((a, r) => a + r.net, 0) }), [rows]);

  const tickers = second && second !== ticker ? [ticker, second] : [ticker];
  const rules: SessionRules = { maxOpen: maxOpen || undefined, maxRiskPct: maxRisk || undefined, dailyLossPct: dayStop || undefined };
  const ruleWords = [maxOpen ? `no more than ${maxOpen} ${maxOpen === 1 ? 'position' : 'positions'} open at once` : '', maxRisk ? `no trade over ${maxRisk * 100}% of the account` : '', dayStop ? `the day is over at −${dayStop * 100}%` : ''].filter(Boolean);
  const start = () => {
    const s = createSession({ name: `${tickers.join(' + ')} from ${dayWords(startDay)}`, ticker, tickers, rules, startCash: cash, fee, startDay });
    navigate(`/practice/backtest/${s.id}`);
  };

  const columns = useMemo<Column<Row>[]>(
    () => [
      {
        key: 'name',
        header: 'Session',
        sortValue: r => r.s.name,
        render: r => (
          <span className="inline-flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1 shrink-0">
              {namesOf(r.s).map(t => (
                <CompanyLogo key={t} ticker={t} size={15} />
              ))}
            </span>
            <span className="font-semibold text-textPrimary truncate">{r.s.name}</span>
          </span>
        ),
      },
      { key: 'clock', header: 'The clock stands at', sortValue: r => r.s.cursor.day, render: r => <span className="text-textSecondary">{momentWords(r.s.cursor)}</span> },
      { key: 'start', header: 'Started with', align: 'right', sortValue: r => r.s.startCash, render: r => <span className="text-textSecondary">{usd(r.s.startCash, 0)}</span> },
      { key: 'equity', header: 'Worth now', align: 'right', sortValue: r => r.equity, render: r => <span className="text-textPrimary">{usd(r.equity)}</span> },
      { key: 'net', header: 'Up or down', align: 'right', sortValue: r => r.net, render: r => <span className={`font-semibold ${dirInk(r.net)}`}>{usdSigned(r.net)}</span> },
      { key: 'trades', header: 'Closed trades', align: 'right', sortValue: r => r.trades, render: r => <span className="text-textPrimary">{r.trades}</span> },
      { key: 'win', header: 'Won', align: 'right', sortValue: r => r.winRate, render: r => (r.trades ? <span className="text-textPrimary">{pct(r.winRate)}</span> : <span className="text-textMuted">—</span>) },
      { key: 'open', header: 'Open', align: 'right', sortValue: r => r.open, render: r => (r.open ? <span className="text-textPrimary">{r.open}</span> : <span className="text-textMuted">—</span>) },
      {
        key: 'doors',
        header: '',
        align: 'right',
        render: r => (
          /* `leading-normal` + `align-middle`: a grid cell's line is as tall as its row, and a button inherits it — its word
             dropped to the button's floor and the pair rode high on the row (Noah, 2026-09-20, with a picture) */
          <span className="inline-flex items-center gap-1.5 leading-normal align-middle">
            <button type="button" onClick={() => navigate(`/practice/backtest/${r.s.id}/report`)} className="inline-flex items-center h-6 px-2 rounded-md border border-borderSubtle font-mono text-[10px] text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors" data-session-report={r.s.id}>
              Report
            </button>
            <RenameDoor name={r.s.name} onSave={name => renameSession(r.s.id, name)} />
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                const again = runAgain(r.s.id);
                if (again) navigate(`/practice/backtest/${again.id}`);
              }}
              title="Run it again — a new session on the same names, money, start day and rules, with a fresh book"
              aria-label={`Run ${r.s.name} again`}
              className="inline-flex items-center justify-center w-6 h-6 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] transition-colors"
              data-session-again={r.s.id}
            >
              <RotateCcw className="w-3 h-3" />
            </button>
            <button type="button" onClick={() => deleteSession(r.s.id)} title="Delete this session and its trades" aria-label={`Delete ${r.s.name}`} className="inline-flex items-center justify-center w-6 h-6 rounded text-textMuted hover:text-bear hover:bg-ink/[0.06] transition-colors" data-session-delete={r.s.id}>
              <Trash2 className="w-3 h-3" />
            </button>
          </span>
        ),
      },
    ],
    [navigate]
  );

  const nameWords = (t: string) => reviewName(t).name;
  return (
    <TraceBox
      title="Your sessions"
      sub="A session replays one name, or two — its option chain as it stood — from a day you pick · the clock only moves forward · every fill is kept"
      testId="review-sessions"
      data={{ sessions: sessions.length }}
      facts={
        <>
          <Fact label="Sessions">{sessions.length}</Fact>
          <Fact label="Closed trades">{totals.trades}</Fact>
          <Fact label="All sessions, up or down">
            <span className={dirInk(totals.net)}>{usdSigned(totals.net)}</span>
          </Fact>
        </>
      }
      controls={
        <>
          <DropdownSearch label="Name" value={ticker} options={NAME_OPTIONS} onChange={setTicker} title="The name this session trades" placeholder="Search a ticker or a company…" testId="review-name" />
          {adding || second ? (
            <span className="inline-flex items-center gap-0.5">
              <DropdownSearch label="And" value={second === ticker ? '' : second} options={NAME_OPTIONS.filter(o => o.value !== ticker)} onChange={setSecond} title="A second one on the same clock and the same account — two at most" placeholder="Search a ticker or a company…" testId="review-name-2" defaultOpen={!second} />
              <button
                type="button"
                onClick={() => {
                  setSecond('');
                  setAdding(false);
                }}
                title="One name after all"
                aria-label="Take the second name away"
                className="inline-flex items-center justify-center w-6 h-7 rounded-md text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] transition-colors"
                data-review-name-2-off
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setAdding(true)} title="Optional — trade two names on the same clock and the same account" className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-dashed border-borderMuted font-mono text-[10px] text-textMuted hover:text-textPrimary hover:border-textSecondary transition-colors" data-review-name-2-add>
              <Plus className="w-3 h-3" /> A second name
            </button>
          )}
          <DropdownSelect label="Start with" value={cash} options={CASH} onChange={setCash} title="The paper money the session starts with" testId="review-cash" />
          <DayCard label="From" value={startDay} onChange={setStartDay} title="The day the clock starts on" testId="review-start" />
          <DropdownSelect label="Fee" value={fee} options={FEES} onChange={setFee} title="What each contract costs to trade, each way" testId="review-fee" />
          {/* YOUR RULES — hard blocks, chosen here and nowhere else */}
          <DropdownSelect label="Open at once" value={maxOpen} options={OPEN_RULES} onChange={setMaxOpen} title="Your rule: how many positions may be open at once — a buy past it is refused" testId="review-rule-open" />
          <DropdownSelect label="A trade may cost" value={maxRisk} options={RISK_RULES} onChange={setMaxRisk} title="Your rule: the most one trade may cost, as a share of what the account is worth" testId="review-rule-risk" />
          <DropdownSelect label="Stop the day at" value={dayStop} options={DAY_RULES} onChange={setDayStop} title="Your rule: down this much since the open, the day is over — no new positions until the next one" testId="review-rule-day" />
          <button type="button" onClick={start} className="inline-flex items-center gap-1.5 h-7 px-3.5 rounded-full text-[11px] font-semibold transition-opacity hover:opacity-90" style={{ background: SILVER_FILL, color: '#0a0a0a' }} data-review-start>
            <Play className="w-3 h-3" /> Start the session
          </button>
        </>
      }
      sentence={
        <>
          A new session opens <span className="text-textPrimary font-semibold">{tickers.map(nameWords).join(' and ')}</span>
          {tickers.length > 1 ? ' on one clock and one account,' : ''} at the bell of <span className="text-textPrimary font-semibold">{dayWords(startDay, true)}</span> with <span className="text-textPrimary font-semibold">{usd(cash, 0)}</span>.{' '}
          You play the day forward, pick a contract off the chain as it stood, and trade it at its real bid and ask — long calls and puts, paid in cash.{' '}
          {ruleWords.length > 0 ? (
            <>
              Your rules: <span className="text-textPrimary font-semibold">{ruleWords.join(' · ')}</span>. A buy that breaks one is refused, a way out never is — and they cannot be changed once the session starts.
            </>
          ) : (
            'No rules of your own on this one: set them in the three cards at the right, before it starts — they cannot be added later.'
          )}
        </>
      }
    >
      <TraceGrid rows={rows} columns={columns} rowKey={r => r.s.id} onRowClick={r => navigate(`/practice/backtest/${r.s.id}`)} autoHeight animate={false} noun="sessions" widths={{ doors: 176, start: 120, equity: 130, net: 130, trades: 120, win: 80, open: 80 }} emptyText="No sessions yet — start one above" testId="review-sessions" />
    </TraceBox>
  );
};

export default Sessions;
