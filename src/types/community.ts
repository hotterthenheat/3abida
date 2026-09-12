/*
==================================================
  SLAYER TERMINAL - COMMUNITY TYPES (community.ts)
  Trade ideas, feature requests & feedback.
==================================================
*/

export type IdeaDirection = 'BULLISH' | 'BEARISH';

export interface CommunityIdea {
  id: string;
  author: string;
  ticker: string;
  direction: IdeaDirection;
  /** The thesis, in the poster's words */
  thesis: string;
  votes: number;
  /** ISO timestamp */
  createdAt: string;
}

export type RequestKind = 'FEATURE' | 'PRODUCT' | 'IMPROVEMENT';

export type RequestStatus = 'UNDER REVIEW' | 'PLANNED' | 'BUILDING' | 'SHIPPED';

export interface FeatureRequest {
  id: string;
  author: string;
  title: string;
  detail: string;
  kind: RequestKind;
  status: RequestStatus;
  votes: number;
  createdAt: string;
}

export type FeedbackCategory = 'BUG' | 'UX' | 'DATA' | 'OTHER';

export interface FeedbackEntry {
  id: string;
  category: FeedbackCategory;
  message: string;
  createdAt: string;
}
