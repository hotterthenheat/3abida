/*
==================================================
  SLAYER TERMINAL - EARNINGS (pages/record/Earnings.tsx)

  Who reports when, and what the options charge for
  it — the calendar page under the Record, walked
  into the house grammar (2026-09-09; the old hub's
  composition strip, chip rows and hand-rolled table
  are gone). Two boxes, read top to bottom:

    WHO REPORTS   the head with four facts, one line
                  of cards (Week · Show · Layout),
                  the sentence, then the week as THE
                  BOARD of five days (the default since
                  2026-09-10, Noah) — every name a card
                  with our expected move on its shelf,
                  before the open or after the close —
                  or as a list of days: dates down the
                  left, every name a door, the macro
                  calendar beside them, today on the
                  silver rail. The fortnight ridge that
                  sat at the cards' right is gone the
                  same day ("glitchy and buggy … it
                  moves awfully weird and i dont even
                  know what it does"): its caption
                  changed width on every hover and
                  pushed the bars along, and the board
                  already shows the fortnight day by day.
    EVERY REPORT  the house grid: both weeks, every
                  figure the calendar carries, a row
                  opens the name's page

  The engine (data/earnings.ts) is untouched.
==================================================
*/

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moon, Sunrise } from 'lucide-react';
import { type ColDef, type ICellRendererParams, type RowClickedEvent } from 'ag-grid-community';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';
import { GRID_MODULES, GRID_THEME } from '../../components/ui/houseGrid';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import GuideFocus, { GuideDoor } from '../../components/ui/GuideFocus';
import CompanyLogo from '../../components/ui/CompanyLogo';
import { EarningsGuide } from '../../components/record/EarningsGuide';
import { stateOf, type VolState } from '../../components/earnings/volState';
import { buildEarningsCalendar, weekDayDate, weekDayLabel, type EarningsEvent } from '../../data/earnings';
import { macroWindow, type MacroDate } from '../../data/events';
import { Name } from '../../components/ui/Name';

type WeekPick = '0' | '1' | 'both';
type ShowPick = 'all' | VolState;
type Layout = 'list' | 'board';

const WEEK_OPTIONS: DropdownOption<WeekPick>[] = [
  { value: '0', label: 'This week', hint: 'Monday to Friday of the current week' },
  { value: '1', label: 'Next week', hint: 'The week after' },
  { value: 'both', label: 'Both weeks', hint: 'The whole fortnight, one week under the other' },
];
const SHOW_OPTIONS: DropdownOption<ShowPick>[] = [
  { value: 'all', label: 'Every report', hint: 'Whatever the options charge' },
  { value: 'RICH', label: 'Priced rich', hint: 'Options charge more than 1.3× what the name usually moves' },
  { value: 'INLINE', label: 'Priced fair', hint: 'The charge is close to the usual move' },
  { value: 'CHEAP', label: 'Priced cheap', hint: 'Options charge less than 0.85× the usual move' },
];
const LAYOUT_OPTIONS: DropdownOption<Layout>[] = [
  { value: 'board', label: 'Board', hint: 'Five days across, the names as cards' },
  { value: 'list', label: 'List', hint: 'Dates down the left, the names as doors' },
];

const WEEKDAYS = [1, 2, 3, 4, 5] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** The macro calendar's words on the list — the event, not the engine's label */
const MACRO_WORD: Record<string, string> = { 'FOMC decision': 'FOMC', 'NFP release': 'Payrolls', 'CPI release': 'CPI' };

/** The pricing in the page's words: how the options price sits against the usual move */
export const PRICED_WORD: Record<VolState, string> = { RICH: 'rich', INLINE: 'fair', CHEAP: 'cheap' };
export const PRICED_INK: Record<VolState, string> = { RICH: 'text-warn', INLINE: 'text-textPrimary', CHEAP: 'text-bull' };
export const slotWord = (e: EarningsEvent) => (e.slot === 'BMO' ? 'before the open' : 'after the close');

