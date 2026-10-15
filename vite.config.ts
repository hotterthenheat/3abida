import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { feedMiddleware } from './server/feed';

/* THE FEED PROXY (2026-10-12, server/feed.ts; docs/data-feed.md): the dev server and `vite preview` answer /feed/uw/*
   and /feed/theta/* themselves (Massive off since 2026-10-14 — the owner: "you can disable the massive ones and use this
   one"; its key is handed to nothing), the key added here on the server. The keys are read HERE ALONE, with loadEnv's ''
   prefix (every variable, not only VITE_ ones) — and handed to the middleware, never to `define` or import.meta.env, so
   the bundle never holds one. No key: the route answers 503 { error: 'no-key' } and every room keeps its own book. The
   proxy answers this machine alone (FEED_ALLOW_LAN=1 lets a phone on the network in). */
function feedProxy(keys: { uw?: string; massive?: string; theta?: string }, fieldUpstream?: string): Plugin {
  const middleware = () => feedMiddleware({ keys, allowLan: process.env.FEED_ALLOW_LAN === '1', fieldUpstream });
  return {
    name: 'slayer-feed-proxy',
    configureServer: server => {
      const m = middleware();
      server.middlewares.use(m);
      /* the recorder stops with its server (a restart builds a new one) */
      server.httpServer?.once('close', () => m.close());
    },
    configurePreviewServer: server => {
      const m = middleware();
      server.middlewares.use(m);
      server.httpServer?.once('close', () => m.close());
    },
  };
}

/* THE UPDATE-DEPTH LOG (2026-10-15, development only — the owner's A3: the phone's "Maximum update depth exceeded" was
   seen once and never again in fourteen runs here): src/dev/depthTrap.ts posts what it caught to POST /__slayer/depth,
   and this appends it to .feed-cache/depth-trap.ndjson on the machine serving the page — a phone has no console to read.
   A line is at most 64 KB and the file stops at 1 MB. Never in `vite preview` or a build. */
function depthLog(): Plugin {
  return {
    name: 'slayer-depth-log',
    apply: 'serve',
    configureServer: server => {
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'POST' || (req.url ?? '').split('?')[0] !== '/__slayer/depth') return next();
        let body = '';
        req.setEncoding('utf8');
        req.on('data', (c: string) => {
          if (body.length < 65_536) body += c;
        });
        req.on('end', () => {
          try {
            const dir = path.join(process.cwd(), '.feed-cache');
            const file = path.join(dir, 'depth-trap.ndjson');
            fs.mkdirSync(dir, { recursive: true });
            const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
            if (size < 1_048_576) fs.appendFileSync(file, `${JSON.stringify({ receivedAt: new Date().toISOString(), from: req.headers['user-agent'] ?? '', hit: JSON.parse(body.slice(0, 65_536)) })}\n`);
          } catch {
            /* a line cut short or a full disk: the trap's own console print stands */
          }
          res.statusCode = 204;
          res.end();
        });
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    /* THE FIELD'S ROUTES GO TO THE ALWAYS-ON RECORDER (2026-10-14): http://127.0.0.1:5190 — the recorder's own port — unless
       FEED_RECORDER_URL names another, or says `off` (then the dev server records on its own, as it did); a port that
       refuses falls back to this process (server/feed.ts) */
    plugins: [react(), depthLog(), feedProxy({ uw: env.UW_API_TOKEN || undefined, theta: env.THETADATA_API_KEY || undefined }, env.FEED_RECORDER_URL === 'off' ? undefined : env.FEED_RECORDER_URL || 'http://127.0.0.1:5190')],
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
  };
});
