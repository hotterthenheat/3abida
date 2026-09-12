/*
==================================================
  SLAYER TERMINAL - REVEAL (landing)
  Scroll-reveal wrapper: content drifts up and fades
  in the first time it scrolls into view. Once only —
  scrolling back up never replays it. Respects the
  user's reduced-motion setting via MotionConfig.
==================================================
*/

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Seconds — stagger sibling reveals (heading first, body after) */
  delay?: number;
}

const Reveal = ({ children, className, delay = 0 }: RevealProps) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-70px 0px' }}
    transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
  >
    {children}
  </motion.div>
);

export default Reveal;
