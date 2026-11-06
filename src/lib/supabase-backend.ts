import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Backend } from './backend';
import { appleIdToken, googleIdToken } from './social-auth';
import { interestFrom, seekingOf } from './utils';
import type { Activity, ActivityMessage, Filters, IncomingLike, Limits, Match, Message, Person, Profile } from './types';

type Row = Record<string, any>;

function toProfile(r: Row): Profile {
  return {
    id: r.id,
    name: r.name,
    birthdate: r.birthdate,
    gender: r.gender,
    interestedIn: r.interested_in,
    bio: r.bio ?? '',
    photos: r.photos ?? [],
    prompts: r.prompts ?? [],
    interests: r.interests ?? [],
    intention: r.intention,
    job: r.job ?? undefined,
    school: r.school ?? undefined,
    heightCm: r.height_cm ?? undefined,
    city: r.city ?? undefined,
    lat: r.lat ?? undefined,
    lng: r.lng ?? undefined,
    verified: !!r.verified,
    firstMove: r.first_move ?? 'anyone',
    paused: !!r.paused,
    modes: r.modes ?? ['dating'],
    genderDetail: r.gender_detail ?? undefined,
    seeking: r.seeking?.length ? r.seeking : undefined,
    traits: r.traits ?? {},
    prefs: r.prefs ?? {},
    distanceKm: r.distance_km ?? undefined,
  };
}

function fromProfile(p: Profile, id: string): Row {
  return {
    id,
    name: p.name.trim(),
    birthdate: p.birthdate,
    gender: p.gender,
    interested_in: p.seeking?.length ? interestFrom(p.seeking) : p.interestedIn,
    seeking: p.seeking?.length ? p.seeking : seekingOf(p),
    gender_detail: p.genderDetail || null,
    traits: p.traits ?? {},
    prefs: p.prefs ?? {},
    bio: p.bio,
    photos: p.photos,
    prompts: p.prompts,
    interests: p.interests,
    intention: p.intention,
    job: p.job || null,
    school: p.school || null,
    height_cm: p.heightCm || null,
    city: p.city || null,
    lat: p.lat ?? null,
    lng: p.lng ?? null,
    first_move: p.firstMove,
    paused: p.paused,
    modes: p.modes?.length ? p.modes : ['dating'],
  };
}

const toMessage = (r: Row): Message => ({
  id: r.id, matchId: r.match_id, senderId: r.sender_id, text: r.text ?? '', createdAt: r.created_at,
  kind: r.kind === 'voice' || r.kind === 'invite' ? r.kind : 'text',
  audioPath: r.audio_path ?? undefined,
  durationMs: r.duration_ms ?? undefined,
  activityId: r.activity_id ?? undefined,
});

const toPerson = (r: Row): Person => ({
  id: r.id, name: r.name, photo: r.photo ?? undefined, verified: !!r.verified, age: Number(r.age ?? 0),
});
const toActivityMessage = (r: Row): ActivityMessage => ({
  id: r.id, activityId: r.activity_id, senderId: r.sender_id, text: r.text, createdAt: r.created_at,
});
const toActivity = (r: Row): Activity => ({
  id: r.id, category: r.category, title: r.title, description: r.description ?? '', startsAt: r.starts_at,
  place: r.place, city: r.city ?? undefined, maxPeople: r.max_people, cancelled: !!r.cancelled, coverUrl: r.cover_url ?? undefined,
  distanceKm: r.distance_km ?? undefined, host: toPerson(r.host ?? {}), isHost: !!r.is_host, joined: !!r.joined,
  memberCount: Number(r.member_count ?? 0), members: (r.members ?? []).map(toPerson),
  lastMessage: r.last_message ? toActivityMessage(r.last_message) : undefined,
});

