/*
==================================================
  SLAYER TERMINAL - THE ACCOUNT FORMS (/signup /signin /reset /verified /expired)

  "Five screens. Supabase underneath." (Slayer Logo System, Web and App · Sign-in.) Make your account, sign in, reset
  the password, the email confirmed, the link expired — each on one card: the signature, the mark, a line, the form,
  one button, the way out.

  NOTHING IS SENT YET. There is no account service behind these forms until the keys and the backend come in (the
  project's context, .claude/CLAUDE.md), so a form checks what it can on this machine and then shows the next screen of
  the flow — the one a reader would see — with one quiet line saying the email was not sent. When the service lands,
  the submit handlers are the seam: each one is a single call.
==================================================
*/

import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import OutsideFrame, { LaunchPill } from '../outside/OutsideFrame';
import Signature from '../../brand/Signature';
import SlayerMark from '../../brand/SlayerMark';
import ProductGlyph from '../../brand/ProductGlyph';
import { planOf, type PlanKey } from '../../data/billing';

type Screen = 'signup' | 'signin' | 'reset' | 'verified' | 'expired';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const Card = ({ children, testId }: { children: ReactNode; testId: string }) => (
  <div className="flex-1 flex items-start sm:items-center justify-center px-4 py-8 sm:pb-[10vh]">
    <div className="w-full max-w-[400px] rounded-[32px] border border-borderSubtle bg-panel px-7 pt-7 pb-8 flex flex-col" data-auth={testId}>
      <Signature state="simulated" className="text-[11.5px] w-full" />
      {children}
    </div>
  </div>
);

const Field = ({ label, type, value, onChange, placeholder, autoComplete, error }: { label: string; type: string; value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string; error?: string | null }) => (
  <label className="block">
    <span className="text-[13px] text-textSecondary">{label}</span>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      aria-invalid={!!error}
      className={`mt-1.5 w-full h-12 px-4 rounded-xl border bg-inputBg text-[15px] text-textPrimary placeholder:text-textMuted outline-none transition-colors focus:border-textPrimary/60 ${error ? 'border-bear/70' : 'border-borderSubtle'}`}
    />
    {error && <span className="mt-1.5 block text-[12.5px] text-bear">{error}</span>}
  </label>
);

const Button = ({ children }: { children: ReactNode }) => (
  <button type="submit" className="mt-2 h-12 w-full rounded-full bg-textPrimary text-canvas text-[15px] font-medium hover:bg-textPrimary/90 transition-colors">
    {children}
  </button>
);

const Head = ({ title, line, glyph }: { title: string; line: string; glyph?: 'pulse' }) => (
  <div className="mt-9">
    {glyph ? <ProductGlyph name={glyph} size={56} className="rounded-[12px]" /> : <SlayerMark size={56} label="" />}
    <h1 className="mt-6 text-[32px] font-light tracking-[-0.02em] leading-tight">{title}</h1>
    <p className="mt-2 text-[15px] leading-snug text-textSecondary">{line}</p>
  </div>
);

const Foot = ({ children }: { children: ReactNode }) => <p className="mt-8 text-center text-[13.5px] text-textMuted">{children}</p>;

/** The one quiet line on a screen that would have sent mail */
const NotSent = () => <p className="mt-3 text-[12px] text-textMuted" data-auth-not-sent>Preview: accounts open at launch, so nothing was sent.</p>;

