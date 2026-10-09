/*
==================================================
  SLAYER TERMINAL - AN INVITE, AND THE WELCOME (/i/:code, /welcome?from=)

  "Let into a private terminal." (Slayer Logo System, Web and App · Invite.) The invite names who sent it, says in a line
  what the terminal is, and offers two doors: sign up, or look around first. The welcome is the first thing an invited
  reader sees: who brought them in, and where to start — Pulse.

  The code is the inviter's handle and a short key ("zak-7Q2M"); the name is read off the handle. When accounts open, the
  key is looked up instead. A NAME IS READ ONLY WHEN IT IS ONE (2026-10-09, the audit's OU-I1 and I2): a key with no
  handle ("7Q2M"), a handle that needed cleaning ("<b>hi") or one past 24 letters is "A trader", and a long code wraps
  instead of running off a phone's screen.
==================================================
*/

import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import OutsideFrame, { LaunchPill } from './OutsideFrame';
import Signature from '../../brand/Signature';
import ProductGlyph from '../../brand/ProductGlyph';
import { COMPANY } from '../../data/company';

/** the inviter's name, read off a handle — or null when the handle is not a plain name */
export const inviterOf = (handle: string): string | null => {
  const clean = handle.replace(/[^a-z0-9._]/gi, '');
  if (!clean || clean !== handle || clean.length > 24 || !/[a-z]/i.test(clean)) return null;
  return clean.charAt(0).toUpperCase() + clean.slice(1);
};
/** an invite's code is "handle-KEY": a code with no handle names nobody */
const handleOf = (code: string): string => (code.includes('-') ? code.split('-')[0] : '');

export const Invite = () => {
  const { code = '' } = useParams();
  const handle = handleOf(code);
  const name = inviterOf(handle);
  return (
    <OutsideFrame testId="invite">
      <div className="flex-1 flex items-center justify-center px-4 pb-[10vh]">
        <div className="w-full max-w-[440px] min-w-0 rounded-[28px] border border-borderSubtle bg-panel p-7 sm:p-8">
          <Signature className="text-[11.5px] w-full" />
          <p className="mt-8 text-[13px] text-textMuted tnum break-all" data-invite-code>
            {COMPANY.site}/i/{code}
          </p>
          <h1 className="mt-2 text-[30px] font-light tracking-[-0.02em] leading-tight [overflow-wrap:anywhere]">{name ?? 'A trader'} invited you to Slayer Terminal.</h1>
          {/* what it is, in a line (the audit's OU-I4: the card said who, and not what) */}
          <p className="mt-3 text-[15px] leading-snug text-textSecondary">
            One terminal for the market’s structure: where options positions sit, the levels they make, and every print as it crosses.
          </p>
          <Link
            to={name ? `/signup?from=${encodeURIComponent(handle)}` : '/signup'}
            className="mt-8 h-12 w-full inline-flex items-center justify-center rounded-full bg-textPrimary text-canvas text-[15px] font-medium hover:bg-textPrimary/90"
            data-invite-door
          >
            Sign up free
          </Link>
          <p className="mt-3 text-center text-[13.5px] text-textMuted">Making an account is free. Choose a plan when you’re ready.</p>
          <p className="mt-5 text-center">
            <LaunchPill label="Look around first" size="lg" className="!bg-transparent border border-borderMuted !text-textPrimary hover:!bg-ink/[0.05]" />
          </p>
        </div>
      </div>
    </OutsideFrame>
  );
};

export const Welcome = () => {
  const [params] = useSearchParams();
  const from = params.get('from');
  /* /welcome was the front page's old address — without an inviter it still goes there */
  if (!from) return <Navigate to="/" replace />;
  const name = inviterOf(from) ?? 'a trader';
  return (
    <OutsideFrame testId="welcome">
      <div className="flex-1 flex items-center justify-center px-4 pb-[10vh]">
        <div className="w-full max-w-[440px] min-w-0 rounded-[28px] border border-borderSubtle bg-panel p-7 sm:p-8">
          <div className="flex items-center gap-3 min-w-0">
            {/* the room's default avatar: the first letter in a ring of the silver (the one accent these pages wear — the
                audit's OU-I7) */}
            <span className="w-10 h-10 shrink-0 rounded-full inline-flex items-center justify-center text-[17px] font-medium border-2 border-silver text-textPrimary" aria-hidden>
              {name.charAt(0).toUpperCase()}
            </span>
            <p className="min-w-0 text-[14px] text-textSecondary [overflow-wrap:anywhere]">Brought in by {name}</p>
          </div>
          <h1 className="mt-7 text-[30px] font-light tracking-[-0.02em] leading-tight">Welcome in. Start on Pulse, the live desk.</h1>
          <div className="mt-4 flex items-start gap-3">
            <ProductGlyph name="pulse" size={24} bare className="shrink-0" />
            <p className="text-[15px] leading-snug text-textSecondary">Pulse shows the chart, dealer pressure and the key levels. Set an alert on any level and it sounds on every page.</p>
          </div>
          <LaunchPill label="Open Pulse" size="block" className="mt-8" />
        </div>
      </div>
    </OutsideFrame>
  );
};
