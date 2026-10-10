/*
==================================================
  SLAYER TERMINAL - THE ACCOUNT FORMS (/signup /signin /reset /verified /expired)

  "Five screens. Supabase underneath." (Slayer Logo System, Web and App · Sign-in.) Sign up, sign in, reset the
  password, the email confirmed, the link expired — each on one card: the signature, the mark, a line, the form, one
  button, the way out.

  NO SERVICE BEHIND THEM YET. There is no account service until the keys and the backend come in (the project's
  context, .claude/CLAUDE.md), so a form checks what it can on this machine and then shows the next screen of the flow —
  the one a reader would see; signing in opens the terminal. Nothing says "preview" (the owner, 2026-10-01). When the
  service lands, the submit handlers are the seam: each one is a single call.

  THE FORMS, WALKED (2026-10-09, the audit's OU-A1 to A16):
  · each route names its form (`screen`) — read off the address, /signin/ and /SIGNUP fell through to "You're in.";
  · a password can be shown (the eye), and sign-up says its 8-character rule before it is broken;
  · an error is the field's own description, said aloud (a polite live line), and the keys go to the first field wrong;
  · "check your email" is a step in the address (`?sent=1`), so Back returns to the form and a reload keeps the step;
    every one can send the link again or change the address it went to;
  · signing in replaces the form in the history: Back from the terminal does not reopen it filled;
  · one verb pair: "Sign up free" on every door, "Sign up" on the button.
==================================================
*/