const Auth = () => {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const screen = (pathname.slice(1) || 'signin') as Screen;
  const planKey = params.get('plan') as PlanKey | null;
  const plan = planKey === 'pinpoint' || planKey === 'compass' ? planOf(planKey) : null;
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({});
  /** the form was sent: the next screen of the flow shows in its place */
  const [sent, setSent] = useState(false);

  const check = (needPassword: boolean, newPassword = false): boolean => {
    const next = {
      email: EMAIL.test(email.trim()) ? null : 'That doesn’t look like an email address.',
      password: !needPassword ? null : password.length === 0 ? 'Type your password.' : newPassword && password.length < 8 ? 'Use at least 8 characters.' : null,
    };
    setErrors(next);
    return !next.email && !next.password;
  };
  const submit = (needPassword: boolean, newPassword = false) => (e: FormEvent) => {
    e.preventDefault();
    if (check(needPassword, newPassword)) setSent(true);
  };

  let body: ReactNode;
  if (screen === 'signup') {
    body = sent ? (
      <>
        <Head title="Check your email." line="The link works for one hour." />
        <NotSent />
        <Link to={`/verified?email=${encodeURIComponent(email.trim())}`} className="mt-6 text-[13.5px] text-textSecondary underline decoration-borderMuted underline-offset-4 hover:text-textPrimary">
          See the confirmed screen
        </Link>
        <div className="mt-8 flex flex-col items-center gap-3">
          <p className="text-[13.5px] text-textMuted">Keep using the demo while you wait.</p>
          <LaunchPill label="Open the demo" />
        </div>
      </>
    ) : (
      <>
        <Head title="Make your account." line="You can keep using the demo while you decide." />
        {plan && (
          <p className="mt-4 text-[13.5px] text-textSecondary" data-auth-plan={planKey}>
            {plan.name} · {plan.price} {plan.period}. Payments open at launch.
          </p>
        )}
        <form className="mt-7 flex flex-col gap-4" onSubmit={submit(true, true)} noValidate>
          <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" error={errors.email} />
          <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" error={errors.password} />
          <Button>Make account</Button>
        </form>
        <Foot>
          Have one? <Link to="/signin" className="text-textSecondary hover:text-textPrimary">Sign in</Link>
        </Foot>
      </>
    );
  } else if (screen === 'signin') {
    body = sent ? (
      <>
        <Head title="Accounts open at launch." line="Your desks are already here, on this machine. Nothing was sent." />
        <LaunchPill label="Open Pulse" size="block" className="mt-8" />
      </>
    ) : (
      <>
        <Head title="Sign in." line="Your desks are where you left them." />
        <form className="mt-7 flex flex-col gap-4" onSubmit={submit(true)} noValidate>
          <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" error={errors.email} />
          <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" error={errors.password} />
          <Button>Sign in</Button>
        </form>
        <Foot>
          <Link to="/reset" className="text-textSecondary hover:text-textPrimary">Forgot your password?</Link>
        </Foot>
      </>
    );
  } else if (screen === 'reset' || screen === 'expired') {
    const expired = screen === 'expired';
    body = sent ? (
      <>
        <Head title="Check your email." line="The link works for one hour." />
        <NotSent />
        <Foot>
          <Link to="/signin" className="text-textSecondary hover:text-textPrimary">Back to sign in</Link>
        </Foot>
      </>
    ) : (
      <>
        <Head title={expired ? 'That link has expired.' : 'Reset your password.'} line={expired ? 'Links work for one hour. Send a fresh one.' : 'We’ll send a link. It works for one hour.'} />
        <form className="mt-7 flex flex-col gap-4" onSubmit={submit(false)} noValidate>
          <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" error={errors.email} />
          <Button>{expired ? 'Send a new link' : 'Send link'}</Button>
        </form>
        <Foot>
          <Link to="/signin" className="text-textSecondary hover:text-textPrimary">Back to sign in</Link>
        </Foot>
      </>
    );
  } else {
    body = (
      <>
        <Head title="You’re in." line="Your email is confirmed. Start on the landing desk." glyph="pulse" />
        <LaunchPill label="Open Pulse" size="block" className="mt-10" />
        <Foot>{email ? `Signed in as ${email}` : 'Preview: accounts open at launch.'}</Foot>
      </>
    );
  }

  return (
    <OutsideFrame footer={false} testId={`auth-${screen}`}>
      <Card testId={screen}>{body}</Card>
    </OutsideFrame>
  );
};

export default Auth;
