import type { Prefs, Traits } from './traits';

export type Gender = 'woman' | 'man' | 'nonbinary';
export type Interest = 'women' | 'men' | 'everyone';
export type Intention = 'long_term' | 'long_open' | 'short_open' | 'short_fun' | 'friends' | 'unsure';
/** Who may send the first message after a match. */
export type FirstMove = 'me' | 'them' | 'anyone';
/** What someone is on Matchwerk for. Swipes and matches are kept separately per mode. */
export type Mode = 'dating' | 'friends';
export const MODE_LABELS: Record<Mode, string> = { dating: 'Dating', friends: 'Freunde' };

export interface Prompt {
  question: string;
  answer: string;
}

export interface Profile {
  id: string;
  name: string;
  birthdate: string; // ISO yyyy-mm-dd
  gender: Gender;
  interestedIn: Interest;
  bio: string;
  photos: string[];
  prompts: Prompt[];
  interests: string[];
  intention: Intention;
  job?: string;
  school?: string;
  heightCm?: number;
  city?: string;
  lat?: number;
  lng?: number;
  verified: boolean;
  firstMove: FirstMove;
  paused: boolean;
  /** defaults to ['dating'] */
  modes?: Mode[];
  /** optional, more precise gender (e.g. Trans, Genderfluid) */
  genderDetail?: string;
  /** whom someone wants to meet when dating; empty = derived from interestedIn */
  seeking?: Gender[];
  traits?: Traits;
  prefs?: Prefs;
  /** Only on other profiles: distance from me in km */
  distanceKm?: number;
}

export interface Filters {
  minAge: number;
  maxAge: number;
  maxDistanceKm: number;
  intentions: Intention[]; // empty = all
  verifiedOnly: boolean;
}

export type SwipeAction = 'like' | 'pass' | 'superlike';

/** A like that targets a specific photo or prompt, optionally with a comment (Hinge-style). */
export interface LikeNote {
  item?: { kind: 'photo' | 'prompt'; index: number };
  comment?: string;
}

export interface IncomingLike {
  profile: Profile;
  action: SwipeAction;
  note?: LikeNote;
  createdAt: string;
}

export interface Message {
  id: string;
  matchId: string;
  senderId: string;
  text: string;
  createdAt: string;
  /** 'voice' messages carry an audio file instead of (or next to) text */
  kind?: 'text' | 'voice' | 'invite';
  audioPath?: string;
  durationMs?: number;
  /** for 'invite': the activity the match is invited to */
  activityId?: string;
}

/** Longest voice message in seconds. */
export const VOICE_MAX_SECONDS = 60;

export function messagePreview(m: Message): string {
  if (m.kind === 'voice') return '🎤 Sprachnachricht';
  if (m.kind === 'invite') return '🎉 Einladung zu einer Aktivität';
  return m.text;
}

export interface Match {
  id: string;
  mode: Mode;
  profile: Profile;
  createdAt: string;
  /** Who is allowed to open the conversation (resolved from both users' firstMove settings). */
  opener: 'me' | 'them' | 'anyone';
  /** ISO timestamp after which the match expires if nobody has written. */
  expiresAt: string;
  extended: boolean;
  lastMessage?: Message;
  unread: number;
}

export const INTENTION_LABELS: Record<Intention, string> = {
  long_term: 'Feste Beziehung',
  long_open: 'Beziehung, offen für Kurzes',
  short_open: 'Kurzes, offen für Beziehung',
  short_fun: 'Etwas Lockeres',
  friends: 'Neue Freundschaften',
  unsure: 'Weiß ich noch nicht',
};

export const INTENTION_EMOJI: Record<Intention, string> = {
  long_term: '💍',
  long_open: '😍',
  short_open: '🥂',
  short_fun: '🎉',
  friends: '👋',
  unsure: '🤔',
};

export const GENDER_LABELS: Record<Gender, string> = {
  woman: 'Frau',
  man: 'Mann',
  nonbinary: 'Nicht-binär',
};

export const INTEREST_LABELS: Record<Interest, string> = {
  women: 'Frauen',
  men: 'Männer',
  everyone: 'Alle',
};

export const FIRST_MOVE_LABELS: Record<FirstMove, string> = {
  me: 'Ich schreibe zuerst',
  them: 'Mein Match schreibt zuerst',
  anyone: 'Egal – wer zuerst will',
};

