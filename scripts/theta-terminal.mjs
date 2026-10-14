/*
  THE THETA TERMINAL — `npm run theta:terminal` (2026-10-14; docs/data-feed.md "Theta Data")

  Theta Data answers through a program on this machine, the Theta Terminal v3 (Java 21): the terminal is handed the key
  when it starts and serves http://127.0.0.1:25503/v3/…, which the terminal's own server (server/feed.ts) asks — the key
  is never in a request, in the page or in the repo. This starts it with THETADATA_API_KEY from .env, and never prints
  the key.

  · the program lives in .theta/ (git-ignored): downloaded from Theta Data on the first run
    (https://downloads.thetadata.us/ThetaTerminalv3.jar — it updates itself on every start after that)
  · it listens on THIS MACHINE ALONE: its config (.theta/config.toml) says host = "127.0.0.1" — its own default is every
    interface (0.0.0.0), which would hand the session to anyone on the network
  · ONE TERMINAL AT A TIME for a key: a second one, anywhere, signs the first out (its error 478)
  · keep it running beside the recorder: scripts/theta-terminal.cmd starts it again whenever it stops (Task Scheduler at
    startup, as scripts/recorder.cmd)
*/
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, '.theta');
const jar = join(dir, 'ThetaTerminalv3.jar');
const config = join(dir, 'config.toml');
const JAR_URL = 'https://downloads.thetadata.us/ThetaTerminalv3.jar';

const parseEnv = file => {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
};
const key = process.env.THETADATA_API_KEY || parseEnv(join(root, '.env')).THETADATA_API_KEY || '';
if (!key) {
  console.error('No THETADATA_API_KEY in .env at the repo root — add it, then run this again.');
  process.exit(1);
}

const java = spawnSync('java', ['-version'], { encoding: 'utf8' });
const version = `${java.stderr ?? ''}${java.stdout ?? ''}`;
const major = Number(/version "(\d+)/.exec(version)?.[1] ?? 0);
if (java.error || major < 21) {
  console.error(java.error ? 'Java is not installed — the Theta Terminal needs Java 21 or later (Temurin 21: https://adoptium.net).' : `Java ${major} found — the Theta Terminal needs Java 21 or later (Temurin 21: https://adoptium.net).`);
  process.exit(1);
}

mkdirSync(join(dir, 'logs'), { recursive: true });
if (!existsSync(jar)) {
  console.log(`Downloading the Theta Terminal from ${JAR_URL} …`);
  const res = await fetch(JAR_URL);
  if (!res.ok) {
    console.error(`The download answered ${res.status} — try again, or put ThetaTerminalv3.jar in .theta/ by hand.`);
    process.exit(1);
  }
  writeFileSync(jar, Buffer.from(await res.arrayBuffer()));
}

/* this machine alone, its logs in .theta/logs: the terminal's own config (written the way it writes its default, 2026-10-14,
   terminal 20261009), with the host and the log folder ours; one already there keeps everything but a host on every
   interface */
const logs = join(dir, 'logs').replace(/\\/g, '/');
if (!existsSync(config)) {
  writeFileSync(
    config,
    `# Configuration properties for Theta Terminal 3 — written by scripts/theta-terminal.mjs: this machine alone\n\nhost = "127.0.0.1"\nport = 25503\nlog_directory = "${logs}"\n\n[env]\nmdds_type = "PROD"\n\n[auth]\nbase_url = "https://nexus-api.thetadata.us/identity/terminal/auth_user"\n\n[mdds]\nenable=true\n\n[mdds_server]\nhost = "mdds-01.thetadata.us"\nport = 443\ntls = true\n\n[mdds_stage]\nhost = "mdds-stage.thetadata.us"\nport = 443\ntls = true\n\n[fpss]\nenable=true\nreconnect_wait=1000\nfpss_queue_depth=1000000\nws_port=25520\nfpss_region="fpss_nj_hosts"\nfpss_nj_hosts="nj-a.thetadata.us:20000,nj-a.thetadata.us:20001,nj-b.thetadata.us:20000,nj-b.thetadata.us:20001"\nfpss_stage_hosts="nj-a.thetadata.us:20100,test-server.thetadata.us:20100,test-server.thetadata.us:20101"\nfpss_dev_hosts="nj-a.thetadata.us:20200,test-server.thetadata.us:20200,test-server.thetadata.us:20201"\n`
  );
} else {
  const text = readFileSync(config, 'utf8');
  const fixed = text.replace(/^host\s*=\s*"0\.0\.0\.0"\s*$/m, 'host = "127.0.0.1"');
  if (fixed !== text) writeFileSync(config, fixed);
}

console.log('Starting the Theta Terminal — this machine alone, http://127.0.0.1:25503/v3 (the key from .env, never printed)');
const child = spawn('java', ['-jar', 'ThetaTerminalv3.jar'], { cwd: dir, stdio: 'inherit', env: { ...process.env, THETADATA_API_KEY: key } });
const stop = () => child.kill('SIGTERM');
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', code => process.exit(code ?? 0));
