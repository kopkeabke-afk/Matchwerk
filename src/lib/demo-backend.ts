import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Backend, SwipeResult } from './backend';
import { DEMO_INCOMING_FRIENDS, DEMO_INCOMING_LIKES, DEMO_PROFILES, DEMO_REPLIES } from './demo-data';
import { TIER_LIMITS, type Tier } from './plans';
import type { Activity, ActivityCategory, ActivityMessage, Filters, IncomingLike, LikeNote, Limits, Match, Message, Mode, Person, Profile, SwipeAction } from './types';
import { ageFrom, MATCH_TTL_HOURS, mutuallyCompatible, passesFilters, passesPrefs, resolveOpener, uid } from './utils';

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
  activities?: DemoActivity[];
  activityMessages?: ActivityMessage[];
}

interface DemoActivity {
  id: string; hostId: string; category: ActivityCategory; title: string; description: string; startsAt: string;
  place: string; city?: string; maxPeople: number; cancelled: boolean; distanceKm: number; memberIds: string[]; coverUrl?: string;
}

const HOST_LIMIT: Record<Tier, number> = { free: 1, plus: 5, vip: 10 };

/** A few example activities around the demo profiles, relative to "now". */
function seedActivities(): DemoActivity[] {
  const at = (days: number, h: number, m = 0) => {
    const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, m, 0, 0); return d.toISOString();
  };
  const ids = DEMO_PROFILES.map((p) => p.id);
  const pick = (...i: number[]) => i.map((x) => ids[x % ids.length]);
  const A = (id: string, category: ActivityCategory, title: string, description: string, startsAt: string, place: string,
    maxPeople: number, distanceKm: number, members: string[]): DemoActivity =>
    ({ id, hostId: members[0], category, title, description, startsAt, place, city: 'Berlin', maxPeople, cancelled: false, distanceKm, memberIds: members });
  return [
    A('act-1', 'hike', 'Sonntagswanderung am Grunewald', 'Gemütliche 12 km, Picknick an der Havel. Jedes Tempo willkommen.', at(2, 10), 'S-Bahnhof Grunewald', 8, 6, pick(3, 7, 12)),
    A('act-2', 'games', 'Spieleabend: Catan & Co.', 'Ich bringe Catan, Codenames und Wingspan mit. Snacks gern mitbringen.', at(1, 19), 'Café Spielwiese, Kreuzberg', 6, 3, pick(5, 9)),
    A('act-3', 'coffee', 'Kaffee & Flohmarkt', 'Erst Flat White, dann über den Mauerpark-Flohmarkt schlendern.', at(3, 11), 'Mauerpark, Haupteingang', 5, 2, pick(1, 14, 20, 22)),
    A('act-4', 'drinks', 'Feierabendbier am Kanal', 'Lockere Runde nach der Arbeit – einfach vorbeikommen.', at(0, 19, 30), 'Admiralbrücke', 10, 4, pick(8, 16, 18, 2, 11)),
    A('act-5', 'sport', 'Laufgruppe Tempelhofer Feld', '5–7 km, ruhiges Tempo (6:00 min/km). Danach Kaffee.', at(4, 8), 'Eingang Columbiadamm', 12, 7, pick(10, 4)),
  ].filter((a) => new Date(a.startsAt) > new Date());
}

