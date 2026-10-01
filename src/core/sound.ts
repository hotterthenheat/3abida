/*
==================================================
  SLAYER TERMINAL - THE SOUNDS (core/sound.ts)

  The terminal's four sounds, as the Logo System
  names them (2026-09-30): the alert's two rising
  tones, a confirmation's soft click, a low tone at
  sign-in, a tone up at the open and down at the
  close. Drawn on the Web Audio API, no files; each
  answers to its own switch (Settings › Sounds). The
  browser only lets a page play after a gesture:
  setting an alert is one, so its click always
  sounds; an alert that fires before any gesture on
  this visit stays silent rather than throwing.
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

/* THE FOUR SOUNDS (Slayer Logo System, 14 · Motion and sound, 2026-09-30): "Tones, not a casino."
     Alert     two short rising sine tones, 180 ms                         on
     Confirm   one soft click, 60 ms                                       on
     Sign in   one low tone, 120 ms                                        off
     Open and close   one tone up at the open, one down at the close       off
   Each answers to its own switch (Settings › Sounds); the Play buttons there play them whatever the switch says. */

export type SoundKind = 'alert' | 'confirm' | 'signIn' | 'openClose' | 'close';

/** A tone that glides from one pitch to another — the open's rise and the close's fall */
function glide(ac: AudioContext, from: number, to: number, at: number, ms: number, gain = 0.05): void {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(to, at + ms / 1000);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + ms / 1000);
  osc.connect(g).connect(ac.destination);
  osc.start(at);
  osc.stop(at + ms / 1000 + 0.02);
}

/** A soft click: a short triangle blip with a fast fall */
function click(ac: AudioContext, at: number): void {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1500, at);
  osc.frequency.exponentialRampToValueAtTime(900, at + 0.06);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.045, at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
  osc.connect(g).connect(ac.destination);
  osc.start(at);
  osc.stop(at + 0.08);
}

/** Play a sound now, whatever its switch says — the Settings page's Play buttons */
export function play(kind: SoundKind): void {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  if (kind === 'alert') {
    note(ac, 880, t, 85, 0.055);
    note(ac, 1318.5, t + 0.09, 90, 0.05);
  } else if (kind === 'confirm') {
    click(ac, t);
  } else if (kind === 'signIn') {
    note(ac, 293.7, t, 120, 0.06);
  } else if (kind === 'openClose') {
    glide(ac, 523.3, 784, t, 220);
  } else {
    glide(ac, 784, 523.3, t, 220);
  }
}

/** An alert fired — the two rising tones, when alerts sound */
export function chime(): void {
  if (!readDeskPrefs().alertsSound) return;
  play('alert');
}

/** A thing confirmed — an alert set, a layout saved: the soft click */
export function jingle(): void {
  if (!readDeskPrefs().sounds.confirm) return;
  play('confirm');
}

/** Signed in — the low tone, when it is switched on */
export function signInTone(): void {
  if (!readDeskPrefs().sounds.signIn) return;
  play('signIn');
}

/** The market opened (up) or closed (down), when it is switched on */
export function marketBell(open: boolean): void {
  if (!readDeskPrefs().sounds.openClose) return;
  play(open ? 'openClose' : 'close');
}
