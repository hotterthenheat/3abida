/*
==================================================
  SLAYER TERMINAL - A PULSE PANEL IN ITS OWN WINDOW
  (pages/popout/PulsePopOut.tsx)

  /out/pulse/<panel key> — the panel the desk's pop-out
  door named, on the context the desk gives it
  (pages/workspace/tileContext.tsx), on the scan's
  ten-second clock. Its name is read the way the tile's
  was: ?group=A follows that link group, ?name=NVDA
  holds its own name, neither follows the terminal's.
==================================================
*/

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Simulator from '../../core/simulator';
import { changeTicker, isLinkGroup, setLinkGroup, useActiveTicker, useLinkGroupName, useScanSnapshot, type LinkGroup } from '../../context/marketStore';
import { useFocus } from '../../context/FocusContext';
import LinkGroupChip from '../../components/link/LinkGroupChip';
import LiveScopeChip from '../../components/link/LiveScopeChip';
import { widgetByKey, type WorkspaceCtx } from '../workspace/registry';
import { TileBody, buildCtxFor } from '../workspace/tileContext';
import PopOutFrame from './PopOutFrame';
import { NotFoundPrompt } from '../notFound/NotFound';
import type { MarketSnapshot } from '../../types/market';

const SCAN_MS = 10_000;

const PulsePopOut = () => {
  const { key = '' } = useParams();
  const def = widgetByKey(key);
  const [params, setParams] = useSearchParams();
  const groupParam = params.get('group');
  const group: LinkGroup | null = isLinkGroup(groupParam) ? groupParam : null;
  const pinned = params.get('name')?.toUpperCase() || null;
  const active = useActiveTicker();
  const groupName = useLinkGroupName(group);
  const name = group ? (groupName ?? active) : (pinned ?? active);

  /* THE SNAPSHOT: the terminal's own on its scan when the panel reads the terminal's name; another name's, read every
     ten seconds as the desk reads it */
  const scan = useScanSnapshot(SCAN_MS);
  const [own, setOwn] = useState<MarketSnapshot | null>(null);
  useEffect(() => {
    if (scan && scan.ticker === name) return;
    const read = () => {
      try {
        Simulator.ensureTicker(name);
        setOwn(Simulator.snapshotFor(name));
      } catch {
        setOwn(null);
      }
    };
    read();
    /* a name still seeding is asked again in a second; a read one on the scan's clock */
    const id = window.setInterval(read, own ? SCAN_MS : 1000);
    return () => window.clearInterval(id);
  }, [name, scan?.ticker === name, own === null]); // eslint-disable-line react-hooks/exhaustive-deps
  const snap = scan && scan.ticker === name ? scan : own && own.ticker === name ? own : null;
  const base = useMemo<WorkspaceCtx | null>(() => {
    if (!snap) return null;
    try {
      return buildCtxFor(snap);
    } catch {
      return null;
    }
  }, [snap]);

  const { focus, focusOn, clearFocus } = useFocus();
  const focusPrice = focus && focus.ticker === name ? focus.price : null;

  /* a name picked here: the group's, the panel's own, or the terminal's — as on the desk */
  const pick = (t: string) => {
    if (group) setLinkGroup(group, t);
    else if (pinned) setParams(p => (p.set('name', t), p), { replace: true });
    else changeTicker(t);
  };
  const setGroup = (g: LinkGroup | null) => {
    setParams(
      p => {
        p.delete('group');
        p.delete('name');
        if (g) {
          if (!groupName && g) setLinkGroup(g, name);
          p.set('group', g);
        } else if (name !== active) p.set('name', name);
        return p;
      },
      { replace: true }
    );
  };

  if (!def) return <NotFoundPrompt />;
  return (
    <PopOutFrame
      glyph="pulse"
      title={`${def.title} · ${name}`}
      testId={`pulse-${key}`}
      aside={
        <>
          <LinkGroupChip group={group} onChange={setGroup} noneHint="Follows the terminal, or holds its own name" what="this window" testId="popout" />
          {group ? (
            <LiveScopeChip ticker={name} onPick={pick} quote title={`Group ${group} · a name picked here moves every panel in the group`} />
          ) : (
            <LiveScopeChip
              ticker={name}
              linked={!pinned}
              onPick={pick}
              onToggleLink={() => setParams(p => (pinned ? p.delete('name') : p.set('name', name), p), { replace: true })}
              quote
            />
          )}
        </>
      }
    >
      {base ? (
        <div className="h-full min-h-0" data-popout-panel={key}>
          <TileBody
            base={base}
            render={def.render}
            extra={{
              focusPrice,
              clearFocus: focusPrice != null ? clearFocus : undefined,
              focusStrike: (price: number) => focusOn(price, name),
              pickTicker: pick,
            }}
          />
        </div>
      ) : (
        <div className="h-full flex items-center justify-center text-[12px] text-textMuted">Reading {name}…</div>
      )}
    </PopOutFrame>
  );
};

export default PulsePopOut;
