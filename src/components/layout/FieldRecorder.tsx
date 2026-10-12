/*
==================================================
  SLAYER TERMINAL - THE FIELD, KEPT ON EVERY PAGE (components/layout/FieldRecorder.tsx)

  Terrain's strike field is the books this terminal
  has read today (data/feed/levels.ts — UW gives the
  book as it stands, never its past by strike). So
  while the feed is up the shell keeps reading the
  open name's book on every page, one call a half
  minute — the same poll Terrain and Pinpoint share,
  never a second — and the field fills while the
  terminal is open anywhere, not only on Terrain. A
  hidden tab asks nothing. Draws nothing.
==================================================
*/

import { useActiveTicker } from '../../context/MarketDataContext';
import { useFeedBook, useTerrainSource } from '../../data/feed/levels';

const FieldRecorder = () => {
  const ticker = useActiveTicker();
  useFeedBook(useTerrainSource() === 'feed', ticker);
  return null;
};

export default FieldRecorder;
