/*
==================================================
  SLAYER TERMINAL - AN INVITE, AND THE WELCOME (/i/:code, /welcome?from=)

  "Let into a private terminal." (Slayer Logo System, Web and App · Invite.) The invite names who sent it and opens the
  terminal; sign-up comes after, if the reader wants to stay. The welcome is the first thing an invited reader sees: who
  brought them in, and where to start — Pulse.

  The code is the inviter's handle and a short key ("zak-7Q2M"); the name is read off the handle. When accounts open, the
  key is looked up instead.
==================================================
*/

import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import OutsideFrame, { LaunchPill } from './OutsideFrame';
import Signature from '../../brand/Signature';
import ProductGlyph from '../../brand/ProductGlyph';
import { NAV_INK } from '../../components/layout/nav';
import { COMPANY } from '../../data/company';

const nameOf = (handle: string): string => {
  const base = handle.split('-')[0].replace(/[^a-z0-9._]/gi, '');
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'A trader';
};

export const Invite = () => {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const name = nameOf(code);
  return (
    <OutsideFrame testId="invite">
      <div className="flex-1 flex items-center justify-center px-4 pb-[10vh]">
        <div className="w-full max-w-[440px] rounded-[28px] border border-borderSubtle bg-panel p-7 sm:p-8">
          <Signature className="text-[11.5px] w-full" />
          <p className="mt-8 text-[13px] text-textMuted tnum">
            {COMPANY.site}/i/{code}
          </p>
          <h1 className="mt-2 text-[30px] font-light tracking-[-0.02em] leading-tight">{name} invited you to Slayer Terminal.</h1>
          <button
            type="button"
            onClick={() => navigate(`/signup?from=${encodeURIComponent(code.split('-')[0])}`)}
            className="mt-8 h-12 w-full rounded-full bg-textPrimary text-canvas text-[15px] font-medium hover:bg-textPrimary/90"
            data-invite-door
          >
            Sign up free
          </button>
          <p className="mt-3 text-center text-[13.5px] text-textMuted">Making an account is free. Choose a plan when you’re ready.</p>
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
  const name = nameOf(from);
  return (
    <OutsideFrame testId="welcome">
      <div className="flex-1 flex items-center justify-center px-4 pb-[10vh]">
        <div className="w-full max-w-[440px] rounded-[28px] border border-borderSubtle bg-panel p-7 sm:p-8">
          <div className="flex items-center gap-3">
            {/* the room's default avatar: the first letter in a ring of a desk ink */}
            <span className="w-10 h-10 rounded-full inline-flex items-center justify-center text-[17px] font-medium" style={{ border: `2px solid ${NAV_INK.pulse}`, color: `color-mix(in srgb, ${NAV_INK.pulse} 62%, rgb(var(--text-primary)))` }} aria-hidden>
              {name.charAt(0)}
            </span>
            <p className="text-[14px] text-textSecondary">Brought in by {name}</p>
          </div>
          <h1 className="mt-7 text-[30px] font-light tracking-[-0.02em] leading-tight">Welcome in. Start on the landing desk.</h1>
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
