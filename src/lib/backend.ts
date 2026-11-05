import type { Filters, IncomingLike, LikeNote, Limits, Match, Message, Mode, Profile, SwipeAction } from './types';

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
  /** Password login – used for the App Review test account. */
  signInWithPassword(email: string, password: string): Promise<string>;
  /** SMS login (Supabase phone auth, needs an SMS provider like Twilio). Phone in E.164, e.g. +4915112345678 */
  sendPhoneCode(phone: string): Promise<void>;
  verifyPhoneCode(phone: string, code: string): Promise<string>;
  /** Native Google / Apple sign-in; resolves null if the user cancelled. */
  signInWithGoogle(): Promise<string | null>;
  signInWithApple(): Promise<string | null>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
  onAuthChange(cb: (userId: string | null) => void): () => void;
  // profile
  getMyProfile(): Promise<Profile | null>;
  saveMyProfile(p: Profile): Promise<Profile>;
  uploadPhoto(localUri: string): Promise<string>;
  getProfile(id: string): Promise<Profile | null>;
  // discovery
  getDeck(filters: Filters, mode?: Mode): Promise<Profile[]>;
  swipe(targetId: string, action: SwipeAction, note?: LikeNote, mode?: Mode): Promise<SwipeResult>;
  undoSwipe(targetId: string, mode?: Mode): Promise<void>;
  getIncomingLikes(mode?: Mode): Promise<IncomingLike[]>;
  // matches & chat
  getMatches(): Promise<Match[]>;
  getMatch(id: string): Promise<Match | null>;
  extendMatch(id: string): Promise<void>;
  unmatch(id: string): Promise<void>;
  getMessages(matchId: string): Promise<Message[]>;
  sendMessage(matchId: string, text: string): Promise<Message>;
  /** Uploads a recorded audio file (local uri) and sends it as a voice message. */
  sendVoice(matchId: string, localUri: string, durationMs: number): Promise<Message>;
  /** A playable url for a voice message (signed, short-lived on the server). */
  getVoiceUrl(message: Message): Promise<string>;
  markRead(matchId: string): Promise<void>;
  subscribeMessages(matchId: string, cb: (m: Message) => void): () => void;
  subscribeMatches(cb: () => void): () => void;
  // premium
  getLimits(): Promise<Limits>;
  activateBoost(): Promise<string>;
  /** Demo mode only: pretend a store purchase succeeded. */
  simulatePurchase?(productId: string): Promise<void>;
  // safety
  block(userId: string): Promise<void>;
  report(userId: string, reason: string, details: string): Promise<void>;
  savePushToken(token: string): Promise<void>;
}
