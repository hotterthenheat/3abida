/*
==================================================
  SLAYER TERMINAL - THE LEGAL PAGES (/legal/:doc)

  "Counsel writes it. We set it." (Slayer Logo System, Web and App · Legal and install.) Five documents on one frame:
  the tabs, the title, a lead in plain words, then the sections. A section shows once it has words — counsel's, set in
  `body` — and never as a "[placeholder]" (the owner, 2026-10-01); Contact always shows, with the address to write to.
  The leads are the brand's own sentences; the Data sources page says what every number stands on, which is ours to
  say — in the landing's three kinds, observed, calculated and modeled (2026-10-09, the audit's OU-L4), and with no
  vendor named and no licence claimed (X7.10: "straight from a licensed feed"). A document is as long as its words: the
  footer follows them (OutsideFrame `fill`). An address that names no document is not one (App.tsx).
==================================================
*/

import { Link, Navigate, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import OutsideFrame from './OutsideFrame';
import { COMPANY } from '../../data/company';

interface Doc {
  slug: string;
  title: string;
  lead: string;
  sections: { head: string; body?: string[] }[];
}

export const LEGAL_DOCS: Doc[] = [
  {
    slug: 'terms',
    title: 'Terms',
    lead: `These are the terms for using ${COMPANY.product}. Slayer is a terminal for reading the market. It is not a broker, it places no orders, and it is not investment advice.`,
    sections: [{ head: 'Who these terms are between' }, { head: 'Your account' }, { head: 'Your plan and billing' }, { head: 'What Slayer is not' }, { head: 'Ending your account' }, { head: 'Changes to these terms' }, { head: 'Contact' }],
  },
  {
    slug: 'privacy',
    title: 'Privacy',
    lead: 'What we keep about you, why, and how to have it removed. Your desks, layouts and settings are kept so the terminal opens the way you left it.',
    sections: [{ head: 'What we collect' }, { head: 'How we use it' }, { head: 'Who we share it with' }, { head: 'How long we keep it' }, { head: 'Your rights' }, { head: 'Contact' }],
  },
  {
    slug: 'risk',
    title: 'Risk disclosure',
    lead: 'Trading options can lose money quickly, and can lose all of it. Nothing in Slayer Terminal tells you what to buy or sell, and nothing here says what you will make.',
    sections: [{ head: 'Options carry risk' }, { head: 'Levels and reads are not advice' }, { head: 'Delayed data' }, { head: 'Practice is not the market' }, { head: 'Contact' }],
  },
  {
    slug: 'refunds',
    title: 'Refund policy',
    lead: 'We don’t offer refunds. Making an account is free and every desk is shown on the front page, so see what each plan holds before you pay. Cancel any time in Settings.',
    sections: [{ head: 'Why there are no refunds' }, { head: 'Cancelling' }, { head: 'Billing errors' }, { head: 'Contact' }],
  },
  {
    slug: 'data',
    title: 'Data sources',
    lead: 'Every number in the terminal says what it stands on.',
    sections: [
      {
        head: 'What every number stands on',
        body: [
          'Observed — what the market printed, as it happens: trades, quotes, open interest, filings.',
          'Calculated — worked out from what was observed by a fixed rule: a volume, a premium, the distance to the flip.',
          'Modeled — an estimate where an assumption is needed, and named as one, such as where dealers are positioned.',
        ],
      },
      { head: 'Dealer positioning', body: ['Modeled · each page’s guide says what it stands on.'] },
      { head: 'Licences' },
    ],
  },
];

const Legal = () => {
  const { doc = 'terms' } = useParams();
  const page = LEGAL_DOCS.find(d => d.slug === doc.toLowerCase());
  if (!page) return <Navigate to="/legal/terms" replace />;
  /* the sections with words: counsel's, and Contact with the address to write to, a link that opens the mail */
  const contact: ReactNode = (
    <>
      Write to{' '}
      <a href={`mailto:${COMPANY.info}`} className="hit text-textPrimary underline decoration-borderMuted underline-offset-4 hover:decoration-textPrimary">
        {COMPANY.info}
      </a>
      .
    </>
  );
  const sections = page.sections.flatMap<{ head: string; body: ReactNode[] }>(s => (s.body ? [{ head: s.head, body: s.body as ReactNode[] }] : s.head === 'Contact' ? [{ head: s.head, body: [contact] }] : []));
  return (
    <OutsideFrame testId={`legal-${page.slug}`} fill={false}>
      <div className="w-full max-w-[880px] mx-auto px-5 sm:px-8 pt-8 pb-20">
        <nav className="flex gap-1.5 flex-wrap" aria-label="Legal">
          {LEGAL_DOCS.map(d => (
            <Link
              key={d.slug}
              to={`/legal/${d.slug}`}
              aria-current={d.slug === page.slug ? 'page' : undefined}
              className={`hit h-8 px-3.5 inline-flex items-center rounded-full text-[13px] border transition-colors ${
                d.slug === page.slug ? 'border-textPrimary/70 text-textPrimary' : 'border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted'
              }`}
            >
              {d.title}
            </Link>
          ))}
        </nav>
        <h1 className="mt-10 text-[40px] sm:text-[52px] font-light tracking-[-0.04em] leading-[1.04]">{page.title}</h1>
        <p className="mt-8 max-w-[62ch] text-[18px] leading-[1.55] text-textPrimary">{page.lead}</p>
        <div className="mt-10 flex flex-col">
          {sections.map(s => (
            <section key={s.head} className="py-6 border-t border-borderSubtle">
              <h2 className="text-[20px] font-medium tracking-tight">{s.head}</h2>
              <div className="mt-2.5 flex flex-col gap-2 max-w-[66ch] text-[15.5px] leading-relaxed text-textSecondary">
                {s.body.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </OutsideFrame>
  );
};

export default Legal;
