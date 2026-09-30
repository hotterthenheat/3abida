import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AppBoundary } from './components/ui/Fault';
import { applyStoredDefaults } from './core/storedDefaults';
import './index.css';

/* a default that changed under stored state is carried into storage once, before any page reads it */
applyStoredDefaults();

// NOTE: StrictMode is intentionally off — its dev-mode double-mounting breaks
// react-draggable/react-grid-layout drag initiation (RGL #1959). Dev-only
// diagnostic; production output is identical either way.
ReactDOM.createRoot(document.getElementById('root')!).render(
  /* THE NET AROUND EVERYTHING (ui/Fault.tsx, 2026-09-19): the shell has its own for a page, but the landing, the not-found
     page, the rail and the providers had none — an error there was a blank screen */
  <AppBoundary>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </AppBoundary>
);
