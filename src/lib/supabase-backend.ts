import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Backend } from './backend';
import type { Filters, IncomingLike, Match, Message, Profile } from './types';

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
    distanceKm: r.distance_km ?? undefined,
  };
}

function fromProfile(p: Profile, id: string): Row {
  return {
    id,
    name: p.name.trim(),
    birthdate: p.birthdate,
    gender: p.gender,
    interested_in: p.interestedIn,
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
  };
}

const toMessage = (r: Row): Message => ({
  id: r.id, matchId: r.match_id, senderId: r.sender_id, text: r.text, createdAt: r.created_at,
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
    profile: toProfile(r.profile),
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    extended: r.extended,
    opener: r.opener,
    lastMessage: r.last_message ? toMessage(r.last_message) : undefined,
    unread: Number(r.unread ?? 0),
  });

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

    async getDeck(f: Filters) {
      const rows = check(await sb.rpc('get_deck', {
        min_age: f.minAge, max_age: f.maxAge, max_km: f.maxDistanceKm,
        intentions: f.intentions, verified_only: f.verifiedOnly, lim: 30,
      })) as Row[];
      return (rows ?? []).map(toProfile);
    },
    async swipe(targetId, action, note) {
      const matchId = check(await sb.rpc('swipe', { target_id: targetId, act: action, note: note ?? null })) as string | null;
      if (!matchId) return {};
      const match = await backend.getMatch(matchId);
      if (match && note?.comment && match.opener !== 'them') {
        await backend.sendMessage(matchId, note.comment).catch(() => {});
      }
      return { match: match ?? undefined };
    },
    async undoSwipe(targetId) {
      check(await sb.rpc('undo_swipe', { target_id: targetId }));
    },
    async getIncomingLikes(): Promise<IncomingLike[]> {
      const rows = check(await sb.rpc('incoming_likes')) as Row[];
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
