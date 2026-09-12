/*
==================================================
  SLAYER TERMINAL - THE BELL THAT RINGS (components/ui/JingleBell.tsx)

  One bell for every place an alert is set (Noah,
  2026-09-10: "when i do set an alert i want the
  little bell to jingle and then turn orange"):
  when its count rises it is KICKED from its crown
  and swings back on a spring — underdamped, so it
  overshoots and settles the way a real bell does —
  with a small pop in size, and the alert ink lands
  as the swing dies. While anything is set it stays
  in that ink — a bell in colour means "you are
  watching something". Quiet, it takes whatever
  colour the host's classes give it.

  PHYSICS, NOT A SCRIPT OF ANGLES (Noah, later the
  same night: "i actually dont like the alert
  shake. is there built in libraries for more high
  quality ones?"): the first cut was hand-written
  CSS keyframes (18°, −15°, 11°, −7°…) and read as a
  shake. framer-motion is already in the house; a
  spring from a 22° kick decays on its own maths.
  Reduced motion gets the ink without the swing.
==================================================
*/

import { useEffect, useRef, type CSSProperties } from 'react';
import { Bell } from 'lucide-react';
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';

interface JingleBellProps {
  /** How many are set — a rise rings, more than none wears the ink */
  count: number;
  /** The ink worn while set (the alert orange by default) */
  ink?: string;
  /** Wear the ink even with nothing set (a bell whose menu is open) */
  lit?: boolean;
  className?: string;
  strokeWidth?: number;
  style?: CSSProperties;
}

const JingleBell = ({ count, ink = 'rgb(var(--warn))', lit = false, className = '', strokeWidth, style }: JingleBellProps) => {
  const prev = useRef(count);
  const controls = useAnimationControls();
  const reduce = useReducedMotion();
  useEffect(() => {
    if (count > prev.current && !reduce) {
      /* the kick, then the spring home: stiff enough to swing fast, damped
         lightly enough to cross zero three or four times before it rests */
      controls.set({ rotate: 22 });
      void controls.start({
        rotate: 0,
        scale: [1, 1.16, 1],
        transition: {
          rotate: { type: 'spring', stiffness: 380, damping: 5.5, mass: 0.7 },
          scale: { duration: 0.42, ease: 'easeOut' },
        },
      });
    }
    prev.current = count;
  }, [count, controls, reduce]);
  const armed = count > 0;
  return (
    <motion.span animate={controls} className="inline-flex shrink-0" style={{ transformOrigin: '50% 8%' }} aria-hidden data-bell={armed ? 'armed' : 'quiet'}>
      <Bell
        className={className}
        strokeWidth={strokeWidth}
        style={{
          ...style,
          color: armed || lit ? ink : style?.color,
          /* the ink lands as the swing settles; leaving it is immediate */
          transition: `color 0.25s ease ${armed ? '0.45s' : '0s'}`,
        }}
      />
    </motion.span>
  );
};

export default JingleBell;