const GROUP_REPLIES = ['Super, freu mich! 🙌', 'Bin dabei – bring noch Kekse mit 🍪', 'Wer ist zum ersten Mal dabei?', 'Treffpunkt wie beschrieben, ich hab eine gelbe Jacke an.', 'Klingt gut! Bis dann 👋'];

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

  const actListeners = new Map<string, Set<(m: ActivityMessage) => void>>();

  function person(id: string, s: State): Person | null {
    if (id === ME) return s.me ? { id: ME, name: s.me.name, photo: s.me.photos[0], verified: s.me.verified, age: ageFrom(s.me.birthdate) } : null;
    const p = profileById(id);
    return p && !s.blocked.includes(id) ? { id, name: p.name, photo: p.photos[0], verified: p.verified, age: ageFrom(p.birthdate) } : null;
  }

  function activities(s: State): DemoActivity[] {
    if (!s.activities) s.activities = seedActivities();
    return s.activities;
  }

  function toActivity(s: State, a: DemoActivity, all: boolean): Activity {
    const members = a.memberIds.map((id) => person(id, s)).filter((x): x is Person => !!x);
    const msgs = (s.activityMessages ?? []).filter((m) => m.activityId === a.id);
    return {
      id: a.id, category: a.category, title: a.title, description: a.description, startsAt: a.startsAt, place: a.place,
      city: a.city, maxPeople: a.maxPeople, cancelled: a.cancelled, distanceKm: a.distanceKm, coverUrl: a.coverUrl,
      host: person(a.hostId, s) ?? { id: a.hostId, name: '?', verified: false, age: 0 },
      isHost: a.hostId === ME, joined: a.memberIds.includes(ME), memberCount: a.memberIds.length,
      members: all ? members : members.slice(0, 5), lastMessage: msgs[msgs.length - 1],
    };
  }

  function visible(s: State, a: DemoActivity) {
    return !s.blocked.includes(a.hostId);
  }

  function emitActivityMessage(m: ActivityMessage) {
    actListeners.get(m.activityId)?.forEach((cb) => cb(m));
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
        && (mode === 'friends' || (mutuallyCompatible(s.me!, p) && passesPrefs(s.me!, p) && passesPrefs(p, s.me!)))
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
    async getActivities(maxKm) {
      const s = await load();
      const list = activities(s).filter((a) => visible(s, a)
        && new Date(a.startsAt).getTime() > Date.now() - DAY
        && (a.hostId === ME || a.memberIds.includes(ME) || (!a.cancelled && new Date(a.startsAt) > new Date() && a.distanceKm <= maxKm)));
      await save();
      const mine = (a: DemoActivity) => (a.hostId === ME || a.memberIds.includes(ME) ? 0 : 1);
      return list.sort((x, y) => mine(x) - mine(y) || x.startsAt.localeCompare(y.startsAt)).map((a) => toActivity(s, a, false));
    },
    async getActivity(id) {
      const s = await load();
      const a = activities(s).find((x) => x.id === id);
      if (!a || !visible(s, a) || (a.cancelled && !a.memberIds.includes(ME))) return null;
      return toActivity(s, a, true);
    },
    async createActivity(input) {
      const s = await load();
      const start = new Date(input.startsAt).getTime();
      if (start < Date.now() + 15 * 60_000 || start > Date.now() + 60 * DAY) throw new Error('Wähle einen Termin in den nächsten 60 Tagen.');
      const hosting = activities(s).filter((a) => a.hostId === ME && !a.cancelled && new Date(a.startsAt) > new Date()).length;
      if (hosting >= HOST_LIMIT[tierOf(s)]) throw new Error('LIMIT:activities');
      const a: DemoActivity = {
        id: uid(), hostId: ME, category: input.category, title: input.title.trim(), description: input.description.trim(),
        startsAt: input.startsAt, place: input.place.trim(), city: s.me?.city, maxPeople: input.maxPeople, cancelled: false,
        distanceKm: 0, memberIds: [ME], coverUrl: input.coverUrl,
      };
      s.activities!.push(a);
      await save();
      // someone nearby joins after a moment, so the group chat comes alive in the demo
      setTimeout(async () => {
        const st = await load();
        const x = st.activities?.find((y) => y.id === a.id);
        const guest = others(st).find((p) => !x?.memberIds.includes(p.id));
        if (x && guest && !x.cancelled && x.memberIds.length < x.maxPeople) {
          x.memberIds.push(guest.id);
          const msg: ActivityMessage = { id: uid(), activityId: a.id, senderId: guest.id, text: `Hi, ich bin ${guest.name} – bin dabei! 🙌`, createdAt: new Date().toISOString() };
          (st.activityMessages ??= []).push(msg);
          await save();
          emitActivityMessage(msg);
        }
      }, 4000);
      return a.id;
    },
    async joinActivity(id) {
      const s = await load();
      const a = activities(s).find((x) => x.id === id);
      if (!a || !visible(s, a)) throw new Error('Diese Aktivität gibt es nicht mehr.');
      if (a.memberIds.includes(ME)) return;
      if (a.cancelled) throw new Error('Diese Aktivität wurde abgesagt.');
      if (new Date(a.startsAt) < new Date()) throw new Error('Diese Aktivität hat schon begonnen.');
      if (a.memberIds.length >= a.maxPeople) throw new Error('Diese Aktivität ist schon voll.');
      a.memberIds.push(ME);
      await save();
    },
    async leaveActivity(id) {
      const s = await load();
      const a = activities(s).find((x) => x.id === id);
      if (!a) return;
      if (a.hostId === ME) throw new Error('Als Gastgeber:in kannst du die Aktivität absagen.');
      a.memberIds = a.memberIds.filter((m) => m !== ME);
      await save();
    },
    async cancelActivity(id) {
      const s = await load();
      const a = activities(s).find((x) => x.id === id && x.hostId === ME);
      if (!a) throw new Error('Nur die Gastgeberin oder der Gastgeber kann absagen.');
      a.cancelled = true;
      await save();
    },
    async removeActivityMember(id, userId) {
      const s = await load();
      const a = activities(s).find((x) => x.id === id && x.hostId === ME);
      if (!a) throw new Error('Nur die Gastgeberin oder der Gastgeber kann Personen entfernen.');
      a.memberIds = a.memberIds.filter((m) => m !== userId || m === ME);
      await save();
    },
    async getPersonActivities(userId) {
      const s = await load();
      return activities(s)
        .filter((a) => visible(s, a) && !a.cancelled && new Date(a.startsAt) > new Date() && a.memberIds.includes(userId))
        .sort((x, y) => x.startsAt.localeCompare(y.startsAt)).slice(0, 5).map((a) => toActivity(s, a, false));
    },
    async sendInvite(matchId, activityId, text) {
      const s = await load();
      const a = activities(s).find((x) => x.id === activityId);
      if (!a || a.cancelled || new Date(a.startsAt) < new Date()) throw new Error('Zu dieser Aktivität kannst du nicht einladen.');
      const msg: Message = { id: uid(), matchId, senderId: ME, text, createdAt: new Date().toISOString(), kind: 'invite', activityId };
      s.messages.push(msg);
      await save();
      emitMessage(msg);
      setTimeout(async () => {
        const st = await load();
        if (!st.matches.find((m) => m.id === matchId)) return;
        const reply: Message = { id: uid(), matchId, senderId: 'other', text: 'Oh ja, da komm ich gern mit! 😍', createdAt: new Date().toISOString() };
        st.messages.push(reply);
        await save();
        emitMessage(reply);
      }, 2500);
      return msg;
    },
    async getActivityMessages(id) {
      const s = await load();
      const a = activities(s).find((x) => x.id === id);
      if (!a?.memberIds.includes(ME)) return [];
      return (s.activityMessages ?? []).filter((m) => m.activityId === id && !s.blocked.includes(m.senderId));
    },
    async sendActivityMessage(id, text) {
      const s = await load();
      const a = activities(s).find((x) => x.id === id);
      if (!a?.memberIds.includes(ME)) throw new Error('Tritt der Aktivität bei, um mitzuschreiben.');
      if (a.cancelled) throw new Error('Diese Aktivität ist beendet.');
      const msg: ActivityMessage = { id: uid(), activityId: id, senderId: ME, text, createdAt: new Date().toISOString() };
      (s.activityMessages ??= []).push(msg);
      await save();
      emitActivityMessage(msg);
      const other = a.memberIds.find((m) => m !== ME);
      if (other) {
        setTimeout(async () => {
          const st = await load();
          const reply: ActivityMessage = {
            id: uid(), activityId: id, senderId: other, createdAt: new Date().toISOString(),
            text: GROUP_REPLIES[Math.floor(Math.random() * GROUP_REPLIES.length)],
          };
          (st.activityMessages ??= []).push(reply);
          await save();
          emitActivityMessage(reply);
        }, 2500);
      }
      return msg;
    },
    subscribeActivityMessages(id, cb) {
      if (!actListeners.has(id)) actListeners.set(id, new Set());
      actListeners.get(id)!.add(cb);
      return () => actListeners.get(id)?.delete(cb);
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
