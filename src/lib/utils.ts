import type { Filters, Gender, Interest, Profile } from './types';

export function ageFrom(birthdate: string, now = new Date()): number {
  const b = new Date(birthdate);
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export function isAdult(birthdate: string): boolean {
  return !Number.isNaN(new Date(birthdate).getTime()) && ageFrom(birthdate) >= 18;
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function wants(interest: Interest, g: Gender): boolean {
  if (interest === 'everyone') return true;
  return (interest === 'women' && g === 'woman') || (interest === 'men' && g === 'man');
}

/** Both sides must be interested in each other's gender. */
export function mutuallyCompatible(me: Profile, other: Profile): boolean {
  return wants(me.interestedIn, other.gender) && wants(other.interestedIn, me.gender);
}

export function passesFilters(other: Profile, f: Filters): boolean {
  const age = ageFrom(other.birthdate);
  if (age < f.minAge || age > f.maxAge) return false;
  if (other.distanceKm != null && other.distanceKm > f.maxDistanceKm) return false;
  if (f.intentions.length && !f.intentions.includes(other.intention)) return false;
  if (f.verifiedOnly && !other.verified) return false;
  return true;
}

const INTENTION_GROUP: Record<string, number> = {
  long_term: 0, long_open: 1, short_open: 2, short_fun: 3, friends: 5, unsure: 2,
};

export interface Compatibility {
  score: number; // 0–100
  reasons: string[];
  shared: string[];
}

/**
 * Transparent compatibility score – shown to users so they understand *why* someone is suggested.
 * Weighted: shared interests 45 %, dating intentions 35 %, distance 10 %, profile quality 10 %.
 */
export function compatibility(me: Profile, other: Profile): Compatibility {
  const shared = other.interests.filter((i) => me.interests.includes(i));
  const reasons: string[] = [];
  const interestScore = Math.min(1, shared.length / 3);
  if (shared.length) reasons.push(`${shared.length} gemeinsame Interessen`);

  const gap = Math.abs((INTENTION_GROUP[me.intention] ?? 2) - (INTENTION_GROUP[other.intention] ?? 2));
  const intentionScore = gap === 0 ? 1 : gap === 1 ? 0.75 : gap === 2 ? 0.45 : 0.15;
  if (gap === 0) reasons.push('Ihr sucht dasselbe');
  else if (gap === 1) reasons.push('Ähnliche Absichten');

  const d = other.distanceKm ?? 25;
  const distScore = d <= 5 ? 1 : d <= 15 ? 0.75 : d <= 40 ? 0.45 : 0.2;
  if (d <= 5) reasons.push('Ganz in deiner Nähe');

  const quality = (other.photos.length >= 3 ? 0.4 : 0.2) + (other.prompts.length >= 2 ? 0.3 : 0.1) + (other.verified ? 0.3 : 0);
  if (other.verified) reasons.push('Verifiziert');

  const score = Math.round(40 + 60 * (0.45 * interestScore + 0.35 * intentionScore + 0.1 * distScore + 0.1 * quality));
  return { score: Math.min(99, score), reasons, shared };
}

/** Personalised conversation starters based on what two profiles have in common. */
export function icebreakers(me: Profile, other: Profile): string[] {
  const out: string[] = [];
  const shared = other.interests.filter((i) => me.interests.includes(i));
  if (shared[0]) out.push(`Wir mögen beide ${shared[0]} – was ist dein absolutes Highlight dabei?`);
  if (shared[1]) out.push(`${shared[1]} oder ${shared[0] ?? 'Kaffee'}: Womit würdest du ein erstes Date planen?`);
  const p = other.prompts[0];
  if (p) out.push(`Zu „${p.question.replace(/[:…]+$/, '')}“ – ${p.answer.length > 40 ? 'erzähl mir die ganze Geschichte!' : 'das will ich genauer wissen 😄'}`);
  out.push(`Hey ${other.name}! Was war heute das Beste an deinem Tag?`);
  out.push('Zwei Wahrheiten und eine Lüge – du fängst an 😉');
  return out.slice(0, 4);
}

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'gerade eben';
  if (s < 3600) return `vor ${Math.floor(s / 60)} Min.`;
  if (s < 86400) return `vor ${Math.floor(s / 3600)} Std.`;
  return `vor ${Math.floor(s / 86400)} T.`;
}

export function hoursLeft(iso: string): number {
  return Math.max(0, (new Date(iso).getTime() - Date.now()) / 3_600_000);
}

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Resolve who may open the chat from both users' preferences. */
export function resolveOpener(mine: Profile['firstMove'], theirs: Profile['firstMove']): 'me' | 'them' | 'anyone' {
  if (mine === 'me' && theirs !== 'me') return 'me';
  if (theirs === 'me' && mine !== 'me') return 'them';
  if (mine === 'them' && theirs !== 'them') return 'them';
  if (theirs === 'them' && mine !== 'them') return 'me';
  return 'anyone';
}

export const MATCH_TTL_HOURS = 48;
export const DEFAULT_FILTERS: Filters = { minAge: 18, maxAge: 45, maxDistanceKm: 50, intentions: [], verifiedOnly: false };
