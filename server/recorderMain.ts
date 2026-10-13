/*
  THE FIELD'S RECORDER ON ITS OWN (2026-10-13 — the owner: "The recorder must run on an always-on machine, not in a
  container that restarts. Today only 98 minutes were recorded, and missed live minutes can't be recovered. Tell me
  where it will run and how it restarts itself." — docs/data-feed.md "The recorder's home").

  A plain Node process, no Vite: the same feed proxy and recorder as the dev server's (server/feed.ts
  feedMiddleware), with RECORD_NAMES watched from the start and never let go, on RECORDER_PORT (5190). It reads the
  keys from .env itself (never from the browser). The dev server, given FEED_RECORDER_URL=http://127.0.0.1:5190,
  answers the field's routes from here, so the terminal's tabs read one recorder and the day has no holes when the
  dev server comes and goes. It exits on an error it cannot handle, so the supervisor round it starts it again:
  scripts/recorder.cmd (a loop, registered with Task Scheduler at startup on the owner's Windows machine) or the
  systemd unit in the docs on a Linux box.

    npm run feed:recorder
*/
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { feedMiddleware } from './feed';

function parseEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

const env = { ...parseEnv('.env'), ...process.env } as Record<string, string | undefined>;
const names = (env.RECORD_NAMES ?? 'SPY,QQQ,IWM').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
const port = Number(env.RECORDER_PORT ?? 5190);
const lan = env.FEED_ALLOW_LAN === '1';
const stamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

const handle = feedMiddleware({ keys: { uw: env.UW_API_TOKEN || undefined, massive: env.MASSIVE_API_KEY || undefined }, allowLan: lan, recordNames: names });
const server = createServer((req, res) => {
  void handle(req, res, () => {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end('{"error":"no-route"}');
  });
});
server.listen(port, lan ? '0.0.0.0' : '127.0.0.1', () => {
  console.log(`${stamp()} slayer recorder on http://127.0.0.1:${port} — recording ${names.join(', ')} (UW key ${env.UW_API_TOKEN ? 'in' : 'MISSING — nothing will be recorded'})`);
});
server.on('error', e => {
  console.error(`${stamp()} recorder cannot listen on ${port}: ${String(e)}`);
  process.exit(1);
});
/* an error nobody caught ends the process; the loop round it starts it again — append-only files lose nothing */
process.on('uncaughtException', e => {
  console.error(`${stamp()} recorder error: ${String(e && (e as Error).stack ? (e as Error).stack : e)}`);
  process.exit(1);
});
process.on('unhandledRejection', e => {
  console.error(`${stamp()} recorder rejection: ${String(e)}`);
});
