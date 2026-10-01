/*
==================================================
  SLAYER TERMINAL - A LOAD THE MARK HEARS ABOUT (brand/MarkLoad.tsx)

  Rendered inside a Suspense fallback: while it is on screen a page's code is travelling, and once that has run past
  450 ms the mark goes to Loading ("any load over 450 ms" — brand/markState.ts). Draws nothing.
==================================================
*/

import { useEffect } from 'react';
import { beginLoad } from './markState';

const MarkLoad = () => {
  useEffect(() => beginLoad(), []);
  return null;
};

export default MarkLoad;
