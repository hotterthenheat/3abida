/*
==================================================
  SLAYER TERMINAL - THE ROOM'S TYPES (types/room.ts)
  One room: people, their posts, the setups those
  posts carry and the record the setups build.
  The shapes the room's service will hand back
  once accounts exist; until then the seeds and
  this browser's storage fill them.
==================================================
*/

export type Lean = 'BULLISH' | 'BEARISH';

export interface Person {
  /** without the @ */
  handle: string;
  name: string;
  /** A verified member wears the silver mark */
  verified: boolean;
  followers: number;
  /** One line under the name */
  line: string;
}

export type SetupState = 'OPEN' | 'TARGET HIT' | 'STOPPED';

export interface SetupEvent {
  /** ISO */
  at: string;
  kind: 'STOP MOVED' | 'TRIMMED' | 'TARGET HIT' | 'STOPPED';
  note: string;
}

/** A trade posted with its levels — it settles on the record */
export interface Setup {
  ticker: string;
  lean: Lean;
  entry: number;
  target: number;
  stop: number;
  /** "2 weeks" */
  timeframe: string;
  state: SetupState;
  /** Where it settled, once it has */
  settledAt?: number;
  events: SetupEvent[];
}

export interface Reply {
  id: string;
  handle: string;
  at: string;
  body: string;
}

export interface Post {
  id: string;
  /** A person's handle, or ME for the reader's own */
  handle: string;
  at: string;
  /** Plain text; $NAME and @handle are doors when drawn */
  body: string;
  lean?: Lean;
  setup?: Setup;
  likes: number;
  replies: Reply[];
}

export interface Notice {
  id: string;
  handle: string;
  what: string;
  at: string;
}

/** What this browser keeps: the reader's own posts and their marks */
export interface RoomState {
  posts: Post[];
  liked: string[];
  saved: string[];
  following: string[];
}
