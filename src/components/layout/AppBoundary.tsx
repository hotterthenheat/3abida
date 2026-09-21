import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';

/*
==================================================
  SLAYER TERMINAL - THE OUTERMOST NET
  (components/layout/AppBoundary.tsx)

  The one boundary that is not inside anything.
==================================================

  AppShell's RouteBoundary catches a page fault and keeps the terminal
  standing — but it is INSIDE the shell, so it only protects the routes the
  shell renders. The landing sits outside it, and App.tsx said so in a
  comment ("the landing sits outside the shell, so it needs its own
  boundary") above a `<Suspense>`, which catches a slow chunk and not an
  error. So a render fault on the FIRST PAGE ANY VISITOR SEES took the whole
  document to white, with nothing to read and nothing to click.

  This sits above the router. It is deliberately plain — no hooks, no
  router, no context, because the thing it catches may be a fault IN those.
  A boundary that needs the app to work cannot report that the app does not.
*/

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

class AppBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Left visible on purpose: a fault this high up is worth a console entry.
    console.error('[slayer] unrecoverable render fault', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-canvas text-textPrimary flex items-center justify-center p-6">
        <div className="w-full max-w-lg border border-bear/30 bg-bear/[0.04] rounded-lg p-8 flex flex-col items-start gap-3">
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-bear">
            Slayer stopped
          </span>
          <p className="text-[13px] text-textSecondary leading-relaxed">
            Something failed before the terminal could draw. Reloading usually clears it. If it does
            not, the message below is the thing to send us.
          </p>
          <code className="font-mono text-[11px] text-textMuted break-all">{this.state.error.message}</code>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-borderMuted font-mono text-[11px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:bg-ink/[0.03] transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Reload
          </button>
        </div>
      </div>
    );
  }
}

export default AppBoundary;