export function createSupabaseBackend(url: string, anonKey: string): Backend {
  const sb: SupabaseClient = createClient(url, anonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  if (Platform.OS !== 'web') {
    AppState.addEventListener('change', (s) => {
      if (s === 'active') sb.auth.startAutoRefresh();
      else sb.auth.stopAutoRefresh();
    });
  }

  const myId = async () => {
    const { data } = await sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new Error('Nicht angemeldet');
    return id;
  };
  const check = <T,>(res: { data: T; error: any }): T => {
    if (res.error) throw new Error(res.error.message);
    return res.data;
  };

  const mapMatch = (r: Row): Match => ({
    id: r.id,
    mode: r.mode ?? 'dating',
    profile: toProfile(r.profile),
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    extended: r.extended,
    opener: r.opener,
    lastMessage: r.last_message ? toMessage(r.last_message) : undefined,
    unread: Number(r.unread ?? 0),
  });

  /** Removes the voice files I sent (in one match, or everywhere). Best effort. */
  async function removeMyVoice(matchId?: string) {
    const id = await myId();
    let q = sb.from('messages').select('audio_path').eq('sender_id', id).eq('kind', 'voice');
    if (matchId) q = q.eq('match_id', matchId);
    const { data } = await q.limit(1000);
    const paths = (data ?? []).map((r: Row) => r.audio_path).filter(Boolean);
    if (paths.length) await sb.storage.from('voice').remove(paths);
  }

  const backend: Backend = {
    mode: 'supabase',
    async getSessionUserId() {
      const { data } = await sb.auth.getSession();
      return data.session?.user.id ?? null;
    },
    async sendLoginCode(email) {
      check(await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }));
    },
    async verifyLoginCode(email, code) {
      const data = check(await sb.auth.verifyOtp({ email, token: code, type: 'email' }));
      return data.user!.id;
    },
    async sendPhoneCode(phone) {
      check(await sb.auth.signInWithOtp({ phone }));
    },
    async verifyPhoneCode(phone, code) {
      const data = check(await sb.auth.verifyOtp({ phone, token: code, type: 'sms' }));
      return data.user!.id;
    },
    async signInWithGoogle() {
      const token = await googleIdToken();
      if (!token) return null;
      const { data, error } = await sb.auth.signInWithIdToken({ provider: 'google', token });
      if (error || !data.user) throw new Error(error?.message ?? 'Google-Anmeldung fehlgeschlagen');
      return data.user.id;
    },
    async signInWithApple() {
      const res = await appleIdToken();
      if (!res) return null;
      const { data, error } = await sb.auth.signInWithIdToken({ provider: 'apple', token: res.token, nonce: res.nonce });
      if (error || !data.user) throw new Error(error?.message ?? 'Apple-Anmeldung fehlgeschlagen');
      return data.user.id;
    },
    async signInWithPassword(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error || !data.user) throw new Error(error?.message ?? 'Anmeldung fehlgeschlagen');
      return data.user.id;
    },
    async signOut() {
      await sb.auth.signOut();
    },
    async deleteAccount() {
      const id = await myId();
      const files = check(await sb.storage.from('photos').list(id, { limit: 100 }));
      if (files?.length) await sb.storage.from('photos').remove(files.map((f) => `${id}/${f.name}`));
      await removeMyVoice().catch(() => {});
      check(await sb.rpc('delete_account'));
      await sb.auth.signOut();
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, session) => cb(session?.user.id ?? null));
      return () => data.subscription.unsubscribe();
    },

    async getMyProfile() {
      const id = await myId();
      const row = check(await sb.from('profiles').select('*').eq('id', id).maybeSingle());
      return row ? toProfile(row) : null;
    },
    async saveMyProfile(p) {
      const id = await myId();
      const row = check(await sb.from('profiles').upsert(fromProfile(p, id)).select('*').single());
      return toProfile(row);
    },
    async uploadPhoto(localUri) {
      const id = await myId();
      const res = await fetch(localUri);
      const body = await res.arrayBuffer();
      const path = `${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      check(await sb.storage.from('photos').upload(path, body, { contentType: 'image/jpeg', upsert: false }));
      return sb.storage.from('photos').getPublicUrl(path).data.publicUrl;
    },
    async getProfile(id) {
      const row = check(await sb.from('profiles').select('*').eq('id', id).maybeSingle());
      return row ? toProfile(row) : null;
    },

    async getDeck(f: Filters, mode = 'dating') {
      const rows = check(await sb.rpc('get_deck', {
        min_age: f.minAge, max_age: f.maxAge, max_km: f.maxDistanceKm,
        intentions: f.intentions, verified_only: f.verifiedOnly, lim: 30, mode,
      })) as Row[];
      return (rows ?? []).map(toProfile);
    },
    async swipe(targetId, action, note, mode = 'dating') {
      const matchId = check(await sb.rpc('swipe', { target_id: targetId, act: action, note: note ?? null, mode })) as string | null;
      if (!matchId) return {};
      const match = await backend.getMatch(matchId);
      if (match && note?.comment && match.opener !== 'them') {
        await backend.sendMessage(matchId, note.comment).catch(() => {});
      }
      return { match: match ?? undefined };
    },
    async undoSwipe(targetId, mode = 'dating') {
      check(await sb.rpc('undo_swipe', { target_id: targetId, mode }));
    },
    async getIncomingLikes(mode = 'dating'): Promise<IncomingLike[]> {
      const rows = check(await sb.rpc('incoming_likes', { mode })) as Row[];
      return (rows ?? []).map((r) => ({
        profile: toProfile(r.profile), action: r.action, note: r.note ?? undefined, createdAt: r.created_at,
      }));
    },

    async getMatches() {
      const rows = check(await sb.rpc('my_matches')) as Row[];
      return (rows ?? []).map(mapMatch);
    },
    async getMatch(id) {
      const rows = check(await sb.rpc('my_matches')) as Row[];
      const r = rows?.find((x) => x.id === id);
      return r ? mapMatch(r) : null;
    },
    async extendMatch(id) {
      check(await sb.rpc('extend_match', { match_id: id }));
    },
    async unmatch(id) {
      await removeMyVoice(id).catch(() => {});
      check(await sb.rpc('unmatch', { match_id: id }));
    },
    async getMessages(matchId) {
      const rows = check(await sb.from('messages').select('*').eq('match_id', matchId).order('created_at').limit(500));
      return (rows ?? []).map(toMessage);
    },
    async sendMessage(matchId, text) {
      const id = await myId();
      const row = check(await sb.from('messages').insert({ match_id: matchId, sender_id: id, text }).select('*').single());
      return toMessage(row);
    },
    async sendVoice(matchId, localUri, durationMs) {
      const id = await myId();
      const res = await fetch(localUri);
      const body = await res.arrayBuffer();
      const ext = localUri.split('?')[0].split('.').pop()?.toLowerCase();
      const type = ext === 'webm' ? 'audio/webm' : ext === 'mp3' ? 'audio/mpeg' : 'audio/mp4';
      const path = `${matchId}/${id}/${Date.now()}.${ext && ext.length <= 4 ? ext : 'm4a'}`;
      check(await sb.storage.from('voice').upload(path, body, { contentType: type, upsert: false }));
      const row = check(await sb.from('messages').insert({
        match_id: matchId, sender_id: id, text: '', kind: 'voice', audio_path: path,
        duration_ms: Math.min(Math.round(durationMs), 61000),
      }).select('*').single());
      return toMessage(row);
    },
    async getVoiceUrl(message) {
      if (!message.audioPath) throw new Error('Keine Audiodatei');
      const { data, error } = await sb.storage.from('voice').createSignedUrl(message.audioPath, 3600);
      if (error || !data) throw new Error('Sprachnachricht konnte nicht geladen werden');
      return data.signedUrl;
    },
    async getActivities(maxKm) {
      const rows = check(await sb.rpc('get_activities', { max_km: maxKm }));
      return ((rows ?? []) as Row[]).map(toActivity);
    },
    async getActivity(id) {
      const row = check(await sb.rpc('get_activity', { aid: id }));
      return row ? toActivity(row as Row) : null;
    },
    async createActivity(a) {
      return check(await sb.rpc('create_activity', {
        category: a.category, title: a.title, description: a.description, starts_at: a.startsAt,
        place: a.place, max_people: a.maxPeople, cover_url: a.coverUrl ?? null,
      })) as string;
    },
    async joinActivity(id) {
      check(await sb.rpc('join_activity', { aid: id }));
    },
    async leaveActivity(id) {
      check(await sb.rpc('leave_activity', { aid: id }));
    },
    async cancelActivity(id) {
      check(await sb.rpc('cancel_activity', { aid: id }));
    },
    async removeActivityMember(id, userId) {
      check(await sb.rpc('remove_activity_member', { aid: id, uid: userId }));
    },
    async getPersonActivities(userId) {
      const rows = check(await sb.rpc('person_activities', { uid: userId }));
      return ((rows ?? []) as Row[]).map(toActivity);
    },
    async sendInvite(matchId, activityId, text) {
      const id = await myId();
      const row = check(await sb.from('messages').insert({ match_id: matchId, sender_id: id, text, kind: 'invite', activity_id: activityId }).select('*').single());
      return toMessage(row);
    },
    async getActivityMessages(id) {
      const rows = check(await sb.from('activity_messages').select('*').eq('activity_id', id).order('created_at').limit(500));
      return (rows ?? []).map(toActivityMessage);
    },
    async sendActivityMessage(id, text) {
      const me = await myId();
      const row = check(await sb.from('activity_messages').insert({ activity_id: id, sender_id: me, text }).select('*').single());
      return toActivityMessage(row);
    },
    subscribeActivityMessages(id, cb) {
      const ch = sb
        .channel(`activity:${id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_messages', filter: `activity_id=eq.${id}` },
          (payload) => cb(toActivityMessage(payload.new as Row)))
        .subscribe();
      return () => { sb.removeChannel(ch); };
    },
    async markRead(matchId) {
      await sb.rpc('mark_read', { match_id: matchId });
    },
    subscribeMessages(matchId, cb) {
      const ch = sb
        .channel(`messages:${matchId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
          (payload) => cb(toMessage(payload.new as Row)))
        .subscribe();
      return () => { sb.removeChannel(ch); };
    },
    subscribeMatches(cb) {
      const ch = sb
        .channel(`matches:${Math.random()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => cb())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => cb())
        .subscribe();
      return () => { sb.removeChannel(ch); };
    },

    async getLimits(): Promise<Limits> {
      const r = check(await sb.rpc('my_limits')) as Row;
      return {
        tier: r.tier ?? (r.premium ? 'plus' : 'free'),
        premium: !!r.premium,
        premiumUntil: r.premium_until ?? undefined,
        swipesLeft: r.swipes_left ?? null,
        likesLeft: r.likes_left ?? null,
        superlikesLeft: r.superlikes_left ?? 0,
        funkenCredits: r.funken_credits ?? 0,
        boostActiveUntil: r.boost_active_until ?? undefined,
        freeBoostAvailable: !!r.free_boost_available,
        boostCredits: r.boost_credits ?? 0,
      };
    },
    async activateBoost() {
      return check(await sb.rpc('activate_boost')) as string;
    },

    async block(userId) {
      check(await sb.rpc('block_user', { target_id: userId }));
    },
    async report(userId, reason, details) {
      const id = await myId();
      check(await sb.from('reports').upsert(
        { reporter: id, reported: userId, reason, details },
        { onConflict: 'reporter,reported', ignoreDuplicates: true },
      ));
      await backend.block(userId);
    },
    async savePushToken(token) {
      const id = await myId();
      await sb.from('push_tokens').upsert({ user_id: id, token, updated_at: new Date().toISOString() });
    },
  };
  return backend;
}
