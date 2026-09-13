import { Hash, Users, UserRound, type LucideIcon } from 'lucide-react';

/*
  THE COMMUNITY IS ONE ROOM (Noah, 2026-09-13: "remove the requests and
  feedback, this should just be a chat room… I want the community room to feel
  like an actual trading community"). The requests and the feedback left for
  the Feedback page; what remains under Community is the room, a profile, and
  a name's own page. The registry still drives the command palette.
*/
export interface CommunitySubpage {
  path: string;
  label: string;
  subtitle: string;
  icon: LucideIcon;
}

export const COMMUNITY_SUBPAGES: CommunitySubpage[] = [
  { path: '/community', label: 'The room', subtitle: 'Everything happening in the community — quick thoughts and trade setups, newest first', icon: Users },
  { path: '/community/me', label: 'Your profile', subtitle: 'Your setups, your quick thoughts and your trade history', icon: UserRound },
  { path: '/community/t/SPY', label: 'A name in the room', subtitle: 'Everything the room is saying about one ticker', icon: Hash },
];
