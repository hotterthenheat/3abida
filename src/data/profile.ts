/*
==================================================
  SLAYER TERMINAL - THE ACCOUNT'S SEAM (data/profile.ts)

  Who the reader is to the terminal: the picture,
  the name, the handle, the email, how they sign
  in, where they are signed in. THE SHAPE the
  account service will hand back once sign-in
  exists (roadmap step 5); until then the profile
  lives on this machine (localStorage) and starts
  plain, so the Account page is the real page, not
  a placeholder (Noah, 2026-09-12: "i
  just want the preview of how things would look
  after apis are plugged in"). The picture is the
  reader's own file, cropped to a square and kept
  small (128px), stored with the profile.
==================================================
*/

import { useSyncExternalStore } from 'react';

export type SignInWay = 'email' | 'google' | 'apple';

export interface Device {
  id: string;
  /** "Windows · Chrome" */
  name: string;
  /** "now", "2 days ago" — the service's words */
  lastSeen: string;
  thisOne: boolean;
}

export interface Profile {
  name: string;
  /** without the @ */
  handle: string;
  email: string;
  /** a data URL, or none — the initials stand in */
  avatar: string | null;
  signIn: SignInWay;
  devices: Device[];
}

const KEY = 'slayer_profile';

/** THIS MACHINE, as the browser names itself: "Windows · Chrome", "macOS · Safari", "Linux · Chromium" — read, never
    a fixed list (the audit's SE-2: a Linux run still saw "Windows · Chrome", and an iPhone that was never signed in) */
export function thisMachine(): string {
  if (typeof navigator === 'undefined') return 'This machine';
  const nav = navigator as Navigator & { userAgentData?: { platform?: string; brands?: { brand: string }[] } };
  const ua = nav.userAgent ?? '';
  const platform = nav.userAgentData?.platform || (/Windows/.test(ua) ? 'Windows' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : '');
  const brands = (nav.userAgentData?.brands ?? []).map(b => b.brand).filter(b => !/Not.?A.?Brand|Chromium/i.test(b));
  const browser = brands[0] ?? (/Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? (/HeadlessChrome|Chromium/.test(ua) ? 'Chromium' : 'Chrome') : /Safari\//.test(ua) ? 'Safari' : '');
  const name = [platform === 'macOS' ? 'macOS' : platform, browser.replace('Google Chrome', 'Chrome').replace('Microsoft Edge', 'Edge')].filter(Boolean).join(' · ');
  return name || 'This machine';
}

/** Where the profile starts on a machine that has none: a plain name to change, no address, and this machine alone as
    where the account is open (the audit's X7.13 — "John Doe", "johndoe@example.com" and a second, made-up phone read as
    someone else's account). A real account replaces it at sign-in. */
export const SAMPLE_PROFILE: Profile = {
  name: 'Trader',
  handle: 'trader',
  email: '',
  avatar: null,
  signIn: 'email',
  devices: [{ id: 'this', name: thisMachine(), lastSeen: 'now', thisOne: true }],
};

/* the placeholders the profile once started from — a profile still wearing them takes the plain start instead */
const OLD_PLACEHOLDERS = new Set(['John Doe', 'Noah']);
const OLD_HANDLES = new Set(['johndoe', 'noah']);
const OLD_EMAILS = new Set(['johndoe@example.com', 'noah@example.com']);

let profile: Profile = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return SAMPLE_PROFILE;
    const p = JSON.parse(raw) as Partial<Profile>;
    return {
      ...SAMPLE_PROFILE,
      ...p,
      ...(p.name && OLD_PLACEHOLDERS.has(p.name) ? { name: SAMPLE_PROFILE.name } : {}),
      ...(p.handle && OLD_HANDLES.has(p.handle) ? { handle: SAMPLE_PROFILE.handle } : {}),
      ...(p.email && OLD_EMAILS.has(p.email) ? { email: '' } : {}),
      /* where you are signed in is this machine, always named as it is now; no other machine is listed until accounts
         can say which are */
      devices: SAMPLE_PROFILE.devices,
    };
  } catch {
    return SAMPLE_PROFILE;
  }
})();
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export function setProfile(patch: Partial<Profile>): void {
  profile = { ...profile, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    /* storage full or off — the change lives for the session */
  }
  listeners.forEach(fn => fn());
}

export const useProfile = (): Profile => useSyncExternalStore(subscribe, () => profile, () => SAMPLE_PROFILE);

/** "NB" for "Noah Barkat", "T" for "Trader" — the mark when there is no picture */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts
    .slice(0, 2)
    .map(p => p[0]!.toUpperCase())
    .join('');
}

/** The reader's file as the picture: drawn onto a square canvas, the shorter
    side filling it (cover), at AVATAR_PX — a phone photo of several MB becomes
    a few KB and never bloats the store. */
export const AVATAR_PX = 128;
export function readAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - side) / 2;
        const sy = (img.naturalHeight - side) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = AVATAR_PX;
        canvas.height = AVATAR_PX;
        const g = canvas.getContext('2d');
        if (!g) throw new Error('no canvas');
        g.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_PX, AVATAR_PX);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('not an image'));
    };
    img.src = url;
  });
}

/** Signed out of this machine: this visit's session goes (what the tab held for itself, and the mark that says someone
    is signed in here); the account — the profile, the board, the marks, the desks — stays, as the Account page says */
export const SESSION_KEY = 'slayer_session';
export function signOutHere(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.clear();
  } catch {
    /* storage off — nothing kept to clear */
  }
}
