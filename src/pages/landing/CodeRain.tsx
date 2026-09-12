/*
==================================================
  SLAYER TERMINAL - CODE-RAIN (hero layer)
  Columns of Slayer terminal output drifting behind
  the hero copy, almost invisible, twinkling like
  distant stars. The cursor is a flashlight — a soft
  window follows the pointer and is the only place
  the code becomes legible; leave the hero and it
  eases shut. Background is transparent so the scene
  behind stays visible. Tints are decoration-tier
  (muted steel/moss) — never the semantic tokens, so
  the rain can't impersonate live data. Reduced
  motion freezes everything to a dim static field.
  DOM columns + a CSS mask — GPU-cheap.
==================================================
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import { RAIN_POOL, tintFor, type RainTint } from './rainPool';

interface Column {
  left: number; // %
  dur: number; // s (slow — the baseline should barely drift)
  delay: number; // s (negative — starts mid-cycle)
  up: boolean;
  lines: string[]; // one set; rendered twice for a seamless loop
}

const TINT_COLOR: Record<RainTint, string> = {
  struct: '#7E96B8', // dealer structure — muted steel
  engine: 'rgb(var(--bull))', // engine verdicts — the house bull green (Noah, 2026-07-24)
  bright: '#6B7177',
  '': '#454E58',
};

const LINES_PER_COL = 26;

function pickLines(): string[] {
  const out: string[] = [];
  for (let i = 0; i < LINES_PER_COL; i++) {
    out.push(RAIN_POOL[Math.floor(Math.random() * RAIN_POOL.length)]);
  }
  return out;
}

/** Deterministic-from-index twinkle timing so it's stable across renders. */
function twinkle(i: number, j: number) {
  const dur = 2.6 + ((i * 7 + j * 13) % 42) / 10; // 2.6–6.8s
  const delay = -(((i * 11 + j * 5) % 60) / 10); // 0 to −6s
  return { dur, delay };
}

const CodeRain = ({ className = '' }: { className?: string }) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [cols, setCols] = useState(0);
  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const compute = () => {
      const w = wrapRef.current?.clientWidth ?? window.innerWidth;
      setCols(Math.max(5, Math.min(11, Math.floor(w / 165))));
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const columns = useMemo<Column[]>(() => {
    if (!cols) return [];
    const arr: Column[] = [];
    for (let c = 0; c < cols; c++) {
      const dur = 68 + Math.random() * 74; // slow drift
      arr.push({
        left: c * (100 / cols) + (Math.random() * 3 - 1.5),
        dur,
        delay: -Math.random() * dur,
        up: Math.random() > 0.5,
        lines: pickLines(),
      });
    }
    return arr;
  }, [cols]);

  // Flashlight: track the pointer, open the window while it's over the hero,
  // ease it closed when it leaves. --ca drives the mask's centre alpha (0.05
  // closed → 1 open); --mx/--my place it.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (reduce) {
      wrap.style.setProperty('--ca', '0.07');
      return;
    }
    let raf = 0;
    let tx = 50;
    let ty = 40;
    let cx = 50;
    let cy = 40;
    let revTarget = 0;
    let rev = 0;
    let alive = true;

    const onMove = (e: PointerEvent) => {
      const r = wrap.getBoundingClientRect();
      const inside =
        e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (inside) {
        tx = ((e.clientX - r.left) / r.width) * 100;
        ty = ((e.clientY - r.top) / r.height) * 100;
        revTarget = 1;
      } else {
        revTarget = 0;
      }
    };
    const onLeave = () => {
      revTarget = 0;
    };

    const loop = () => {
      if (!alive) return;
      cx += (tx - cx) * 0.16;
      cy += (ty - cy) * 0.16;
      // open a touch faster than it closes, so it feels responsive but calm
      rev += (revTarget - rev) * (revTarget > rev ? 0.09 : 0.04);
      // once settled, stop touching the vars — writing them invalidates the
      // mask and forces a repaint of the whole rain layer every frame
      const settled =
        Math.abs(tx - cx) < 0.04 && Math.abs(ty - cy) < 0.04 && Math.abs(revTarget - rev) < 0.002;
      if (!settled) {
        const ca = 0.05 + rev * 0.95;
        wrap.style.setProperty('--mx', `${cx.toFixed(2)}%`);
        wrap.style.setProperty('--my', `${cy.toFixed(2)}%`);
        wrap.style.setProperty('--ca', ca.toFixed(3));
      }
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
    };
  }, [reduce]);

  // A soft window (~300px) that follows the cursor; outside it the mask floors
  // at 0.05 so the field is barely there.
  const maskImage =
    'radial-gradient(circle 300px at var(--mx) var(--my), rgba(0,0,0,var(--ca)) 0%, rgba(0,0,0,var(--ca)) 20%, rgba(0,0,0,0.05) 74%)';

  return (
    <div
      ref={wrapRef}
      className={`absolute inset-0 overflow-hidden ${className}`}
      style={{
        ['--mx' as string]: '50%',
        ['--my' as string]: '40%',
        ['--ca' as string]: '0.05',
      }}
      aria-hidden
    >
      {/* masked rain layer — the flashlight decides where it's legible */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          WebkitMaskImage: maskImage,
          maskImage,
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
        }}
      >
        {columns.map((col, i) => (
          <div
            key={i}
            className="rain-col"
            style={{
              position: 'absolute',
              top: 0,
              left: `${col.left}%`,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              whiteSpace: 'nowrap',
              // Deliberately NOT SF Pro: this is an illustration of raining
              // code, and code is drawn in a monospace face.
              fontFamily: 'ui-monospace, "Cascadia Mono", Consolas, monospace',
              fontSize: '12px',
              fontWeight: 500,
              lineHeight: 1.85,
              letterSpacing: '0.01em',
              userSelect: 'none',
              willChange: 'transform',
              animation: reduce ? 'none' : `${col.up ? 'rain-up' : 'rain-down'} ${col.dur}s linear infinite`,
              animationDelay: `${col.delay}s`,
            }}
          >
            {[...col.lines, ...col.lines].map((line, j) => {
              const t = tintFor(line);
              const hi = t === 'struct' || t === 'engine';
              const tw = twinkle(i, j);
              return (
                <span
                  key={j}
                  className={hi ? 'rain-tw-hi' : 'rain-tw'}
                  style={{
                    color: TINT_COLOR[t],
                    willChange: 'opacity',
                    animationDuration: reduce ? undefined : `${tw.dur}s`,
                    animationDelay: reduce ? undefined : `${tw.delay}s`,
                    animationTimingFunction: 'ease-in-out',
                    animationIterationCount: 'infinite',
                    opacity: reduce ? (hi ? 0.4 : 0.28) : undefined,
                  }}
                >
                  {line}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CodeRain;
