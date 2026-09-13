/*
==================================================
  SLAYER TERMINAL - THE ACCOUNT
  (data/account.ts)

  Who you are to the terminal, kept in this browser
  until accounts launch (Noah, 2026-09-13, the
  account-settings mockup): the name, the handle,
  the email, the bio and links the community page
  shows, the security switches, what the bell and
  the inbox may say, the plan. One store, read with
  useSyncExternalStore, the board-names store's
  shape. The Settings page edits it; the Community
  room wears it.
==================================================
*/

import { useSyncExternalStore } from 'react';

const KEY = 'slayer_account';

export interface Notifications {
  likes: boolean;
  comments: boolean;
  follows: boolean;
  posts: boolean;
  updates: boolean;
  mentions: boolean;
  email: boolean;
  newsletter: boolean;
}
export interface Account {
  name: string;
  handle: string;
  email: string;
  bio: string;
  links: string[];
  /** ISO date the account was made — the community's age gate reads it */
  createdAt: string;
  twoStep: boolean;
  emailVerified: boolean;
  notifications: Notifications;
  plan: 'Free' | 'Pro' | 'Desk';
  deactivated: boolean;
}

const DEFAULT: Account = {
  name: 'Slayer trader',
  handle: 'slayer',
  email: 'you@slayer.terminal',
  bio: 'Options and dealer flow. Levels first, opinions second.',
  links: ['slayer.terminal'],
  createdAt: '2026-08-01T13:30:00.000Z',
  twoStep: false,
  emailVerified: false,
  notifications: { likes: true, comments: true, follows: true, posts: true, updates: true, mentions: true, email: false, newsletter: false },
  plan: 'Pro',
  deactivated: false,
};

function load(): Account {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<Account>;
      return { ...DEFAULT, ...v, notifications: { ...DEFAULT.notifications, ...(v.notifications ?? {}) }, links: Array.isArray(v.links) ? v.links : DEFAULT.links };
    }
  } catch {
    /* no storage — the default account */
  }
  return DEFAULT;
}

let current: Account = load();
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const getAccount = (): Account => current;
export const useAccount = (): Account => useSyncExternalStore(subscribe, getAccount, getAccount);

export function updateAccount(patch: Partial<Account>): void {
  current = { ...current, ...patch, notifications: { ...current.notifications, ...(patch.notifications ?? {}) } };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* storage may be off — the change lives for the session */
  }
  for (const l of listeners) l();
}

/** Days since the account was made */
export const accountAgeDays = (a: Account = current): number => Math.max(0, Math.floor((Date.now() - new Date(a.createdAt).getTime()) / 86_400_000));
