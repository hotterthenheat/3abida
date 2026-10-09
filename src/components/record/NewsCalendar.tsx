/*
==================================================
  SLAYER TERMINAL - THE MONTH
  (components/record/NewsCalendar.tsx)

  The Day's calendar as a month — the partner's,
  ported 2026-09-13 (Noah, with his screenshot: "i
  love it. i want that as well but it needs to
  match our type design and our already existing
  code").

  Left, the month: Sunday to Saturday, every day a
  cell, what prints on it as pills — the macro
  releases in their impact's ink, the earnings as
  the name with its slot in silver, the market's
  own dates in magenta — three to a cell and the
  rest counted. Right, the day in hand: everything
  on it in order, with the figures. Arrows walk the
  months; Today comes home; a click on a day opens
  it. The data is data/monthCalendar.ts.

  The house's inks, not the partner's: the pills'
  washes go through `alpha` (a token ink cannot
  take a hex suffix — the theme memory's trap), the
  picked day wears the silver edge every open row
  wears, today's number sits in the primary ink's
  round, and it all holds on the light terminal.
==================================================
*/

import { useMemo, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { now } from '../../core/clock';
import { buildMonthCalendar, dayKeyOf, type CalDay, type CalEvent, type CalKind } from '../../data/monthCalendar';
import CardTabs from '../ui/CardTabs';
import CompanyLogo from '../ui/CompanyLogo';
import { SUPREME, alpha } from '../gex/paletteInk';
import { IMPACT_INK, ImpactLegend, ImpactMark } from './impactMark';

const SILVER = 'rgb(var(--silver))'; /* the silver token as an ink — deep steel on the light terminal */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
type KindPick = 'all' | CalKind;
const KIND_OPTIONS = [
  { value: 'all', label: 'Everything' },
  { value: 'macro', label: 'Data' },
  { value: 'earnings', label: 'Earnings' },
] as const;
/** The day panel's width, and a cell's height at rest */
export const CAL_DAY_W = 340;
export const CAL_CELL_H = 96;

/** A pill's ink: the print's impact, the name's silver, the market's own magenta */
const inkOf = (e: CalEvent) => (e.kind === 'earnings' ? SILVER : e.kind === 'market' ? SUPREME : IMPACT_INK[e.impact]);
const longDay = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

const Pill = ({ e, onOpen }: { e: CalEvent; onOpen: () => void }) => {
  const ink = inkOf(e);
  return (
    <button
      type="button"
      onClick={ev => {
        ev.stopPropagation();
        onOpen();
      }}
      className="w-full flex items-center gap-1 h-[18px] px-1.5 rounded-[3px] text-left font-mono text-[10px] font-semibold whitespace-nowrap overflow-hidden transition-[filter] hover:brightness-110"
      style={{ background: alpha(ink, 0.13), color: ink, boxShadow: `inset 2px 0 0 0 ${ink}` }}
      title={e.kind === 'earnings' ? `${e.ticker} reports ${e.time}${e.impliedMovePct ? ` · ±${e.impliedMovePct.toFixed(1)}% priced` : ''}` : `${e.time} · ${e.title}${e.forecast ? ` · fcst ${e.forecast}` : ''}`}
      data-cal-pill={e.id}
      data-kind={e.kind}
    >
      {e.kind === 'earnings' && e.ticker ? (
        <>
          <CompanyLogo ticker={e.ticker} size={10} />
          <span className="truncate">{e.ticker}</span>
          <span className="ml-auto text-[10px] font-normal">{e.slot}</span>
        </>
      ) : (
        <>
          <span className="truncate">{e.title}</span>
          <span className="ml-auto text-[10px] font-normal">{e.time}</span>
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
  /* a month walked lands on today when it is that month, else on its first */
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

  /* The day beside the month from md; under it on a phone, where the head row wraps too (the phone pass, 2026-09-13) */
  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_var(--cal-day-w)]"
      style={{ '--cal-day-w': `${CAL_DAY_W}px` } as CSSProperties}
      data-news-calendar
      data-month={`${ym.y}-${ym.m + 1}`}
    >
      {/* THE MONTH */}
      <div className="min-w-0 border-r border-borderSubtle max-lg:border-r-0 max-lg:border-b">
        <div className="px-4 h-[40px] flex items-center gap-2 border-b border-borderSubtle max-lg:h-auto max-lg:py-2 max-lg:flex-wrap">
          <button type="button" onClick={() => shift(-1)} className="inline-flex items-center justify-center w-6 h-6 rounded text-textSecondary hover:text-textPrimary hover:bg-ink/[0.06] transition-colors" title="The month before" aria-label="The month before" data-cal-prev>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => shift(1)} className="inline-flex items-center justify-center w-6 h-6 rounded text-textSecondary hover:text-textPrimary hover:bg-ink/[0.06] transition-colors" title="The month after" aria-label="The month after" data-cal-next>
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-[14px] font-semibold text-textPrimary" data-cal-label>
            {cal.label}
          </span>
          <button type="button" onClick={home} className="inline-flex items-center h-6 px-2 rounded-md border border-borderSubtle bg-chip hover:border-borderMuted font-mono text-[10px] uppercase tracking-widest text-textSecondary hover:text-textPrimary transition-colors" data-cal-today>
            Today
          </button>
          <span className="font-mono text-[10px] tnum text-textSecondary ml-2" data-cal-counts>
            {highCount} high-impact prints · {erCount} reports
          </span>
          <span className="ml-auto inline-flex items-center gap-4 max-lg:ml-0 max-lg:flex-wrap max-lg:gap-y-1">
            <ImpactLegend />
            <CardTabs options={KIND_OPTIONS} value={kind} onChange={setKind} ariaLabel="What the calendar shows" />
          </span>
        </div>
        <div className="grid grid-cols-7 border-b border-borderSubtle/60">
          {WEEKDAYS.map(w => (
            <div key={w} className="px-2 h-[22px] flex items-center font-mono text-[10px] uppercase tracking-widest text-textMuted">
              {w}
            </div>
          ))}
        </div>
        {cal.weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-borderSubtle/40 last:border-b-0" data-cal-week={wi}>
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
                  className={`relative cursor-pointer px-1.5 pt-1 pb-1.5 text-left border-r border-borderSubtle/40 last:border-r-0 flex flex-col gap-[3px] transition-colors ${isPicked ? 'bg-silver/[0.06] shadow-[inset_2px_0_0_0_rgb(var(--silver)/0.7)]' : 'hover:bg-silver/[0.04]'} ${!day.inMonth ? 'opacity-45' : ''} ${day.weekend && day.inMonth && !isPicked ? 'bg-ink/[0.015]' : ''}`}
                  style={{ minHeight: CAL_CELL_H }}
                  data-cal-day={day.key}
                  data-picked={isPicked || undefined}
                  data-today={day.today || undefined}
                  aria-pressed={isPicked}
                >
                  <span className={`self-start inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full font-mono text-[11px] tnum ${day.today ? 'bg-textPrimary text-panel font-bold' : 'text-textPrimary'}`}>{day.date.getDate()}</span>
                  {events.slice(0, 3).map(e => (
                    <Pill key={e.id} e={e} onOpen={() => setPickedKey(day.key)} />
                  ))}
                  {events.length > 3 && <span className="font-mono text-[10px] text-textMuted pl-1">{events.length - 3} more</span>}
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
          {picked.today && <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-select">today</span>}
          <span className="ml-auto font-mono text-[10px] tnum text-textSecondary">
            {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
          </span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto max-h-[560px]">
          {dayEvents.length === 0 ? (
            <div className="px-4 py-8 text-center font-mono text-[10px] uppercase tracking-widest text-textMuted">Nothing on the record for this day</div>
          ) : (
            dayEvents.map(e => (
              <div key={e.id} className="px-4 py-2 border-b border-borderSubtle/40" data-cal-event={e.id} data-kind={e.kind}>
                <div className="flex items-center gap-2">
                  {e.kind === 'earnings' ? <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: SILVER }} /> : e.kind === 'market' ? <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: SUPREME }} /> : <ImpactMark tier={e.impact} />}
                  <span className="font-mono text-[10px] tnum text-textSecondary w-[54px] shrink-0">{e.kind === 'earnings' ? (e.slot === 'BMO' ? 'pre' : 'post') : e.time}</span>
                  {e.kind === 'earnings' && e.ticker ? (
                    <span className="min-w-0 flex items-center gap-1.5 text-[12px] text-textPrimary">
                      <CompanyLogo ticker={e.ticker} size={14} />
                      <span className="font-mono font-bold">{e.ticker}</span> reports {e.time}
                    </span>
                  ) : (
                    <span className={`min-w-0 truncate text-[12px] text-textPrimary ${e.impact === 'high' ? 'font-semibold' : ''}`}>{e.title}</span>
                  )}
                  {e.region && <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-textMuted">{e.region}</span>}
                </div>
                <div className="mt-1 pl-[72px] flex items-center gap-x-4 font-mono text-[10px] tnum text-textPrimary">
                  {e.kind === 'earnings' ? (
                    <>
                      {e.impliedMovePct != null && <span>±{e.impliedMovePct.toFixed(1)}% priced for the print</span>}
                      <span className="text-textMuted">{e.confirmed ? 'date confirmed' : 'analyst estimate'}</span>
                    </>
                  ) : (
                    <>
                      {e.forecast && (
                        <span>
                          <span className="text-textMuted">fcst</span> {e.forecast}
                        </span>
                      )}
                      {e.previous && (
                        <span>
                          <span className="text-textMuted">prev</span> {e.previous}
                        </span>
                      )}
                      {!e.forecast && !e.previous && <span className="text-textMuted">{e.kind === 'market' ? 'the market’s own date' : 'no figure — words, not a number'}</span>}
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

export default NewsCalendar;
