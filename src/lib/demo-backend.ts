import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Backend, SwipeResult } from './backend';
import { DEMO_INCOMING_FRIENDS, DEMO_INCOMING_LIKES, DEMO_PROFILES, DEMO_REPLIES } from './demo-data';
import { TIER_LIMITS, type Tier } from './plans';
import type { Filters, IncomingLike, LikeNote, Limits, Match, Message, Mode, Profile, SwipeAction } from './types';
import { MATCH_TTL_HOURS, mutuallyCompatible, passesFilters, resolveOpener, uid } from './utils';

const KEY = 'matchwerk.demo.v1';
const ME = 'me';

interface State {
  signedIn: boolean;
  me: Profile | null;
  swipes: Record<string, SwipeAction>;
  matches: { id: string; userId: string; createdAt: string; extended: boolean; expiresAt: string; lastReadAt: string; mode?: Mode }[];
  messages: Message[];
  blocked: string[];
  /** every swipe of the last 24 h (for the daily limits) */
  likeLog: { at: string; action: SwipeAction; paid?: boolean }[];
  premiumUntil?: string;
  vipUntil?: string;
  funkenCredits?: number;
  boostedUntil?: string;
  lastBoostAt?: string;
  boostCredits: number;
}

const empty = (): State => ({
  signedIn: false, me: null, swipes: {}, matches: [], messages: [], blocked: [], likeLog: [], boostCredits: 0,
});
const DAY = 86_400_000;
/** swipes are stored per mode; dating keeps the plain id for older saved demo data */
const key = (mode: Mode, id: string) => (mode === 'dating' ? id : `${mode}:${id}`);
const hasMode = (p: Profile, mode: Mode) => (p.modes?.length ? p.modes : ['dating']).includes(mode);
const active = (iso?: string) => !!iso && new Date(iso) > new Date();
const tierOf = (s: State): Tier => (active(s.vipUntil) ? 'vip' : active(s.premiumUntil) ? 'plus' : 'free');
const isPremium = (s: State) => tierOf(s) !== 'free';
function usage(s: State) {
  const since = Date.now() - DAY;
  const recent = s.likeLog.filter((l) => new Date(l.at).getTime() > since);
  return {
    total: recent.length,
    likes: recent.filter((l) => l.action !== 'pass').length,
    superlikes: recent.filter((l) => l.action === 'superlike' && !l.paid).length,
  };
}

/**
 * Fully offline backend for demos, App Review and development.
 * Persists to AsyncStorage and simulates replies from matches.
 */
