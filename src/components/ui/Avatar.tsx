/*
==================================================
  SLAYER TERMINAL - THE READER'S PICTURE (components/ui/Avatar.tsx)

  The picture the reader added on Settings ›
  Account, or their initials on the holo disc
  until they do — one mark for the sidebar's foot,
  the Account page and, later, their posts.
==================================================
*/

import { initials, type Profile } from '../../data/profile';
import { NAV_INK } from '../layout/nav';

/* THE ROOM'S DEFAULT AVATAR (Slayer Logo System, 13 · Room, 2026-09-30): the initials in a ring of one desk ink, the same
   ink for the same name every time — no foil (holographic silver is the S's and "Launch terminal"'s alone). The letter is the
   ink drawn toward the page's own text colour, so it reads on paper as well as on black; the ring is the ink itself. */
const RING_INKS = [NAV_INK.pulse, NAV_INK.terrain, NAV_INK.trace, NAV_INK.record, NAV_INK.pinpoint, NAV_INK.compass, NAV_INK.weigher, NAV_INK.journal];
const inkFor = (name: string): string => {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return RING_INKS[h % RING_INKS.length];
};

const Avatar = ({ profile, size, className = '' }: { profile: Profile; size: number; className?: string }) =>
  profile.avatar ? (
    <img src={profile.avatar} alt="" className={`rounded-full object-cover shrink-0 border border-borderSubtle ${className}`} style={{ width: size, height: size }} data-avatar="picture" />
  ) : (
    <span
      className={`rounded-full shrink-0 inline-flex items-center justify-center font-medium select-none ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * (initials(profile.name).length > 1 ? 0.36 : 0.46)), color: `color-mix(in srgb, ${inkFor(profile.name)} 62%, rgb(var(--text-primary)))`, border: `${size >= 32 ? 2 : 1.5}px solid ${inkFor(profile.name)}` }}
      data-avatar="initials"
      aria-hidden
    >
      {initials(profile.name)}
    </span>
  );

export default Avatar;
