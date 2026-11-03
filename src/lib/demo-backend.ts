import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Backend, SwipeResult } from './backend';
import { DEMO_INCOMING_LIKES, DEMO_PROFILES, DEMO_REPLIES } from './demo-data';
import type { Filters, IncomingLike, LikeNote, Match, Message, Profile, SwipeAction } from './types';
import { MATCH_TTL_HOURS, mutuallyCompatible, passesFilters, resolveOpener, uid } from './utils';

const KEY = 'funke.demo.v1';
const ME = 'me';

interface State {
  signedIn: boolean;
  me: Profile | null;
  swipes: Record<string, SwipeAction>;
  matches: { id: string; userId: string; createdAt: string; extended: boolean; expiresAt: string; lastReadAt: string }[];
  messages: Message[];
  blocked: string[];
}

const empty = (): State => ({ signedIn: false, me: null, swipes: {}, matches: [], messages: [], blocked: [] });

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
    return {
      id: m.id,
      profile,
      createdAt: m.createdAt,
      opener: resolveOpener(s.me?.firstMove ?? 'anyone', profile.firstMove),
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

  function scheduleReply(matchId: string, delay = 2500) {
    setTimeout(async () => {
      const s = await load();
      if (!s.matches.find((m) => m.id === matchId)) return;
      const msg: Message = {
        id: uid(), matchId, senderId: 'other',
        text: DEMO_REPLIES[Math.floor(Math.random() * DEMO_REPLIES.length)],
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

    async getDeck(filters: Filters) {
      const s = await load();
      if (!s.me) return [];
      return others(s).filter((p) => !s.swipes[p.id] && mutuallyCompatible(s.me!, p) && passesFilters(p, filters));
    },
    async swipe(targetId: string, action: SwipeAction, _note?: LikeNote): Promise<SwipeResult> {
      const s = await load();
      s.swipes[targetId] = action;
      let match: Match | undefined;
      // In the demo, people who liked you match instantly; others match with ~35 % chance.
      const likedMe = DEMO_INCOMING_LIKES.some((l) => l.id === targetId);
      const lucky = Number.parseInt(targetId.replace(/\D/g, ''), 10) % 3 === 0;
      if (action !== 'pass' && (likedMe || lucky || action === 'superlike') && !s.matches.some((m) => m.userId === targetId)) {
        const now = new Date();
        const rec = {
          id: uid(), userId: targetId, createdAt: now.toISOString(), extended: false, lastReadAt: now.toISOString(),
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
    async undoSwipe(targetId) {
      const s = await load();
      delete s.swipes[targetId];
      await save();
    },
    async getIncomingLikes(): Promise<IncomingLike[]> {
      const s = await load();
      if (!s.me) return [];
      return DEMO_INCOMING_LIKES.filter((l) => !s.swipes[l.id] && !s.blocked.includes(l.id))
        .map((l, i) => ({
          profile: profileById(l.id)!,
          action: 'like' as const,
          note: l.comment ? { comment: l.comment, item: l.item } : undefined,
          createdAt: new Date(Date.now() - (i + 1) * 3_600_000 * 3).toISOString(),
        }))
        .filter((l) => l.profile && mutuallyCompatible(s.me!, l.profile));
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
      if (m && !m.extended) {
        m.extended = true;
        m.expiresAt = new Date(new Date(m.expiresAt).getTime() + 24 * 3_600_000).toISOString();
        await save();
        matchListeners.forEach((cb) => cb());
      }
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