export function createDemoBackend(): Backend {
  let state: State | null = null;
  const authListeners = new Set<(id: string | null) => void>();
  const msgListeners = new Map<string, Set<(m: Message) => void>>();
  const matchListeners = new Set<() => void>();

  async function load(): Promise<State> {
    if (state) return state;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      state = raw ? { ...empty(), ...JSON.parse(raw) } : empty();
    } catch {
      state = empty();
    }
    return state!;
  }
  async function save() {
    if (state) await AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  }
  const others = (s: State) => DEMO_PROFILES.filter((p) => !s.blocked.includes(p.id));
  const profileById = (id: string) => DEMO_PROFILES.find((p) => p.id === id) ?? null;

  function toMatch(s: State, m: State['matches'][number]): Match | null {
    const profile = profileById(m.userId);
    if (!profile) return null;
    const msgs = s.messages.filter((x) => x.matchId === m.id);
    const mode = m.mode ?? 'dating';
    return {
      id: m.id,
      mode,
      profile,
      createdAt: m.createdAt,
      opener: mode === 'friends' ? 'anyone' : resolveOpener(s.me?.firstMove ?? 'anyone', profile.firstMove),
      expiresAt: m.expiresAt,
      extended: m.extended,
      lastMessage: msgs[msgs.length - 1],
      unread: msgs.filter((x) => x.senderId !== ME && x.createdAt > m.lastReadAt).length,
    };
  }

  function emitMessage(msg: Message) {
    msgListeners.get(msg.matchId)?.forEach((cb) => cb(msg));
    matchListeners.forEach((cb) => cb());
  }

  function scheduleReply(matchId: string, delay = 2500, voice = false) {
    setTimeout(async () => {
      const s = await load();
      if (!s.matches.find((m) => m.id === matchId)) return;
      const msg: Message = {
        id: uid(), matchId, senderId: 'other',
        text: voice ? 'Wie schön, deine Stimme zu hören! 😊' : DEMO_REPLIES[Math.floor(Math.random() * DEMO_REPLIES.length)],
        createdAt: new Date().toISOString(),
      };
      s.messages.push(msg);
      await save();
      emitMessage(msg);
    }, delay);
  }

  return {
    mode: 'demo',
    async getSessionUserId() {
      const s = await load();
      return s.signedIn ? ME : null;
    },
    async sendLoginCode() {},
    async verifyLoginCode() {
      const s = await load();
      s.signedIn = true;
      await save();
      authListeners.forEach((cb) => cb(ME));
      return ME;
    },
    async sendPhoneCode() {},
    async verifyPhoneCode(phone) {
      return this.verifyLoginCode(phone, '');
    },
    async signInWithGoogle() {
      return this.verifyLoginCode('google', '');
    },
    async signInWithApple() {
      return this.verifyLoginCode('apple', '');
    },
    async signInWithPassword(email, _password) {
      return this.verifyLoginCode(email, '');
    },
    async signOut() {
      const s = await load();
      s.signedIn = false;
      await save();
      authListeners.forEach((cb) => cb(null));
    },
    async deleteAccount() {
      state = empty();
      await AsyncStorage.removeItem(KEY);
      authListeners.forEach((cb) => cb(null));
    },
    onAuthChange(cb) {
      authListeners.add(cb);
      return () => authListeners.delete(cb);
    },

    async getMyProfile() {
      return (await load()).me;
    },
    async saveMyProfile(p) {
      const s = await load();
      s.me = { ...p, id: ME };
      await save();
      return s.me;
    },
    async uploadPhoto(uri) {
      return uri;
    },
    async getProfile(id) {
      const s = await load();
      return id === ME ? s.me : profileById(id);
    },

    async getDeck(filters: Filters, mode: Mode = 'dating') {
      const s = await load();
      if (!s.me || !hasMode(s.me, mode)) return [];
      return others(s).filter((p) => !s.swipes[key(mode, p.id)] && hasMode(p, mode)
        && (mode === 'friends' || mutuallyCompatible(s.me!, p))
        && passesFilters(p, mode === 'friends' ? { ...filters, intentions: [] } : filters));
    },
    async swipe(targetId: string, action: SwipeAction, _note?: LikeNote, mode: Mode = 'dating'): Promise<SwipeResult> {
      const s = await load();
      const lim = TIER_LIMITS[tierOf(s)];
      const u = usage(s);
      let paid = false;
      if (u.total >= lim.swipesPerDay) throw new Error('LIMIT:swipes');
      if (action !== 'pass' && u.likes >= lim.likesPerDay) throw new Error('LIMIT:likes');
      if (action === 'superlike' && u.superlikes >= lim.funkenPerDay) {
        if (!s.funkenCredits) throw new Error('LIMIT:superlikes');
        s.funkenCredits -= 1;
        paid = true;
      }
      s.likeLog = [...s.likeLog.filter((l) => Date.now() - new Date(l.at).getTime() < DAY), { at: new Date().toISOString(), action, paid }];
      s.swipes[key(mode, targetId)] = action;
      let match: Match | undefined;
      // In the demo, people who liked you match instantly; others match with ~35 % chance.
      const likedMe = (mode === 'friends' ? DEMO_INCOMING_FRIENDS : DEMO_INCOMING_LIKES).some((l) => l.id === targetId);
      const lucky = Number.parseInt(targetId.replace(/\D/g, ''), 10) % 3 === 0;
      if (action !== 'pass' && (likedMe || lucky || action === 'superlike') && !s.matches.some((m) => m.userId === targetId && (m.mode ?? 'dating') === mode)) {
        const now = new Date();
        const rec = {
          id: uid(), userId: targetId, mode, createdAt: now.toISOString(), extended: false, lastReadAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + MATCH_TTL_HOURS * 3_600_000).toISOString(),
        };
        s.matches.unshift(rec);
        match = toMatch(s, rec) ?? undefined;
        if (match?.opener === 'them') {
          scheduleReply(rec.id, 6000);
        }
        if (_note?.comment && match) {
          s.messages.push({ id: uid(), matchId: rec.id, senderId: ME, text: _note.comment, createdAt: now.toISOString() });
        }
        matchListeners.forEach((cb) => cb());
      }
      await save();
      return { match };
    },
    async undoSwipe(targetId, mode: Mode = 'dating') {
      const s = await load();
      delete s.swipes[key(mode, targetId)];
      await save();
    },
    async getIncomingLikes(mode: Mode = 'dating'): Promise<IncomingLike[]> {
      const s = await load();
      if (!s.me || !hasMode(s.me, mode)) return [];
      return (mode === 'friends' ? DEMO_INCOMING_FRIENDS : DEMO_INCOMING_LIKES).filter((l) => !s.swipes[key(mode, l.id)] && !s.blocked.includes(l.id))
        .map((l, i) => ({
          profile: profileById(l.id)!,
          action: 'like' as const,
          note: l.comment ? { comment: l.comment, item: l.item } : undefined,
          createdAt: new Date(Date.now() - (i + 1) * 3_600_000 * 3).toISOString(),
        }))
        .filter((l) => l.profile && (mode === 'friends' ? hasMode(l.profile, 'friends') : mutuallyCompatible(s.me!, l.profile)));
    },

    async getMatches() {
      const s = await load();
      return s.matches
        .map((m) => toMatch(s, m))
        .filter((m): m is Match => !!m)
        .filter((m) => m.lastMessage || new Date(m.expiresAt) > new Date());
    },
    async getMatch(id) {
      const s = await load();
      const m = s.matches.find((x) => x.id === id);
      return m ? toMatch(s, m) : null;
    },
    async extendMatch(id) {
      const s = await load();
      const m = s.matches.find((x) => x.id === id);
      if (!m) return;
      if (m.extended && !isPremium(s)) throw new Error('LIMIT:extend');
      m.extended = true;
      m.expiresAt = new Date(Math.max(new Date(m.expiresAt).getTime(), Date.now()) + 24 * 3_600_000).toISOString();
      await save();
      matchListeners.forEach((cb) => cb());
    },
    async unmatch(id) {
      const s = await load();
      s.matches = s.matches.filter((m) => m.id !== id);
      s.messages = s.messages.filter((m) => m.matchId !== id);
      await save();
      matchListeners.forEach((cb) => cb());
    },
    async getMessages(matchId) {
      const s = await load();
      return s.messages.filter((m) => m.matchId === matchId);
    },
    async sendMessage(matchId, text) {
      const s = await load();
      const msg: Message = { id: uid(), matchId, senderId: ME, text, createdAt: new Date().toISOString() };
      s.messages.push(msg);
      await save();
      emitMessage(msg);
      scheduleReply(matchId);
      return msg;
    },
    async sendVoice(matchId, localUri, durationMs) {
      const s = await load();
      const msg: Message = {
        id: uid(), matchId, senderId: ME, text: '', createdAt: new Date().toISOString(),
        kind: 'voice', audioPath: localUri, durationMs: Math.round(durationMs),
      };
      s.messages.push(msg);
      await save();
      emitMessage(msg);
      scheduleReply(matchId, 2500, true);
      return msg;
    },
    async getVoiceUrl(message) {
      if (!message.audioPath) throw new Error('Keine Audiodatei');
      return message.audioPath;
    },
    async markRead(matchId) {
      const s = await load();
      const m = s.matches.find((x) => x.id === matchId);
      if (m) {
        m.lastReadAt = new Date().toISOString();
        await save();
        matchListeners.forEach((cb) => cb());
      }
    },
    subscribeMessages(matchId, cb) {
      if (!msgListeners.has(matchId)) msgListeners.set(matchId, new Set());
      msgListeners.get(matchId)!.add(cb);
      return () => msgListeners.get(matchId)?.delete(cb);
    },
    subscribeMatches(cb) {
      matchListeners.add(cb);
      return () => matchListeners.delete(cb);
    },

    async getLimits(): Promise<Limits> {
      const s = await load();
      const tier = tierOf(s);
      const lim = TIER_LIMITS[tier];
      const u = usage(s);
      const boostActive = active(s.boostedUntil) ? s.boostedUntil : undefined;
      const left = (max: number, used: number) => (Number.isFinite(max) ? Math.max(0, max - used) : null);
      return {
        tier,
        premium: tier !== 'free',
        premiumUntil: tier === 'vip' ? s.vipUntil : tier === 'plus' ? s.premiumUntil : undefined,
        swipesLeft: left(lim.swipesPerDay, u.total),
        likesLeft: left(lim.likesPerDay, u.likes),
        superlikesLeft: Math.max(0, lim.funkenPerDay - u.superlikes),
        funkenCredits: s.funkenCredits ?? 0,
        boostActiveUntil: boostActive,
        freeBoostAvailable: lim.boostEveryDays !== null && (!s.lastBoostAt || Date.now() - new Date(s.lastBoostAt).getTime() > lim.boostEveryDays * DAY),
        boostCredits: s.boostCredits,
      };
    },
    async activateBoost() {
      const s = await load();
      if (s.boostedUntil && new Date(s.boostedUntil) > new Date()) return s.boostedUntil;
      const until = new Date(Date.now() + 30 * 60_000).toISOString();
      const every = TIER_LIMITS[tierOf(s)].boostEveryDays;
      if (every !== null && (!s.lastBoostAt || Date.now() - new Date(s.lastBoostAt).getTime() > every * DAY)) {
        s.lastBoostAt = new Date().toISOString();
      } else if (s.boostCredits > 0) {
        s.boostCredits -= 1;
      } else {
        throw new Error('LIMIT:boost');
      }
      s.boostedUntil = until;
      await save();
      return until;
    },
    async simulatePurchase(productId) {
      const s = await load();
      const months = /(\d+)m$/.exec(productId)?.[1];
      const amount = Number(/_(\d+)$/.exec(productId)?.[1] ?? 1);
      if (months) {
        const key = productId.includes('vip') ? 'vipUntil' : 'premiumUntil';
        const base = active(s[key]) ? new Date(s[key]!).getTime() : Date.now();
        s[key] = new Date(base + Number(months) * 30 * DAY).toISOString();
      } else if (productId.includes('funken')) {
        s.funkenCredits = (s.funkenCredits ?? 0) + amount;
      } else if (productId.includes('boost')) {
        s.boostCredits += amount;
      }
      await save();
    },

    async block(userId) {
      const s = await load();
      if (!s.blocked.includes(userId)) s.blocked.push(userId);
      const ids = s.matches.filter((m) => m.userId === userId).map((m) => m.id);
      s.matches = s.matches.filter((m) => m.userId !== userId);
      s.messages = s.messages.filter((m) => !ids.includes(m.matchId));
      await save();
      matchListeners.forEach((cb) => cb());
    },
    async report(userId) {
      await this.block(userId);
    },
    async savePushToken() {},
  };
}