import { useId, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import OutsideFrame, { LaunchPill } from '../outside/OutsideFrame';
import { useLaunch } from '../../components/layout/LaunchTransition';
import Signature from '../../brand/Signature';
import SlayerMark from '../../brand/SlayerMark';
import ProductGlyph from '../../brand/ProductGlyph';
import { periodOf, planOf, priceLine, type PlanKey } from '../../data/billing';

export type Screen = 'signup' | 'signin' | 'reset' | 'verified' | 'expired';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** the shortest password the account takes */
const MIN_PASSWORD = 8;

const Card = ({ children, testId }: { children: ReactNode; testId: string }) => (
  <div className="flex-1 flex items-start sm:items-center justify-center px-4 py-8 sm:pb-[10vh]">
    <div className="w-full max-w-[400px] rounded-[32px] border border-borderSubtle bg-panel px-7 pt-7 pb-8 flex flex-col" data-auth={testId}>
      <Signature className="text-[11.5px] w-full" />
      {children}
    </div>
  </div>
);

interface FieldProps {
  label: string;
  name: 'email' | 'password';
  type: 'email' | 'password';
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  error?: string | null;
  /** said under the field until an error takes its place ("At least 8 characters.") */
  hint?: string;
  inputRef?: RefObject<HTMLInputElement>;
}

/** A FIELD: its label, the input, and under it its hint or its error — the input's own description. A password field
    carries the eye that shows it (44 px to a finger), and says whether it is shown. */
const Field = ({ label, name, type, value, onChange, placeholder, autoComplete, error, hint, inputRef }: FieldProps) => {
  const id = useId();
  const [shown, setShown] = useState(false);
  const secret = type === 'password';
  const said = error ?? hint;
  return (
    <div>
      <label htmlFor={id} className="text-[13px] text-textSecondary">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          ref={inputRef}
          id={id}
          name={name}
          type={secret && shown ? 'text' : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={said ? `${id}-said` : undefined}
          className={`w-full h-12 pl-4 ${secret ? 'pr-12' : 'pr-4'} rounded-xl border bg-inputBg text-[15px] text-textPrimary placeholder:text-textMuted transition-colors focus:border-textPrimary/60 ${error ? 'border-bear/70' : 'border-borderSubtle'}`}
          data-auth-field={name}
        />
        {secret && (
          <button
            type="button"
            onClick={() => setShown(s => !s)}
            aria-label="Show password"
            aria-pressed={shown}
            className="absolute right-0 top-0 h-12 w-12 inline-flex items-center justify-center rounded-xl text-textMuted hover:text-textPrimary transition-colors"
            data-auth-eye
          >
            {shown ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
          </button>
        )}
      </div>
      {said && (
        <span id={`${id}-said`} className={`mt-1.5 block text-[12.5px] ${error ? 'text-bear' : 'text-textMuted'}`} data-auth-said={error ? 'error' : 'hint'}>
          {said}
        </span>
      )}
    </div>
  );
};

const Button = ({ children }: { children: ReactNode }) => (
  <button type="submit" className="mt-2 h-12 w-full rounded-full bg-textPrimary text-canvas text-[15px] font-medium hover:bg-textPrimary/90 transition-colors">
    {children}
  </button>
);

const Head = ({ title, line, glyph }: { title: string; line: string; glyph?: 'pulse' }) => (
  <div className="mt-9">
    {glyph ? <ProductGlyph name={glyph} size={38} bare /> : <SlayerMark size={40} bare label="" />}
    <h1 className="mt-6 text-[32px] font-light tracking-[-0.02em] leading-tight">{title}</h1>
    <p className="mt-2 text-[15px] leading-snug text-textSecondary">{line}</p>
  </div>
);

const Foot = ({ children }: { children: ReactNode }) => <p className="mt-8 text-center text-[13.5px] text-textMuted">{children}</p>;
/** a link in a card's foot: quiet, and a finger's height round it on a phone */
const footLink = 'hit text-textSecondary hover:text-textPrimary';

/** a handle as an address carries it ("zak"), shown only when nothing had to be taken out of it (`?from=%3Cimg%3E` read as
    "Brought in by Img" — the audit's OU-A14) */
const cleanHandle = (raw: string | null): string | null => {
  if (!raw) return null;
  const clean = raw.replace(/[^a-z0-9._]/gi, '').slice(0, 24);
  return clean && clean === raw && /[a-z]/i.test(clean) ? clean.charAt(0).toUpperCase() + clean.slice(1) : null;
};

const Auth = ({ screen }: { screen: Screen }) => {
  const [params, setParams] = useSearchParams();
  const planKey = params.get('plan') as PlanKey | null;
  const plan = planKey === 'pinpoint' || planKey === 'compass' ? planOf(planKey) : null;
  /* the plan and how it is paid for, as the landing's prices said them ("$150 USD / month, billed yearly") */
  const period = periodOf(params.get('billing'));
  const price = plan ? priceLine(plan.key, period) : null;
  /* an invite's sign-up names who brought the reader in (Invite.tsx) */
  const from = cleanHandle(params.get('from'));
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({});
  /** what the live line last said — a failed send, in words a screen reader speaks */
  const [spoken, setSpoken] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  /** the form was sent: the next screen of the flow stands in its place — a step in the address (`?sent=1`) */
  const sent = params.get('sent') === '1';
  /** "Send it again", pressed */
  const [resent, setResent] = useState(false);
  const { launch } = useLaunch();
  const sentEmail = (params.get('email') ?? email).trim();
  /** the line on a "check your email" screen: the address it went to */
  const sentTo = `We sent a link to ${sentEmail}. It works for one hour.`;

  const check = (needPassword: boolean, newPassword = false): boolean => {
    const typed = email.trim();
    const next = {
      email: !typed ? 'Type your email.' : EMAIL.test(typed) ? null : 'That doesn’t look like an email address.',
      password: !needPassword ? null : password.length === 0 ? 'Type your password.' : newPassword && password.length < MIN_PASSWORD ? `Use at least ${MIN_PASSWORD} characters.` : null,
    };
    setErrors(next);
    const wrong = [next.email, next.password].filter(Boolean) as string[];
    /* said once aloud, and the keys go to the first field to put right */
    setSpoken(wrong.join(' '));
    if (next.email) emailRef.current?.focus();
    else if (next.password) passwordRef.current?.focus();
    return !wrong.length;
  };
  /** the form went: its next step is the address's (`?sent=1`, the address it went to with it) */
  const toSent = () => {
    const q = new URLSearchParams(params);
    q.set('email', email.trim());
    q.set('sent', '1');
    setResent(false);
    setParams(q);
  };
  /** "Wrong address? Change it": back to the form, the address kept to correct */
  const change = () => {
    const q = new URLSearchParams(params);
    q.delete('sent');
    setParams(q);
  };
  const submit = (needPassword: boolean, newPassword = false, done: () => void = toSent) => (e: FormEvent) => {
    e.preventDefault();
    if (check(needPassword, newPassword)) done();
  };
  /* sign-in keeps what the landing said: the plan and who brought the reader in */
  const carry = ['plan', 'billing', 'from'].flatMap(k => (params.get(k) ? [`${k}=${encodeURIComponent(params.get(k)!)}`] : [])).join('&');
  const withCarry = (path: string) => (carry ? `${path}?${carry}` : path);

  /** CHECK YOUR EMAIL — on sign-up, a reset and an expired link alike: the address it went to, the link again, and a way to
      change the address */
  const sentStep = (back: ReactNode) => (
    <>
      <Head title="Check your email." line={sentTo} />
      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px]">
        <button
          type="button"
          onClick={() => setResent(true)}
          disabled={resent}
          className="hit text-textSecondary underline decoration-borderMuted underline-offset-4 hover:text-textPrimary disabled:no-underline disabled:text-textMuted"
          data-auth-resend
        >
          {resent ? 'Sent again.' : 'Send it again'}
        </button>
        <span className="text-textMuted">
          Wrong address?{' '}
          <button type="button" onClick={change} className="hit text-textSecondary underline decoration-borderMuted underline-offset-4 hover:text-textPrimary" data-auth-change>
            Change it
          </button>
        </span>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {resent ? 'Sent again.' : ''}
      </p>
      <Foot>{back}</Foot>
    </>
  );
  /** the live line a failed send speaks */
  const said = (
    <p className="sr-only" role="status" aria-live="polite" data-auth-spoken>
      {spoken}
    </p>
  );

  let body: ReactNode;
  if (screen === 'signup') {
    body = sent ? (
      sentStep(
        <>
          Confirmed it?{' '}
          <Link to="/signin" className={footLink}>
            Sign in
          </Link>
        </>
      )
    ) : (
      <>
        {/* FREE TO MAKE, AND THAT IS ALL THAT IS FREE (the owner, 2026-10-01: "theirs no try to free you can sign up for free but
            that's it") — the account costs nothing; a plan is what opens the desks */}
        {/* with a plan chosen on the landing (?plan=, ?billing=), the line no longer asks for one — the plan stands under it */}
        <Head title="Sign up free." line={plan ? 'An account is free. The plan comes next.' : 'An account is free. Choose a plan when you’re ready.'} />
        {from && (
          <p className="mt-4 text-[13.5px] text-textSecondary" data-auth-from>
            Brought in by {from}
          </p>
        )}
        {plan && price && (
          <p className="mt-4 text-[13.5px] leading-snug text-textSecondary" data-auth-plan={planKey} data-auth-billing={period}>
            <span className="text-textPrimary">{plan.name}</span> · {price.each} {price.unit}
            {price.year && <span className="block text-textMuted">Billed yearly: {price.year} a year</span>}
          </p>
        )}
        <form className="mt-7 flex flex-col gap-4" onSubmit={submit(true, true)} noValidate>
          <Field label="Email" name="email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" error={errors.email} inputRef={emailRef} />
          <Field label="Password" name="password" type="password" value={password} onChange={setPassword} autoComplete="new-password" error={errors.password} hint={`At least ${MIN_PASSWORD} characters.`} inputRef={passwordRef} />
          <Button>Sign up</Button>
        </form>
        {said}
        <Foot>
          Have an account?{' '}
          <Link to="/signin" className={footLink}>
            Sign in
          </Link>
        </Foot>
      </>
    );
  } else if (screen === 'signin') {
    body = (
      <>
        <Head title="Sign in." line="Your desks are where you left them." />
        {/* signed in, the terminal takes the form's place in the history: Back from it does not reopen the form filled */}
        <form className="mt-7 flex flex-col gap-4" onSubmit={submit(true, false, () => launch('/pulse', { replace: true }))} noValidate>
          <Field label="Email" name="email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" error={errors.email} inputRef={emailRef} />
          <Field label="Password" name="password" type="password" value={password} onChange={setPassword} autoComplete="current-password" error={errors.password} inputRef={passwordRef} />
          <Button>Sign in</Button>
        </form>
        {said}
        <Foot>
          <Link to="/reset" className={footLink}>
            Forgot your password?
          </Link>
          <span className="block mt-3">
            New here?{' '}
            <Link to={withCarry('/signup')} className={footLink} data-auth-signup>
              Sign up free
            </Link>
          </span>
        </Foot>
      </>
    );
  } else if (screen === 'reset' || screen === 'expired') {
    const expired = screen === 'expired';
    body = sent ? (
      sentStep(
        <Link to="/signin" className={footLink}>
          Back to sign in
        </Link>
      )
    ) : (
      <>
        <Head title={expired ? 'That link has expired.' : 'Reset your password.'} line={expired ? 'Links work for one hour. Send a fresh one.' : 'We’ll send a link. It works for one hour.'} />
        <form className="mt-7 flex flex-col gap-4" onSubmit={submit(false)} noValidate>
          <Field label="Email" name="email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" error={errors.email} inputRef={emailRef} />
          <Button>{expired ? 'Send a new link' : 'Send link'}</Button>
        </form>
        {said}
        <Foot>
          <Link to="/signin" className={footLink}>
            Back to sign in
          </Link>
        </Foot>
      </>
    );
  } else {
    body = (
      <>
        <Head title="You’re in." line="Your email is confirmed. Start on Pulse, the live desk." glyph="pulse" />
        <LaunchPill label="Open Pulse" size="block" className="mt-10" />
        {email && <Foot>Signed in as {email}</Foot>}
      </>
    );
  }

  return (
    <OutsideFrame testId={`auth-${screen}`}>
      <Card testId={screen}>{body}</Card>
    </OutsideFrame>
  );
};

export default Auth;
