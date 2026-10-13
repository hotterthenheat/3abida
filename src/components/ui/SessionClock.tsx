/*
==================================================
  SLAYER TERMINAL - THE SESSION CLOCK
  (components/ui/SessionClock.tsx)

  The lucide Clock icon, except that it runs (Noah,
  2026-09-09, on the shell's facts: "maybe a moving
  icon clock next to the 'to the close'"). The same
  24-unit face every icon on the terminal wears —
  a 2px circle in the current ink, round caps — with
  the hour and minute hands on the reader's clock
  (2026-10-13 — every time on screen is the
  reader's own; the session it names is New York's) and a
  hairline second hand sweeping once a minute on the
  compositor, phased to the real second at mount.
  Nothing else: the first cut had a lime hand and a
  session ring round the face and Noah called it
  off ("doesnt fit the design style we have"). Under
  reduced motion the second hand holds at the second
  the clock last read.
==================================================
*/

import { useEffect, useRef, useState } from 'react';
import { readSessionClock, type SessionClock as Session } from '../../data/sessionClock';
import { nyTextClock } from '../../core/nyTime';

/** Hours, minutes and seconds the hands show — the reader's own clock, read when the session is (the face is a picture
    of a time, so it is the reader's, as every printed time is) */
const parts = (_s: Session) => {
  const d = new Date();
  return { h: d.getHours(), m: d.getMinutes(), sec: d.getSeconds() };
};

const SessionClock = ({ size = 14, className = '' }: { size?: number; className?: string }) => {
  const [session, setSession] = useState(() => readSessionClock());
  /* The hands re-read every 15s (the minute hand glides between); the second
     hand is one CSS sweep phased ONCE, at mount — re-phasing it would restart
     the animation and make it jump */
  const phase = useRef(-parts(session).sec);
  useEffect(() => {
    const id = window.setInterval(() => setSession(readSessionClock()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  const { h, m, sec } = parts(session);
  const hourDeg = ((h % 12) + m / 60) * 30;
  const minuteDeg = (m + sec / 60) * 6;
  const hand = (deg: number) => ({ transform: `rotate(${deg}deg)`, transformOrigin: '12px 12px', transformBox: 'view-box' as const, transition: 'transform 600ms cubic-bezier(0.16, 1, 0.3, 1)' });

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      role="img"
      aria-label={`${session.label} · ${nyTextClock(session.etTime, undefined, { zone: true })}`}
      data-session-clock
    >
      <circle cx="12" cy="12" r="10" />
      <g style={hand(hourDeg)} data-hand="hour">
        <line x1="12" y1="12" x2="12" y2="7.5" />
      </g>
      <g style={hand(minuteDeg)} data-hand="minute">
        <line x1="12" y1="12" x2="12" y2="5.5" />
      </g>
      <g className="animate-clock-sweep" style={{ animationDelay: `${phase.current}s`, transformOrigin: '12px 12px', transformBox: 'view-box', ['--clock-sec' as string]: `${sec * 6}deg` }} data-hand="second">
        <line x1="12" y1="13.5" x2="12" y2="4.5" strokeWidth={1} strokeOpacity={0.55} />
      </g>
    </svg>
  );
};

export default SessionClock;
