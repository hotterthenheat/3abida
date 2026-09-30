import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    /* THE FIRST LOAD AFTER `npm run dev` (Noah, 2026-09-20: "a white screen for about 5-7 seconds"). Measured: the very first
       visit painted at 4.2s, the second at 0.2s — the same page, the same browser. The dev server compiles nothing until it is
       asked: on the first visit every file is transformed on demand, and Tailwind's first pass over the whole source takes
       ~2.3s on its own, during which every other request queues behind it. (A built site has none of this — it is the dev
       server's cold start, not the page.) So the server does that work THE MOMENT IT STARTS instead of when the browser asks:
       the entry and everything it imports (index.css with it), the landing, and the page the landing's doors open. By the
       time a tab is opened it is already warm. */
    warmup: {
      clientFiles: ['./src/main.tsx', './src/pages/landing/Landing.tsx', './src/pages/workspace/Pulse.tsx'],
    },
  },
  resolve: {
    // One React, always — guards against mixed pre-bundle generations
    // ("Invalid hook call") when deps are installed mid-flight.
    dedupe: ['react', 'react-dom'],
  },
  define: {
    // react-draggable 4.7 (via react-grid-layout) reads process.env in the
    // browser and throws ReferenceError on every drag without this shim.
    'process.env': {},
  },
});
