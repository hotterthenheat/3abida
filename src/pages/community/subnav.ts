import { Lightbulb, Hammer, MessageSquare, type LucideIcon } from 'lucide-react';

/** Community subpage registry — drives the sub-tab bar and command palette. */
export interface CommunitySubpage {
  path: string;
  label: string;
  subtitle: string;
  icon: LucideIcon;
}

export const COMMUNITY_SUBPAGES: CommunitySubpage[] = [
  {
    path: '/community/ideas',
    label: 'Ideas',
    subtitle: 'Trade ideas from the community — post yours, vote on theirs',
    icon: Lightbulb,
  },
  {
    path: '/community/requests',
    label: 'Requests',
    subtitle: 'Tell us what to build next — and watch it move to shipped',
    icon: Hammer,
  },
  {
    path: '/community/feedback',
    label: 'Feedback',
    subtitle: 'What should we improve? Every note gets read',
    icon: MessageSquare,
  },
];
