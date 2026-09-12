/*
==================================================
  SLAYER TERMINAL - ERROR BOUNDARY
  A local catch so one bad panel degrades to a line
  of text instead of taking the page down with it.
  AppShell's RouteBoundary is the page-level net;
  this is for surfaces that read live feed data and
  must fail small — a drilldown, a widget, a chart.
==================================================
*/

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Shown in place of the children when they throw. */
  label?: string;
  /** Changing this clears a shown fault (e.g. the row the panel is showing). */
  resetKey?: string | number | null;
}

interface State {
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the detail in the console — the UI stays calm, the cause stays findable
    console.error('[boundary]', this.props.label ?? 'panel', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="border border-bear/25 bg-bear/[0.04] rounded-md px-3 py-2.5 flex flex-col gap-1">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-bear">
          {this.props.label ?? 'This panel'} could not render
        </span>
        <span className="font-mono text-[10px] text-textMuted break-all">{this.state.error.message}</span>
      </div>
    );
  }
}

export default ErrorBoundary;
