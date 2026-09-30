/*
==================================================
  SLAYER TERMINAL - THE EDITOR DOCK'S DOOR
  (components/scripts/EditorDockGate.tsx)

  The script editor is CodeMirror, the Pine runtime and
  — through the bars its status line reads — the chart
  itself. The shell mounted the dock on every page, so
  all of that rode in the FIRST file every visitor
  downloads: the landing page on a phone paid for an
  editor it cannot even open (measured 2026-09-19 on a
  production build: the first file was 1,602 KB).

  The shell mounts THIS instead: a few lines that watch
  whether the dock is open, and fetch the editor the
  first time it is. Nothing shows while it travels —
  the dock fades in when it lands, as it always did.
==================================================
*/

import { lazy, Suspense } from 'react';
import { useEditorDock } from '../../data/editorDock';

const EditorDock = lazy(() => import('./EditorDock'));

const EditorDockGate = () => {
  const dock = useEditorDock();
  if (!dock.open) return null;
  return (
    <Suspense fallback={null}>
      <EditorDock />
    </Suspense>
  );
};

export default EditorDockGate;
