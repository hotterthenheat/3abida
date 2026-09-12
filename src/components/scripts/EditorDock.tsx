/*
==================================================
  SLAYER TERMINAL - THE EDITOR'S DOCK (components/scripts/EditorDock.tsx)

  The one place the script editor lives: a panel
  docked at the right of a full-screen chart, the
  chart narrowed to leave it room (every takeover
  reads `--editor-w` for its right edge), with a
  grip on its left edge to drag the width — the
  Map's profile panel's own sash — and a remembered
  width. The chart a script is written for stays
  live beside the code: edit, add to chart, look,
  edit again. The library (a chooser) stays a
  centred card; this is a workbench.
==================================================
*/

import { useCallback, useEffect, useRef, useState } from 'react';
import { closeEditor, DOCK_MAX_SHARE, DOCK_MIN, setDockWidth, useEditorDock } from '../../data/editorDock';
import ScriptEditorPanel from './ScriptEditor';
import ScriptLibrary from './ScriptLibrary';

const EditorDock = () => {
  const dock = useEditorDock();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const drag = useRef<{ x: number; w: number } | null>(null);

  /* THE GRIP: a drag on the dock's left edge sets its width; the pointer is captured so a fast drag cannot lose it */
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLSpanElement>) => {
      drag.current = { x: e.clientX, w: dock.width };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [dock.width]
  );
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLSpanElement>) => {
    if (!drag.current) return;
    setDockWidth(drag.current.w - (e.clientX - drag.current.x));
  }, []);
  const onPointerUp = useCallback((e: React.PointerEvent<HTMLSpanElement>) => {
    if (!drag.current) return;
    drag.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  /* a window that shrank under the dock */
  useEffect(() => {
    const onResize = () => {
      const max = Math.floor(window.innerWidth * DOCK_MAX_SHARE);
      if (dock.width > max) setDockWidth(max);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [dock.width]);

  if (!dock.open) return null;
  return (
    <>
      <aside className="fixed top-0 right-0 bottom-0 z-[85] border-l border-borderMuted bg-panel flex flex-col animate-fade-in" style={{ width: dock.width }} aria-label="Script editor" data-editor-dock data-width={dock.width}>
        <span
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDoubleClick={() => setDockWidth(DOCK_MIN)}
          role="separator"
          aria-orientation="vertical"
          aria-label="Drag to resize the editor — double-click to reset"
          title="Drag to resize · double-click to reset"
          className="absolute left-0 inset-y-0 -ml-1 w-2 z-30 cursor-col-resize hover:bg-ink/[0.10] transition-colors"
          data-editor-grip
        />
        <ScriptEditorPanel key={dock.nonce} script={dock.script} paneId={dock.paneId} onClose={closeEditor} onOpenLibrary={() => setLibraryOpen(true)} />
      </aside>
      {libraryOpen && <ScriptLibrary open onClose={() => setLibraryOpen(false)} paneId={dock.paneId} fullscreen />}
    </>
  );
};

export default EditorDock;
