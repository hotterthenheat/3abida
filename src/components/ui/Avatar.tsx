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

const Avatar = ({ profile, size, className = '' }: { profile: Profile; size: number; className?: string }) =>
  profile.avatar ? (
    <img src={profile.avatar} alt="" className={`rounded-full object-cover shrink-0 border border-borderSubtle ${className}`} style={{ width: size, height: size }} data-avatar="picture" />
  ) : (
    <span
      className={`holo-bg rounded-full shrink-0 inline-flex items-center justify-center font-mono font-bold text-[#0a0a0a] select-none ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
      data-avatar="initials"
      aria-hidden
    >
      {initials(profile.name)}
    </span>
  );

export default Avatar;
