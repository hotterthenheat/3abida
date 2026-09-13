/*
==================================================
  SLAYER TERMINAL - THE MONTH
  (components/record/NewsCalendar.tsx)

  The Day's calendar as a month (Noah, 2026-09-13,
  with the photo of a month view: "you should also
  have a calendar that looks like this, now with
  this UI but the same concept, so people can
  change the days and see what's coming up").

  Left, the month: Sunday to Saturday, every day a
  cell, the prints on it as pills — the macro
  releases in their impact's ink, the earnings as
  the name with its mark — three to a cell and the
  rest counted. Right, the day in hand: everything
  on it in order, with the figures. Arrows walk the
  months; Today comes home; a click on a day opens
  it. The data is data/monthCalendar.ts.
==================================================
*/

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { now } from '../../core/clock';
import { buildMonthCalendar, dayKeyOf, type CalDay, type CalEvent, type CalKind } from '../../data/monthCalendar';
import CardTabs from '../ui/CardTabs';
import CompanyLogo from '../ui/CompanyLogo';
import { Name } from '../ui/Name';
import { SUPREME } from '../gex/paletteInk';
import { IMPACT_INK, ImpactLegend, ImpactMark } from './impactMark';

const SILVER = 'rgb(var(--silver))';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
type KindPick = 'all' | CalKind;
const KIND_OPTIONS = [
  { value: 'all', label: 'Everything' },
  { value: 'macro', label: 'Data' },
  { value: 'earnings', label: 'Earnings' },
] as const;

/** A pill's ink: the print's impact, the name's silver, the market's own magenta */
const inkOf = (e: CalEvent) => (e.kind === 'earnings' ? SILVER : e.kind === 'market' ? SUPREME : IMPACT_INK[e.impact]);
const longDay = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

const Pill = ({ e, onOpen }: { e: CalEvent; onOpen: () => void }) => {
  const ink = inkOf(e);
  return (
    <button
      type="button"
      onClick={ev => {
        ev.stopPropagation();
        onOpen();
      }}
      className="w-full flex items-center gap-1 h-[18px] px-1.5 rounded-[3px] text-left font-mono text-[9.5px] font-semibold whitespace-nowrap overflow-hidden transition-colors hover:brightness-110"
      style={{ background: `${ink}22`, color: ink, boxShadow: `inset 2px 0 0 0 ${ink}` }}
      title={e.kind === 'earnings' ? `${e.ticker} reports ${e.time}${e.impliedMovePct ? ` · ±${e.impliedMovePct.toFixed(1)}% priced` : ''}` : `${e.time} · ${e.title}${e.forecast ? ` · fcst ${e.forecast}` : ''}`}
      data-cal-pill={e.id}
    >
      {e.kind === 'earnings' && e.ticker ? (
        <>
          <CompanyLogo ticker={e.ticker} size={10} />
          <span className="truncate">{e.ticker}</span>
          <span className="ml-auto text-[8px] font-normal opacity-80">{e.slot}</span>
        </>
      ) : (
        <>
          <span className="truncate">{e.title}</span>
          <span className="ml-auto text-[8px] font-normal opacity-80">{e.time}</span>
        </>
      )}
    </button>
  );
};

