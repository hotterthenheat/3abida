/*
==================================================
  SLAYER TERMINAL - THE WINDOW'S BRIDGE
  (components/layout/EmbedBridge.tsx)

  The inside half of the terminal in the landing's
  window (embed.ts has the whole story). It renders
  nothing and, outside a window, does nothing.

  Inside one it takes two orders from the page
  outside — open this page, wear this theme — and
  says three things back: it is listening, the page
  changed, Esc was pressed (the visitor wants the
  landing's scroll back). Same origin only, and only
  from the frame's own parent.
==================================================
*/

import { useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { EMBEDDED, type FromEmbed, type ToEmbed } from '../../embed';
import { getResolvedTheme, setThemeChoice, type Theme } from '../../theme/theme';

const say = (type: FromEmbed['type']) => {
  const msg: FromEmbed = { slayer: 'embed', type, path: window.location.pathname };
  window.parent.postMessage(msg, window.location.origin);
};

/** The theme changes as ONE crossfade of the whole page where the browser can (index.css times it),
    at once where it cannot or where the visitor asked for less motion. A beat is held inside the
    change so the charts, which re-ink in an effect, are in the picture that fades in — a TIMER, not
    a frame: the browser holds rendering while the change is made, so a frame callback never comes
    and the transition times out (measured: "DOM update timed out", the terminal stayed dark). */
const wear = (theme: Theme) => {
  if (getResolvedTheme() === theme) return;
  const run = () => flushSync(() => setThemeChoice(theme));
  const doc = document as Document & { startViewTransition?: (cb: () => void | Promise<void>) => unknown };
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!doc.startViewTransition || calm) return run();
  doc.startViewTransition(
    () =>
      new Promise<void>(done => {
        run();
        window.setTimeout(done, 60);
      })
  );
};

const EmbedBridge = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!EMBEDDED) return;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window.parent || e.origin !== window.location.origin) return;
      const msg = e.data as ToEmbed | null;
      if (!msg || msg.slayer !== 'landing') return;
      if (msg.type === 'go' && typeof msg.path === 'string' && msg.path.startsWith('/') && msg.path !== window.location.pathname) navigate(msg.path, { replace: true });
      if (msg.type === 'theme' && (msg.theme === 'dark' || msg.theme === 'light')) wear(msg.theme);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') say('escape');
    };
    window.addEventListener('message', onMessage);
    window.addEventListener('keydown', onKey);
    say('ready');
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('keydown', onKey);
    };
  }, [navigate]);

  useEffect(() => {
    if (EMBEDDED) say('route');
  }, [pathname]);

  return null;
};

export default EmbedBridge;
