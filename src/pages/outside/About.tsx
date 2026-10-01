/*
==================================================
  SLAYER TERMINAL - ABOUT (/about)

  Who we are, in the Logo System's own words: the 100-word boilerplate (09 · Voice), the products one line each, and
  where to write. Nothing here is a claim the terminal cannot back.
==================================================
*/

import { Link } from 'react-router-dom';
import OutsideFrame from './OutsideFrame';
import ProductGlyph from '../../brand/ProductGlyph';
import { PRODUCT_GROUPS } from '../../brand/products';
import { COMPANY } from '../../data/company';

const About = () => (
  <OutsideFrame testId="about">
    <div className="w-full max-w-[960px] mx-auto px-5 sm:px-8 pt-10 pb-20">
      <p className="text-[13px] text-textMuted">About</p>
      <span className="mt-2.5 block w-10 h-[3px] rounded-full bg-silver" aria-hidden />
      <h1 className="mt-5 text-[40px] sm:text-[56px] font-light tracking-[-0.04em] leading-[1.02]">
        Trade what you can <span className="font-medium">see.</span>
      </h1>
      <div className="mt-8 max-w-[62ch] flex flex-col gap-4 text-[17px] leading-[1.6] text-textSecondary">
        <p>
          Most of what moves a price is public, just scattered. Slayer Terminal gathers it into one terminal: the prints, the positions, the levels, the filings.
        </p>
        <p>
          Pulse is the live desk, arranged your way. Trace reads the live tape: dark pool, net flow, footprints. Dossier is the full file on a ticker. Pinpoint shows
          where dealer hedging holds and pushes price. Compass finds contracts that fit the levels; Weigher shows what each returns at every price.
        </p>
        <p>Practice lets you trade with paper money, replay the past and review every trade. It says what every number stands on.</p>
      </div>
      <div className="mt-8 flex items-center gap-4 flex-wrap">
        <Link to="/signup" className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-textPrimary text-canvas text-[14px] font-medium whitespace-nowrap hover:bg-textPrimary/90" data-about-signup>
          Sign up free
        </Link>
        <a href={`mailto:${COMPANY.info}`} className="text-[14px] text-textSecondary hover:text-textPrimary underline decoration-borderMuted underline-offset-4">
          {COMPANY.info}
        </a>
      </div>

      <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-8 border-t border-borderSubtle pt-10">
        {PRODUCT_GROUPS.map(g => (
          <div key={g.caption}>
            <p className="text-[11px] uppercase tracking-[0.14em] text-textMuted">{g.caption}</p>
            <ul className="mt-3 flex flex-col gap-3">
              {g.products.map(p => (
                <li key={p.name} className="flex items-start gap-3">
                  <ProductGlyph name={p.glyph} size={24} bare className="shrink-0" />
                  <span>
                    <span className="block text-[15px] font-medium text-textPrimary">{p.name}</span>
                    <span className="block text-[13.5px] leading-snug text-textSecondary">{p.line}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  </OutsideFrame>
);

export default About;