const NewsCalendar = () => {
  const today = useMemo(() => now(), []);
  const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [kind, setKind] = useState<KindPick>('all');
  const cal = useMemo(() => buildMonthCalendar(ym.y, ym.m), [ym]);
  const [pickedKey, setPickedKey] = useState(dayKeyOf(today));
  const days = useMemo(() => cal.weeks.flat(), [cal]);
  const picked: CalDay = days.find(d => d.key === pickedKey) ?? days.find(d => d.today) ?? days.find(d => d.inMonth)!;
  const keep = (e: CalEvent) => kind === 'all' || (kind === 'macro' ? e.kind !== 'earnings' : e.kind === 'earnings');
  const shift = (by: number) => {
    const d = new Date(ym.y, ym.m + by, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() });
    setPickedKey(dayKeyOf(sameMonth(d, today) ? today : d));
  };
  const home = () => {
    setYm({ y: today.getFullYear(), m: today.getMonth() });
    setPickedKey(dayKeyOf(today));
  };
  const highCount = cal.events.filter(e => e.impact === 'high' && e.kind !== 'earnings').length;
  const erCount = cal.events.filter(e => e.kind === 'earnings').length;
  const dayEvents = picked.events.filter(keep);

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 340px' }} data-news-calendar data-month={`${ym.y}-${ym.m + 1}`}>
      {/* THE MONTH */}
      <div className="min-w-0 border-r border-borderSubtle">
        <div className="px-4 h-[40px] flex items-center gap-2 border-b border-borderSubtle">
          <button type="button" onClick={() => shift(-1)} className="inline-flex items-center justify-center w-6 h-6 rounded text-textSecondary hover:text-textPrimary hover:bg-ink/[0.06] transition-colors" title="The month before" aria-label="The month before" data-cal-prev>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => shift(1)} className="inline-flex items-center justify-center w-6 h-6 rounded text-textSecondary hover:text-textPrimary hover:bg-ink/[0.06] transition-colors" title="The month after" aria-label="The month after" data-cal-next>
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-[14px] font-semibold text-textPrimary" data-cal-label>
            {cal.label}
          </span>
          <button type="button" onClick={home} className="inline-flex items-center h-6 px-2 rounded-md border border-borderSubtle bg-chip hover:border-borderMuted font-mono text-[9px] uppercase tracking-widest text-textSecondary hover:text-textPrimary transition-colors" data-cal-today>
            Today
          </button>
          <span className="font-mono text-[10px] tnum text-textSecondary ml-2">
            {highCount} high-impact prints · {erCount} reports
          </span>
          <span className="ml-auto inline-flex items-center gap-4">
            <ImpactLegend />
            <CardTabs options={KIND_OPTIONS} value={kind} onChange={setKind} ariaLabel="What the calendar shows" />
          </span>
        </div>
        <div className="grid grid-cols-7 border-b border-borderSubtle/60">
          {WEEKDAYS.map(w => (
            <div key={w} className="px-2 h-[22px] flex items-center font-mono text-[9px] uppercase tracking-widest text-textSecondary">
              {w}
            </div>
          ))}
        </div>
        {cal.weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-borderSubtle/40 last:border-b-0">
            {week.map(day => {
              const events = day.events.filter(keep);
              const isPicked = day.key === picked.key;
              return (
                <div
                  role="button"
                  tabIndex={0}
                  key={day.key}
                  onClick={() => setPickedKey(day.key)}
                  onKeyDown={ev => {
                    if (ev.key === 'Enter' || ev.key === ' ') setPickedKey(day.key);
                  }}
                  className={`relative min-h-[96px] cursor-pointer px-1.5 pt-1 pb-1.5 text-left border-r border-borderSubtle/40 last:border-r-0 flex flex-col gap-[3px] transition-colors ${isPicked ? 'bg-silver/[0.07]' : 'hover:bg-ink/[0.03]'} ${!day.inMonth ? 'opacity-45' : ''} ${day.weekend && day.inMonth ? 'bg-ink/[0.015]' : ''}`}
                  data-cal-day={day.key}
                  data-picked={isPicked || undefined}
                  aria-pressed={isPicked}
                >
                  <span className={`self-start inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full font-mono text-[11px] tnum ${day.today ? 'bg-[#ededed] text-[#0a0a0a] font-bold' : 'text-textPrimary'}`}>{day.date.getDate()}</span>
                  {events.slice(0, 3).map(e => (
                    <Pill key={e.id} e={e} onOpen={() => setPickedKey(day.key)} />
                  ))}
                  {events.length > 3 && <span className="font-mono text-[9px] text-textSecondary pl-1">{events.length - 3} more</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* THE DAY IN HAND */}
      <div className="min-w-0 flex flex-col" data-cal-day-panel={picked.key}>
        <div className="px-4 h-[40px] flex items-center gap-2 border-b border-borderSubtle">
          <span className="text-[13px] font-semibold text-textPrimary">{longDay(picked.date)}</span>
          {picked.today && <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-select">today</span>}
          <span className="ml-auto font-mono text-[10px] tnum text-textSecondary">
            {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
          </span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto max-h-[560px]">
          {dayEvents.length === 0 ? (
            <div className="px-4 py-8 text-center font-mono text-[10px] uppercase tracking-widest text-textSecondary">Nothing on the record for this day</div>
          ) : (
            dayEvents.map(e => (
              <div key={e.id} className="px-4 py-2 border-b border-borderSubtle/40" data-cal-event={e.id} data-kind={e.kind}>
                <div className="flex items-center gap-2">
                  {e.kind === 'earnings' ? <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: SILVER }} /> : e.kind === 'market' ? <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: SUPREME }} /> : <ImpactMark tier={e.impact} />}
                  <span className="font-mono text-[10px] tnum text-textSecondary w-[54px] shrink-0">{e.kind === 'earnings' ? (e.slot === 'BMO' ? 'pre' : 'post') : e.time}</span>
                  {e.kind === 'earnings' && e.ticker ? (
                    <span className="min-w-0 flex items-center gap-1.5 text-[12px] text-textPrimary">
                      <Name t={e.ticker} size={14} className="font-mono font-bold" /> reports {e.time}
                    </span>
                  ) : (
                    <span className={`min-w-0 truncate text-[12px] text-textPrimary ${e.impact === 'high' ? 'font-semibold' : ''}`}>{e.title}</span>
                  )}
                  {e.region && <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-textSecondary">{e.region}</span>}
                </div>
                <div className="mt-1 pl-[72px] flex items-center gap-x-4 font-mono text-[10px] tnum text-textPrimary">
                  {e.kind === 'earnings' ? (
                    <>
                      {e.impliedMovePct != null && <span>±{e.impliedMovePct.toFixed(1)}% priced for the print</span>}
                      <span className="text-textSecondary">{e.confirmed ? 'date confirmed' : 'analyst estimate'}</span>
                    </>
                  ) : (
                    <>
                      {e.forecast && (
                        <span>
                          <span className="text-textSecondary">fcst</span> {e.forecast}
                        </span>
                      )}
                      {e.previous && (
                        <span>
                          <span className="text-textSecondary">prev</span> {e.previous}
                        </span>
                      )}
                      {!e.forecast && !e.previous && <span className="text-textSecondary">{e.kind === 'market' ? 'the market’s own date' : 'no figure — words, not a number'}</span>}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

export default NewsCalendar;
