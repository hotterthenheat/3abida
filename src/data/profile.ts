/*
==================================================
  SLAYER TERMINAL - THE ACCOUNT'S SEAM (data/profile.ts)

  Who the reader is to the terminal: the picture,
  the name, the handle, the email, how they sign
  in, where they are signed in. THE SHAPE the
  account service will hand back once sign-in
  exists (roadmap step 5); until then the profile
  lives on this machine (localStorage) and starts
  as a sample, so the Account page is the launch
  page, not a placeholder (Noah, 2026-09-12: "i
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

/** The sample the preview starts from — a real account replaces it at sign-in. A
    placeholder person, not the owner (Noah, 2026-09-13: "make my tag name just john doe,
    same as my name"); the handle is the name, run together. */
export const SAMPLE_PROFILE: Profile = {
  name: 'John Doe',
  handle: 'johndoe',
  email: 'johndoe@example.com',
  avatar: null,
  signIn: 'email',
  devices: [
    { id: 'this', name: 'Windows · Chrome', lastSeen: 'now', thisOne: true },
    { id: 'phone', name: 'iPhone · Safari', lastSeen: '2 days ago', thisOne: false },
  ],
};

let profile: Profile = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return SAMPLE_PROFILE;
    const p = JSON.parse(raw) as Partial<Profile>;
    /* A profile saved under the old sample's name (an avatar added before the
       placeholder became John Doe) takes the new placeholder's name and handle */
    const oldSample = p.name === 'Noah' && p.handle === 'noah';
    return {
      ...SAMPLE_PROFILE,
      ...p,
      ...(oldSample ? { name: SAMPLE_PROFILE.name, handle: SAMPLE_PROFILE.handle, email: p.email === 'noah@example.com' ? SAMPLE_PROFILE.email : p.email } : {}),
      devices: Array.isArray(p.devices) && p.devices.length ? p.devices : SAMPLE_PROFILE.devices,
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

/** "NB" for "Noah Barkat", "N" for "Noah" — the mark when there is no picture */
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
