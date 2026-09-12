import { useCallback, useState } from 'react';

/** Two-phase close for takeover overlays: flip to a 200ms opacity fade, then
    a TIMER fires the real close. Deliberately not an animation-completion
    wait — the house AnimatePresence-wedge law: a close must never depend on
    an animation finishing; the timeout always fires and the fade is cosmetic
    on top. `closing` resets after the close so PERSISTENT hosts (widget
    fullscreens that stay mounted) reopen visible. Pair with:
    `transition-opacity duration-200 ${closing ? 'opacity-0' : ''}` — opacity
    only, never a transform (containing-block law for fixed layers inside). */
export function useFadeClose(onClose: () => void, ms = 200) {
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => {
    setClosing(prev => {
      if (!prev) {
        window.setTimeout(() => {
          onClose();
          setClosing(false);
        }, ms);
      }
      return true;
    });
  }, [onClose, ms]);
  return { closing, close };
}
