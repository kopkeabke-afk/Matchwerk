import type { Filters, IncomingLike, LikeNote, Match, Message, Profile, SwipeAction } from './types';

export interface SwipeResult {
  match?: Match;
}

/** Everything the UI needs from a backend. Implemented by the demo store and by Supabase. */
export interface Backend {
  readonly mode: 'demo' | 'supabase';
  // auth
  getSessionUserId(): Promise<string | null>;
  sendLoginCode(email: string): Promise<void>;
  verifyLoginCode(email: string, code: string): Promise<string>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
  onAuthChange(cb: (userId: string | null) => void): () => void;
  // profile
  getMyProfile(): Promise<Profile | null>;
  saveMyProfile(p: Profile): Promise<Profile>;
  uploadPhoto(localUri: string): Promise<string>;
  getProfile(id: string): Promise<Profile | null>;
  // discovery
  getDeck(filters: Filters): Promise<Profile[]>;
  swipe(targetId: string, action: SwipeAction, note?: LikeNote): Promise<SwipeResult>;
  undoSwipe(targetId: string): Promise<void>;
  getIncomingLikes(): Promise<IncomingLike[]>;
  // matches & chat
  getMatches(): Promise<Match[]>;
  getMatch(id: string): Promise<Match | null>;
  extendMatch(id: string): Promise<void>;
  unmatch(id: string): Promise<void>;
  getMessages(matchId: string): Promise<Message[]>;
  sendMessage(matchId: string, text: string): Promise<Message>;
  markRead(matchId: string): Promise<void>;
  subscribeMessages(matchId: string, cb: (m: Message) => void): () => void;
  subscribeMatches(cb: () => void): () => void;
  // safety
  block(userId: string): Promise<void>;
  report(userId: string, reason: string, details: string): Promise<void>;
  savePushToken(token: string): Promise<void>;
}
