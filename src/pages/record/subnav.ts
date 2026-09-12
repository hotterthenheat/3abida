import { BarChart3, Building2, CalendarClock, Landmark, Newspaper, type LucideIcon } from 'lucide-react';

/*
  THE RECORD (2026-09-09): what is on the record about a name that never
  appears on the tape — the news, the earnings dates, what the people who run
  a company did with their own shares, what members of Congress reported
  trading. Four pages under one head, read in that order. News and Earnings
  moved here from the top level; Insiders and Congress are the partner's two
  pages (his "Keyhole" and "Disclosures") rebuilt in the house.
*/
export interface RecordSubpage {
  path: string;
  label: string;
  subtitle: string;
  icon: LucideIcon;
  /** Where the page's facts come from, named in the head so the kind of record is never in doubt */
  source: string;
}

export const RECORD_SUBPAGES: RecordSubpage[] = [
  { path: '/record/news', label: 'News', subtitle: 'Every story on the wire today — where it came from, what it does to the name, and the numbers behind it', icon: Newspaper, source: 'Wire' },
  { path: '/record/earnings', label: 'Earnings', subtitle: 'Every upcoming print priced by us — our implied move against what the name typically does', icon: CalendarClock, source: 'Earnings calendar' },
  { path: '/record/insiders', label: 'Insiders', subtitle: 'What the people who run these companies did with their own shares — and whether they chose to', icon: Building2, source: 'SEC Form 4 · filed within two business days of the trade' },
  { path: '/record/congress', label: 'Congress', subtitle: 'What members of Congress reported trading, and how long they took to say so', icon: Landmark, source: 'STOCK Act reports · due within 45 days of the trade' },
  /* Stocks joined the Record (Noah, 2026-09-10): every name and sector screened on the four sleeves — the synthesis, so it reads last */
  { path: '/record/stocks', label: 'Stocks', subtitle: 'Every name and sector screened on momentum, quality, flow and news — the strongest first', icon: BarChart3, source: 'Our screens · momentum, quality, flow, news' },
];
