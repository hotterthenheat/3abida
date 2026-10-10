/*
==================================================
  SLAYER TERMINAL - A TERRAIN PANE IN ITS OWN WINDOW
  (pages/popout/TerrainPopOut.tsx)

  /out/terrain?pane=… — the pane the desk's pop-out door
  named, as it stood (pages/terrain/Terrain.tsx
  TerrainSoloPane), held by this window.
==================================================
*/

import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TerrainSoloPane } from '../terrain/Terrain';
import PopOutFrame from './PopOutFrame';

const parse = (raw: string | null): unknown => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const TerrainPopOut = () => {
  const [params] = useSearchParams();
  const pane = useMemo(() => parse(params.get('pane')), [params]);
  const rail = useMemo(() => parse(params.get('rail')), [params]);
  const [name, setName] = useState('');
  return (
    <PopOutFrame glyph="terrain" title={name ? `Terrain · ${name}` : 'Terrain'} testId="terrain">
      <div className="h-full min-h-0 p-1.5">
        <TerrainSoloPane initial={pane} rail={rail} onName={setName} />
      </div>
    </PopOutFrame>
  );
};

export default TerrainPopOut;