/** The slot as a mark: dawn amber before the open, the moon after the close */
export const SlotMark = ({ slot, className = 'w-3 h-3' }: { slot: EarningsEvent['slot']; className?: string }) =>
  slot === 'BMO' ? <Sunrise className={`${className} text-warn`} aria-label="before the open" /> : <Moon className={`${className} text-moon`} aria-label="after the close" />;

const Fact = ({ label, children, testId }: { label: string; children: React.ReactNode; testId?: string }) => (
  <div>
    <dt className="text-[10px] text-textMuted whitespace-nowrap">{label}</dt>
    <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-earnings-fact={testId}>
      {children}
    </dd>
  </div>
);

/* ---- the list's doors and chips ---------------------------------------------------- */

/** A name on the list: the mark, the ticker, our move, its slot, the company — one door to its page */
const NameDoor = ({ e, onOpen }: { e: EarningsEvent; onOpen: (t: string) => void }) => (
  <button
    type="button"
    onClick={() => onOpen(e.ticker)}
    title={`${e.name} — options price ±${e.impliedMovePct.toFixed(1)}%, ${slotWord(e)} · open its page`}
    className="group flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 hover:border-borderSubtle hover:bg-silver/[0.05] transition-colors text-left"
    data-earnings-door={e.ticker}
  >
    <CompanyLogo ticker={e.ticker} size={22} />
    <span className="flex flex-col leading-tight">
      <span className="flex items-center gap-1.5">
        <span className="font-mono text-[12px] font-bold text-textPrimary">{e.ticker}</span>
        <span className={`font-mono text-[11px] tnum ${PRICED_INK[stateOf(e)]}`}>±{e.impliedMovePct.toFixed(1)}%</span>
        <SlotMark slot={e.slot} />
      </span>
      <span className="text-[10px] text-textMuted truncate max-w-[180px]">{e.name}</span>
    </span>
  </button>
);

/** A macro date on the list — a quiet chip */
const MacroChip = ({ m }: { m: MacroDate }) => (
  <span title={m.detail} className="inline-flex items-center self-center h-6 rounded-md border border-borderSubtle bg-chip px-2 font-mono text-[9px] uppercase tracking-widest text-textSecondary whitespace-nowrap" data-earnings-macro>
    {MACRO_WORD[m.label] ?? m.label}
  </span>
);

/** The board's cell: the mark, the ticker, our move, whether the date is set */
const Card = ({ e, onOpen }: { e: EarningsEvent; onOpen: (t: string) => void }) => (
  <button
    type="button"
    onClick={() => onOpen(e.ticker)}
    title={`${e.name} — options price ±${e.impliedMovePct.toFixed(1)}%, ${slotWord(e)} · open its page`}
    className="group relative flex flex-col items-center gap-1.5 rounded-md border border-borderSubtle bg-chip px-2 pt-3 pb-2.5 transition-colors hover:border-borderMuted hover:bg-silver/[0.05]"
    data-earnings-card={e.ticker}
  >
    <CompanyLogo ticker={e.ticker} size={28} />
    <span className="font-mono text-[12px] font-bold text-textPrimary leading-none mt-0.5">{e.ticker}</span>
    <span className={`font-mono text-[11px] tnum leading-none ${PRICED_INK[stateOf(e)]}`}>±{e.impliedMovePct.toFixed(1)}%</span>
    <span className={`font-mono text-[8px] uppercase tracking-widest ${e.confirmed ? 'text-textMuted' : 'text-warn'}`}>{e.confirmed ? 'confirmed' : 'estimated'}</span>
  </button>
);

/* ---- the grid's cells --------------------------------------------------------------- */

