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

const ALL_GENDERS: Gender[] = ['woman', 'man', 'nonbinary'];

/** Whom someone wants to meet: the explicit choice, or derived from the older single setting. */
export function seekingOf(p: Pick<Profile, 'seeking' | 'interestedIn'>): Gender[] {
  if (p.seeking?.length) return p.seeking;
  return p.interestedIn === 'women' ? ['woman'] : p.interestedIn === 'men' ? ['man'] : ALL_GENDERS;
}

/** The older single setting, kept in sync for compatibility. */
export function interestFrom(seeking: Gender[]): Interest {
  if (seeking.length === 1 && seeking[0] === 'woman') return 'women';
  if (seeking.length === 1 && seeking[0] === 'man') return 'men';
  return 'everyone';
}

/** Both sides must be interested in each other's gender. */
export function mutuallyCompatible(me: Profile, other: Profile): boolean {
  return seekingOf(me).includes(other.gender) && seekingOf(other).includes(me.gender);
}

/** Dealbreakers from "Was dir wichtig ist" – checked in both directions. */
export function passesPrefs(viewer: Profile, cand: Profile): boolean {
  const p = viewer.prefs;
  if (!p) return true;
  const h = cand.heightCm;
  if (h && p.heightMin && h < p.heightMin) return false;
  if (h && p.heightMax && h > p.heightMax) return false;
  if (p.nonSmokerOnly && cand.traits?.smoking && cand.traits.smoking !== 'never') return false;
  const a = viewer.traits?.kidsWish;
  const b = cand.traits?.kidsWish;
  if (p.kidsMatch && a && b && ((a === 'want' && b === 'no') || (a === 'no' && b === 'want'))) return false;
  return true;
}

export function passesFilters(other: Profile, f: Filters): boolean {
  const age = ageFrom(other.birthdate);
  if (age < f.minAge || age > f.maxAge) return false;
  if (other.distanceKm != null && other.distanceKm > f.maxDistanceKm) return false;
  if (f.intentions.length && !f.intentions.includes(other.intention)) return false;
  if (f.verifiedOnly && !other.verified) return false;
  return true;
}

export { compatibility, type Compatibility } from './match';

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

/** Sensible starting filters for every age: roughly ±10 years (narrower for the youngest), 60 km for rural areas. */
export function defaultFiltersFor(birthdate?: string): Filters {
  if (!birthdate) return DEFAULT_FILTERS;
  const age = ageFrom(birthdate);
  const below = age < 25 ? 4 : age < 35 ? 7 : 10;
  return {
    ...DEFAULT_FILTERS,
    minAge: Math.max(18, age - below),
    maxAge: Math.min(99, age + (age < 25 ? 7 : 10)),
    maxDistanceKm: 60,
  };
}

/** "Heute, 19:00" · "Morgen, 10:30" · "Sa., 14. Nov., 11:00" */
export function formatWhen(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / 86_400_000);
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (diff === 0) return `Heute, ${time}`;
  if (diff === 1) return `Morgen, ${time}`;
  return `${d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
}