export const ALL_INTERESTS = [
  'Reisen', 'Kochen', 'Wandern', 'Yoga', 'Fitness', 'Laufen', 'Klettern', 'Radfahren',
  'Fotografie', 'Kunst', 'Museen', 'Konzerte', 'Festivals', 'Techno', 'Jazz', 'Indie',
  'Lesen', 'Podcasts', 'Filme', 'Serien', 'Gaming', 'Brettspiele', 'Tanzen', 'Theater',
  'Kaffee', 'Wein', 'Craft Beer', 'Brunch', 'Vegan', 'Hunde', 'Katzen', 'Pflanzen',
  'Nachhaltigkeit', 'Startups', 'Tech', 'Mode', 'Design', 'Schreiben', 'Musik machen',
  'Fußball', 'Tennis', 'Schwimmen', 'Surfen', 'Ski', 'Camping', 'Meditation', 'Sprachen',
];

export const PROMPT_QUESTIONS = [
  'Ein perfekter Sonntag sieht so aus …',
  'Ich schwöre, das ist wahr:',
  'Mein Talent, das niemand erwartet:',
  'So gewinnst du mein Herz:',
  'Mein größter Green Flag:',
  'Wir verstehen uns, wenn …',
  'Das Letzte, das mich zum Lachen gebracht hat:',
  'Mein Lieblingsort in der Stadt:',
  'Unpopuläre Meinung:',
  'Unser erstes Date:',
  'Ich suche jemanden, der …',
  'Mein Guilty Pleasure:',
];

export const REPORT_REASONS = [
  'Fake-Profil / Betrug',
  'Unangemessene Fotos',
  'Belästigung oder Beleidigung',
  'Minderjährig',
  'Spam oder Werbung',
  'Gefährliches Verhalten',
  'Sonstiges',
];

export interface Limits {
  tier: 'free' | 'plus' | 'vip';
  premium: boolean;
  premiumUntil?: string;
  /** null = unlimited */
  swipesLeft: number | null;
  /** null = unlimited */
  likesLeft: number | null;
  /** daily free Funken (super-likes) left */
  superlikesLeft: number;
  /** purchased Funken, used after the daily ones */
  funkenCredits: number;
  boostActiveUntil?: string;
  freeBoostAvailable: boolean;
  boostCredits: number;
}

/** Error codes the backend throws when a plan limit is hit (message starts with "LIMIT:"). */
export type LimitReason = 'swipes' | 'likes' | 'superlikes' | 'boost' | 'extend' | 'daily' | 'activities';
export function limitReason(e: unknown): LimitReason | null {
  const m = (e as Error)?.message ?? '';
  const hit = /LIMIT:(\w+)/.exec(m);
  return hit ? (hit[1] as LimitReason) : null;
}

// ───────── Aktivitäten ─────────
export type ActivityCategory = 'coffee' | 'hike' | 'drinks' | 'games' | 'sport' | 'culture' | 'food' | 'other';

export const ACTIVITY_CATEGORIES: { id: ActivityCategory; emoji: string; label: string }[] = [
  { id: 'coffee', emoji: '☕', label: 'Kaffee' },
  { id: 'hike', emoji: '🥾', label: 'Wandern' },
  { id: 'drinks', emoji: '🍻', label: 'Feierabend' },
  { id: 'games', emoji: '🎲', label: 'Spieleabend' },
  { id: 'sport', emoji: '🏃', label: 'Sport' },
  { id: 'culture', emoji: '🎨', label: 'Kultur' },
  { id: 'food', emoji: '🍝', label: 'Essen' },
  { id: 'other', emoji: '✨', label: 'Sonstiges' },
];

export const categoryOf = (id: ActivityCategory) => ACTIVITY_CATEGORIES.find((c) => c.id === id) ?? ACTIVITY_CATEGORIES[7];

/** A short public card of a person in an activity. */
export interface Person {
  id: string;
  name: string;
  photo?: string;
  verified: boolean;
  age: number;
}

export interface Activity {
  id: string;
  category: ActivityCategory;
  title: string;
  description: string;
  startsAt: string;
  place: string;
  city?: string;
  maxPeople: number;
  cancelled: boolean;
  /** own cover photo; otherwise the category picture is shown */
  coverUrl?: string;
  distanceKm?: number;
  host: Person;
  isHost: boolean;
  joined: boolean;
  memberCount: number;
  /** first few members in the list, everyone on the detail screen */
  members: Person[];
  lastMessage?: ActivityMessage;
}

export interface NewActivity {
  category: ActivityCategory;
  title: string;
  description: string;
  startsAt: string;
  place: string;
  maxPeople: number;
  coverUrl?: string;
}

export interface ActivityMessage {
  id: string;
  activityId: string;
  senderId: string;
  text: string;
  createdAt: string;
}