const NameCell = ({ data }: ICellRendererParams<EarningsEvent>) =>
  data ? (
    <span className="inline-flex items-center gap-2 min-w-0">
      <CompanyLogo ticker={data.ticker} size={16} />
      <span className="flex flex-col leading-tight min-w-0">
        <span className="font-mono text-[12px] font-bold text-textPrimary">{data.ticker}</span>
        <span className="text-[10px] text-textMuted truncate">{data.name}</span>
      </span>
    </span>
  ) : null;

const WhenCell = ({ data }: ICellRendererParams<EarningsEvent>) =>
  data ? (
    <span className="flex flex-col leading-tight">
      <span className="font-mono text-[11px] tnum text-textPrimary">
        {data.dateLabel} <span className="text-textMuted">· {data.daysOut === 0 ? 'today' : `in ${data.daysOut}d`}</span>
      </span>
      <span className="inline-flex items-center gap-1.5 text-[10px]">
        <SlotMark slot={data.slot} className="w-2.5 h-2.5" />
        <span className="text-textSecondary">{slotWord(data)}</span>
        <span className={`font-mono text-[8px] uppercase tracking-widest ${data.confirmed ? 'text-textMuted' : 'text-warn'}`}>{data.confirmed ? 'confirmed' : 'estimated'}</span>
      </span>
    </span>
  ) : null;

const MoveCell = ({ data }: ICellRendererParams<EarningsEvent>) => (data ? <span className="font-mono text-[11px] tnum font-semibold text-textPrimary">±{data.impliedMovePct.toFixed(1)}%</span> : null);
const UsualCell = ({ data }: ICellRendererParams<EarningsEvent>) => (data ? <span className="font-mono text-[11px] tnum text-textSecondary">±{data.histAvgMovePct.toFixed(1)}%</span> : null);
const PricedCell = ({ data }: ICellRendererParams<EarningsEvent>) => {
  if (!data) return null;
  const s = stateOf(data);
  return (
    <span className={`font-mono text-[11px] tnum ${PRICED_INK[s]}`}>
      {data.richness.toFixed(2)}× <span className="text-[9px] uppercase tracking-widest">{PRICED_WORD[s]}</span>
    </span>
  );
};
const BeatCell = ({ data }: ICellRendererParams<EarningsEvent>) => (data ? <span className="font-mono text-[11px] tnum text-textPrimary">{Math.round((data.beatRate8q / 100) * 8)} of 8</span> : null);
const EstCell = ({ data }: ICellRendererParams<EarningsEvent>) =>
  data ? (
    <span className={`font-mono text-[11px] ${data.revisionTrend > 0.15 ? 'text-bull' : data.revisionTrend < -0.15 ? 'text-bear' : 'text-textMuted'}`}>
      {data.revisionTrend > 0.15 ? 'rising' : data.revisionTrend < -0.15 ? 'falling' : 'flat'}
    </span>
  ) : null;
const IvCell = ({ data }: ICellRendererParams<EarningsEvent>) => (data ? <span className={`font-mono text-[11px] tnum ${data.ivRank >= 80 ? 'text-warn' : 'text-textPrimary'}`}>{data.ivRank}</span> : null);

/* ---- the page ----------------------------------------------------------------------- */

