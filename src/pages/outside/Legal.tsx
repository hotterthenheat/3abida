/*
==================================================
  SLAYER TERMINAL - THE LEGAL PAGES (/legal/:doc)

  "Counsel writes it. We set it." (Slayer Logo System, Web and App · Legal and install.) Five documents on one frame:
  the tabs, the title, when it was last updated and how long it takes to read, a lead in plain words, then the sections
  — each one "[Counsel's text]" until counsel writes it. The leads are the brand's own sentences; the Data sources page
  says what every number stands on, which is ours to say.
==================================================
*/

import { Link, Navigate, useParams } from 'react-router-dom';
import OutsideFrame from './OutsideFrame';
import { COMPANY } from '../../data/company';

interface Doc {
  slug: string;
  title: string;
  lead: string;
  sections: { head: string; body?: string[] }[];
}

const COUNSEL = "[Counsel's text]";

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
    sections: [{ head: 'Options carry risk' }, { head: 'Levels and reads are not advice' }, { head: 'Delayed data' }, { head: 'Practice is not the market' }],
  },
  {
    slug: 'refunds',
    title: 'Refund policy',
    lead: 'We don’t offer refunds. That’s why the terminal is free to try, needs no sign-up, and runs every page. Try it first, and cancel any time in Settings.',
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
          'Live — straight from a licensed feed, as it happens.',
          'Measured — counted from the feed: a volume, a premium, a count of prints.',
          'Derived — worked out from measured numbers with a fixed rule, such as the distance to the flip.',
          'Model — an estimate from a stated method, such as where dealers are positioned.',
        ],
      },
      { head: 'Index prices', body: ['[Vendor] · live once the licence is signed.'] },
      { head: 'Options trades and quotes', body: ['[Vendor] · live once the licence is signed.'] },
      { head: 'Dealer positioning', body: ['Model · the method is written in each page’s guide.'] },
      { head: 'Licences' },
    ],
  },
];

const Legal = () => {
  const { doc = 'terms' } = useParams();
  const page = LEGAL_DOCS.find(d => d.slug === doc);
  if (!page) return <Navigate to="/legal/terms" replace />;
  const words = page.lead.split(/\s+/).length + page.sections.reduce((n, s) => n + (s.body ?? [COUNSEL]).join(' ').split(/\s+/).length + 60, 0);
  return (
    <OutsideFrame testId={`legal-${page.slug}`}>
      <div className="w-full max-w-[880px] mx-auto px-5 sm:px-8 pt-8 pb-20">
        <nav className="flex gap-1.5 flex-wrap" aria-label="Legal">
          {LEGAL_DOCS.map(d => (
            <Link
              key={d.slug}
              to={`/legal/${d.slug}`}
              aria-current={d.slug === page.slug ? 'page' : undefined}
              className={`h-8 px-3.5 inline-flex items-center rounded-full text-[13px] border transition-colors ${
                d.slug === page.slug ? 'border-textPrimary/70 text-textPrimary' : 'border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted'
              }`}
            >
              {d.title}
            </Link>
          ))}
        </nav>
        <h1 className="mt-10 text-[40px] sm:text-[52px] font-light tracking-[-0.04em] leading-[1.04]">{page.title}</h1>
        <p className="mt-3 text-[13px] text-textMuted">Last updated [date] · {Math.max(1, Math.round(words / 200))} min read</p>
        <p className="mt-8 max-w-[62ch] text-[18px] leading-[1.55] text-textPrimary">{page.lead}</p>
        <div className="mt-10 flex flex-col">
          {page.sections.map(s => (
            <section key={s.head} className="py-6 border-t border-borderSubtle">
              <h2 className="text-[20px] font-medium tracking-tight">{s.head}</h2>
              <div className="mt-2.5 flex flex-col gap-2 max-w-[66ch] text-[15.5px] leading-relaxed text-textSecondary">
                {(s.body ?? [s.head === 'Contact' ? `${COUNSEL} Write to ${COMPANY.info}.` : COUNSEL]).map(line => (
                  <p key={line}>{line}</p>
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
