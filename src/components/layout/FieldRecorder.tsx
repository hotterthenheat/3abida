/*
==================================================
  SLAYER TERMINAL - THE FIELD, KEPT ON EVERY PAGE (components/layout/FieldRecorder.tsx)

  Terrain's strike field stands on the books read
  today (data/feed/levels.ts — UW gives the book as it
  stands, never its past by strike). THE LOCAL SERVER
  RECORDS THEM (2026-10-13, server/fieldRecorder.ts):
  once a minute through the session, for the names the
  terminal asked the field for, tab or no tab. This
  shell piece asks the server for the open name's
  recorded day once a minute on every page while the
  feed is up — which also keeps the name watched — and
  folds it into the field. A hidden tab asks nothing;
  the server keeps recording. Draws nothing.
==================================================
*/

import { useActiveTicker } from '../../context/MarketDataContext';
import { isCashIndex, useServerField, useTerrainSource } from '../../data/feed/levels';

const FieldRecorder = () => {
  const ticker = useActiveTicker();
  useServerField(useTerrainSource() === 'feed' && !isCashIndex(ticker), ticker);
  return null;
};

export default FieldRecorder;