const Earnings = () => {
  const navigate = useNavigate();
  const events = useMemo(() => buildEarningsCalendar(), []);
  const macro = useMemo(() => macroWindow(new Date(), 10, 20), []);
  const [week, setWeek] = useState<WeekPick>('0');
  const [show, setShow] = useState<ShowPick>('all');
  const [layout, setLayout] = useState<Layout>('board');
  const [guideOpen, setGuideOpen] = useState(false);

  const shown = useMemo(() => (show === 'all' ? events : events.filter(e => stateOf(e) === show)), [events, show]);
  const rich = events.filter(e => stateOf(e) === 'RICH').length;
  const cheap = events.filter(e => stateOf(e) === 'CHEAP').length;
  const fair = events.length - rich - cheap;
  const biggest = events.reduce<EarningsEvent | null>((a, e) => (a === null || e.impliedMovePct > a.impliedMovePct ? e : a), null);
  const today = events.filter(e => e.daysOut === 0);

  const weeks: (0 | 1)[] = week === 'both' ? [0, 1] : [Number(week) as 0 | 1];
  const open = (t: string) => navigate(`/record/earnings/${t}`);

  const sentence = useMemo(() => {
    const parts = [`${events.length} reports over two weeks`, `${rich} priced rich, ${fair} fair, ${cheap} cheap`];
    if (biggest) parts.push(`the biggest move priced is ${biggest.ticker} at ±${biggest.impliedMovePct.toFixed(1)}% on ${biggest.dateLabel}`);
    parts.push(today.length ? `today: ${today.map(e => `${e.ticker} ${slotWord(e)}`).join(', ')}` : 'nothing reports today');
    return parts.join(' · ') + '.';
  }, [events.length, rich, fair, cheap, biggest, today]);

  const columnDefs = useMemo<ColDef<EarningsEvent>[]>(
    () => [
      { headerName: 'Name', field: 'ticker', flex: 1.3, minWidth: 180, cellRenderer: NameCell, headerTooltip: 'The company — click the row to open its page' },
      { headerName: 'Reports', field: 'daysOut', width: 210, cellRenderer: WhenCell, sort: 'asc', headerTooltip: 'The date, before the open or after the close, and whether the company has confirmed it or it is still an estimate' },
      { headerName: 'Options price', field: 'impliedMovePct', width: 124, cellRenderer: MoveCell, type: 'rightAligned', headerTooltip: 'The move the options charge for the print — the at-the-money straddle as a percent of the stock' },
      { headerName: 'Usually moves', field: 'histAvgMovePct', width: 124, cellRenderer: UsualCell, type: 'rightAligned', headerTooltip: 'The average move on the last eight prints' },
      { headerName: 'Priced', field: 'richness', width: 124, cellRenderer: PricedCell, type: 'rightAligned', headerTooltip: 'The options price over the usual move — rich above 1.3×, cheap below 0.85×, fair between' },
      { headerName: 'Beat', field: 'beatRate8q', width: 96, cellRenderer: BeatCell, type: 'rightAligned', headerTooltip: 'How many of the last eight quarters beat the estimate' },
      { headerName: 'Estimates', field: 'revisionTrend', width: 104, cellRenderer: EstCell, headerTooltip: 'Which way analyst estimates have drifted into the print' },
      { headerName: 'IV rank', field: 'ivRank', width: 92, cellRenderer: IvCell, type: 'rightAligned', headerTooltip: 'Where implied volatility sits against its own past year, 0 to 100 — 80 and up is dear' },
    ],
    []
  );
  const defaultColDef = useMemo<ColDef<EarningsEvent>>(() => ({ sortable: true, resizable: true, suppressMovable: true }), []);
  const onRow = (e: RowClickedEvent<EarningsEvent>) => {
    if (e.data) open(e.data.ticker);
  };

  return (
    <>
      {/* BOX 1 — WHO REPORTS */}
      <div className="relative border border-borderSubtle rounded-md bg-panel" data-earnings data-week={week} data-show={show} data-layout={layout}>
        <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read the calendar" testId="earnings-guide" viewport>
          <EarningsGuide />
        </GuideFocus>
        {/* THE HEAD */}
        <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="h-6 flex items-center gap-3">
              <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">Who reports</h3>
              <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the doors, the price and the words mean" testId="earnings-guide" />
            </div>
            <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">The fortnight's reports · the figure on every name is the move its options charge · click a name for its page</p>
          </div>
          <dl className="grid grid-cols-4 gap-x-6">
            <Fact label="Reports" testId="reports">
              {events.length} <span className="text-textMuted">· two weeks</span>
            </Fact>
            <Fact label="Priced" testId="priced">
              <span className="text-warn">{rich} rich</span> <span className="text-textMuted">·</span> {fair} fair <span className="text-textMuted">·</span> <span className="text-bull">{cheap} cheap</span>
            </Fact>
            <Fact label="Biggest move" testId="biggest">
              {biggest ? (
                <>
                  <Name t={biggest.ticker} size={12} /> ±{biggest.impliedMovePct.toFixed(1)}% <span className="text-textMuted">· {biggest.dateLabel}</span>
                </>
              ) : (
                <span className="text-textMuted">—</span>
              )}
            </Fact>
            <Fact label="Today" testId="today">
              {today.length ? (
                today.map((e, i) => (
                  <span key={e.ticker}>
                    {i > 0 && <span className="text-textMuted"> · </span>}
                    <Name t={e.ticker} size={11} /> <span className="text-textMuted">{slotWord(e)}</span>
                  </span>
                ))
              ) : (
                <span className="text-textMuted">nothing reports</span>
              )}
            </Fact>
          </dl>
        </div>
        {/* THE ONE LINE OF CONTROLS */}
        <div className="px-5 pb-2 flex items-center gap-2 flex-wrap" data-earnings-controls>
          <DropdownSelect label="Week" value={week} options={WEEK_OPTIONS} onChange={setWeek} title="Which week" testId="earnings-week" />
          <DropdownSelect label="Show" value={show} options={SHOW_OPTIONS} onChange={setShow} title="How the options price sits" testId="earnings-show" />
          <DropdownSelect label="Layout" value={layout} options={LAYOUT_OPTIONS} onChange={setLayout} title="The week as a board or a list" testId="earnings-layout" />
        </div>
        <p className="px-5 pb-3 text-[12px] leading-relaxed text-textSecondary" data-earnings-sentence>
          {sentence}
        </p>

        {/* THE WEEK — the board, or a list of days */}
        {layout === 'list' ? (
          <div key={`list-${week}-${show}`} className="border-t border-borderSubtle animate-soft-in" data-earnings-list>
            {weeks.map(weekIdx =>
              WEEKDAYS.map(wd => {
                const date = weekDayDate(weekIdx, wd);
                const { isToday } = weekDayLabel(weekIdx, wd);
                const iso = isoOf(date);
                const dayEvents = shown.filter(e => e.weekIdx === weekIdx && e.weekday === wd).sort((a, b) => (a.slot === b.slot ? b.impliedMovePct - a.impliedMovePct : a.slot === 'BMO' ? -1 : 1));
                const dayMacro = macro.filter(m => m.iso === iso);
                const past = !isToday && date.getTime() < new Date().setHours(0, 0, 0, 0);
                return (
                  <div
                    key={`${weekIdx}-${wd}`}
                    className={`flex items-stretch border-b border-borderSubtle/60 last:border-0 min-h-[58px] ${isToday ? 'bg-silver/[0.04] shadow-[inset_2px_0_0_0_rgba(199,211,232,0.7)]' : ''} ${past ? 'opacity-50' : ''}`}
                    data-earnings-day={iso}
                    data-today={isToday || undefined}
                  >
                    <div className="w-28 shrink-0 px-5 py-3 border-r border-borderSubtle/60 flex flex-col justify-center">
                      <span className={`font-mono text-[14px] font-bold leading-none tnum ${isToday ? 'text-silver' : 'text-textPrimary'}`}>
                        {MONTHS[date.getMonth()]} {date.getDate()}
                      </span>
                      <span className={`mt-1 font-mono text-[9px] uppercase tracking-widest ${isToday ? 'text-silver' : 'text-textMuted'}`}>{isToday ? 'today' : DAYS[date.getDay()]}</span>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5">
                      {dayEvents.map(e => (
                        <NameDoor key={e.ticker} e={e} onOpen={open} />
                      ))}
                      {dayMacro.map(m => (
                        <MacroChip key={m.iso + m.label} m={m} />
                      ))}
                      {dayEvents.length === 0 && dayMacro.length === 0 && <span className="px-2 font-mono text-[9px] uppercase tracking-widest text-textMuted">{show === 'all' ? 'nothing on the calendar' : 'none priced this way'}</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div key={`board-${week}-${show}`} className="border-t border-borderSubtle animate-soft-in" data-earnings-board>
            {weeks.map(weekIdx => (
              <div key={weekIdx} className="grid grid-cols-5 gap-px bg-borderSubtle/60 border-b border-borderSubtle/60 last:border-0">
                {WEEKDAYS.map(wd => {
                  const { label, isToday } = weekDayLabel(weekIdx, wd);
                  const dayEvents = shown.filter(e => e.weekIdx === weekIdx && e.weekday === wd);
                  /* the macro calendar's dates under the day's head (2026-09-10 night: the list had them, the board did not) */
                  const dayMacro = macro.filter(m => m.iso === isoOf(weekDayDate(weekIdx, wd)));
                  const bmo = dayEvents.filter(e => e.slot === 'BMO');
                  const amc = dayEvents.filter(e => e.slot === 'AMC');
                  const shelf = (list: EarningsEvent[], slot: EarningsEvent['slot']) =>
                    list.length === 0 ? null : (
                      <div>
                        <span className="flex items-center gap-1.5 px-1 font-mono text-[9px] uppercase tracking-widest text-textMuted">
                          <SlotMark slot={slot} className="w-2.5 h-2.5" /> {slot === 'BMO' ? 'before the open' : 'after the close'}
                        </span>
                        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                          {list.map(e => (
                            <Card key={e.ticker} e={e} onOpen={open} />
                          ))}
                        </div>
                      </div>
                    );
                  return (
                    <div key={wd} className={`bg-panel px-3 py-3 min-h-[176px] ${isToday ? 'bg-silver/[0.04]' : ''}`} data-earnings-board-day={label} data-today={isToday || undefined}>
                      <div className="flex items-center justify-between">
                        <span className={`font-mono text-[11px] font-bold tnum ${isToday ? 'text-silver' : 'text-textPrimary'}`}>{label}</span>
                        {isToday && <span className="font-mono text-[8px] uppercase tracking-widest text-silver">today</span>}
                      </div>
                      <span className={`block h-px mt-1.5 ${isToday ? 'bg-silver' : 'bg-borderSubtle'}`} />
                      {dayMacro.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5" data-earnings-board-macro>
                          {dayMacro.map(m => (
                            <MacroChip key={m.iso + m.label} m={m} />
                          ))}
                        </div>
                      )}
                      {dayEvents.length === 0 ? (
                        dayMacro.length === 0 && <div className="mt-7 text-center font-mono text-[9px] uppercase tracking-widest text-textMuted">{show === 'all' ? 'no reports' : 'none priced this way'}</div>
                      ) : (
                        <div className="mt-2.5 flex flex-col gap-3">
                          {shelf(bmo, 'BMO')}
                          {shelf(amc, 'AMC')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BOX 2 — EVERY REPORT, the house grid */}
      <div className="border border-borderSubtle rounded-md overflow-hidden bg-panel" data-earnings-grid>
        <div className="px-5 pt-4 pb-3">
          <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">Every report</h3>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">
            Both weeks · {show === 'all' ? 'every report' : `the reports priced ${PRICED_WORD[show]}`} · soonest first · click a row for the name's page
          </p>
        </div>
        <div className="slayer-board border-t border-borderSubtle">
          <AgGridProvider modules={GRID_MODULES}>
            <AgGridReact<EarningsEvent>
              theme={GRID_THEME}
              domLayout="autoHeight"
              rowData={shown}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              getRowId={p => p.data.ticker}
              onRowClicked={onRow}
              rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: true }}
              suppressCellFocus
              animateRows
              tooltipShowDelay={350}
              tooltipHideDelay={8000}
            />
          </AgGridProvider>
        </div>
      </div>
    </>
  );
};

export default Earnings;
