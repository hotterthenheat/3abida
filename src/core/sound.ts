/*
==================================================
  SLAYER TERMINAL - THE TWO SOUNDS (core/sound.ts)

  Alerts out loud (Settings › The desk, 2026-09-12):
  a JINGLE when an alert is set — two quick notes
  rising, the bell's own swing made audible — and a
  CHIME when one alerts, a longer, softer pair that
  carries across a room. Drawn on the Web Audio
  API, no files; the switch on the Settings page
  silences both. The browser only lets a page play
  after a gesture: setting an alert is one, so the
  jingle always sounds; a chime that fires before
  any gesture on this visit stays silent rather
  than throwing.
==================================================
*/

import { readDeskPrefs } from '../data/deskPrefs';
import { EMBEDDED } from '../embed';

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  /* the terminal in the landing's window is silent — a front page never plays a chime (embed.ts) */
  if (EMBEDDED) return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  return ctx.state === 'running' ? ctx : null;
}

/** One note: a sine at `hz`, in at once, out over `ms`, at a gentle gain */
function note(ac: AudioContext, hz: number, at: number, ms: number, gain = 0.06): void {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = hz;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + ms / 1000);
  osc.connect(g).connect(ac.destination);
  osc.start(at);
  osc.stop(at + ms / 1000 + 0.02);
}

/** Two quick notes rising — an alert set */
export function jingle(): void {
  if (!readDeskPrefs().alertsSound) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  note(ac, 880, t, 110);
  note(ac, 1174.7, t + 0.11, 160);
}

/** A longer, softer pair — an alert that alerted */
export function chime(): void {
  if (!readDeskPrefs().alertsSound) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  note(ac, 659.3, t, 420, 0.05);
  note(ac, 987.8, t + 0.16, 520, 0.045);
}
