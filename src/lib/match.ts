/**
 * Matchwerk's match score.
 *
 * - Two-sided: we compute how well the other person fits *you* (with your priorities) and how well
 *   *you* fit them (with theirs), and combine both. A great match is great for both.
 * - Personal: everything someone marks as important counts 2.5× for them.
 * - Honest: unknown answers are left out instead of guessed; with little information the score
 *   stays near the middle instead of promising too much.
 * - Explainable: every part is listed with a reason, the three strongest are shown on the photo.
 */
import type { ImportantKey, Traits } from './traits';
import type { Mode, Profile } from './types';

export type PartKey = ImportantKey | 'skills';

export interface MatchPart {
  key: PartKey;
  label: string;
  /** 0 … 1 – how well it fits */
  value: number;
  /** short positive reason, shown as a chip (only for good fits) */
  reason?: string;
  /** one line of explanation for the breakdown */
  detail: string;
}

export interface Compatibility {
  /** 35 … 99 */
  score: number;
  /** up to three strongest reasons */
  reasons: string[];
  /** shared interests */
  shared: string[];
  parts: MatchPart[];
  /** how well they fit you / how well you fit them, 0 … 100 */
  forMe: number;
  forThem: number;
}

const BASE: Record<Mode, Partial<Record<PartKey, number>>> = {
  dating: { intention: 16, kids: 16, interests: 14, smoking: 8, sport: 6, drinking: 4, diet: 4, pets: 4, personality: 5, rhythm: 4, education: 3, languages: 3, skills: 3, height: 5, distance: 7 },
  friends: { interests: 20, skills: 6, personality: 7, rhythm: 5, sport: 7, smoking: 5, drinking: 4, diet: 3, pets: 3, languages: 4, education: 2, distance: 9 },
};
const IMPORTANT_FACTOR = 2.5;
/** pseudo-weight pulling sparse profiles towards the middle */
const PRIOR_WEIGHT = 40;
const PRIOR_VALUE = 0.5;

const INTENTION_GROUP: Record<string, number> = { long_term: 0, long_open: 1, short_open: 2, short_fun: 3, unsure: 2, friends: 5 };
const ORDER: Partial<Record<keyof Traits, string[]>> = {
  drinking: ['never', 'social', 'often'],
  sport: ['never', 'sometimes', 'often', 'daily'],
  personality: ['intro', 'ambi', 'extro'],
  education: ['school', 'apprenticeship', 'degree', 'phd'],
};
const steps = (key: keyof Traits, a?: string, b?: string) => {
  const o = ORDER[key]!;
  return Math.abs(o.indexOf(a!) - o.indexOf(b!));
};
const byDiff = (d: number, table: number[]) => table[Math.min(d, table.length - 1)];

/** The parts that can be judged for this pair, from the viewer's side (height uses the viewer's wishes). */
function parts(viewer: Profile, cand: Profile, mode: Mode): MatchPart[] {
  const a = viewer.traits ?? {};
  const b = cand.traits ?? {};
  const out: MatchPart[] = [];
  const name = cand.name;

  if (mode === 'dating') {
    const gap = Math.abs((INTENTION_GROUP[viewer.intention] ?? 2) - (INTENTION_GROUP[cand.intention] ?? 2));
    out.push({
      key: 'intention', label: 'Absichten', value: byDiff(gap, [1, 0.75, 0.45, 0.15]),
      reason: gap === 0 ? 'Ihr sucht dasselbe' : gap === 1 ? 'Ähnliche Absichten' : undefined,
      detail: gap === 0 ? 'Ihr wollt dasselbe.' : gap === 1 ? 'Ihr wollt ziemlich Ähnliches.' : 'Ihr sucht eher Unterschiedliches.',
    });
    if (a.kidsWish && b.kidsWish) {
      const v = a.kidsWish === b.kidsWish ? 1 : a.kidsWish === 'open' || b.kidsWish === 'open' ? 0.7 : 0.05;
      out.push({ key: 'kids', label: 'Kinderwunsch', value: v, reason: v === 1 ? 'Gleicher Kinderwunsch' : undefined,
        detail: v === 1 ? 'Ihr seht das mit Kindern gleich.' : v > 0.5 ? 'Eine:r von euch ist offen.' : 'Hier wollt ihr Verschiedenes.' });
    }
    const h = cand.heightCm;
    const p = viewer.prefs;
    if (h && (p?.heightMin || p?.heightMax)) {
      const below = p.heightMin ? Math.max(0, p.heightMin - h) : 0;
      const above = p.heightMax ? Math.max(0, h - p.heightMax) : 0;
      const d = below + above;
      out.push({ key: 'height', label: 'Größe', value: d === 0 ? 1 : Math.max(0.1, 1 - d / 15),
        detail: d === 0 ? `${name} ist so groß, wie du es dir wünschst.` : `${d} cm außerhalb deines Wunschbereichs.` });
    }
  }

  const shared = cand.interests.filter((i) => viewer.interests.includes(i));
  if (viewer.interests.length && cand.interests.length) {
    out.push({ key: 'interests', label: 'Interessen', value: Math.min(1, shared.length / 3),
      reason: shared.length >= 2 ? `${shared.length} gemeinsame Interessen` : shared.length === 1 ? `Ihr mögt beide ${shared[0]}` : undefined,
      detail: shared.length ? `Gemeinsam: ${shared.join(', ')}.` : 'Noch keine gemeinsamen Interessen – Neues entdecken!' });
  }

  if (a.smoking && b.smoking) {
    const same = a.smoking === b.smoking;
    const v = same ? 1 : (a.smoking === 'never' && b.smoking === 'yes') || (a.smoking === 'yes' && b.smoking === 'never') ? 0.1 : 0.6;
    out.push({ key: 'smoking', label: 'Rauchen', value: v,
      reason: same && a.smoking === 'never' ? 'Beide Nichtraucher:innen' : undefined,
      detail: same ? 'Beim Rauchen seid ihr euch einig.' : v < 0.5 ? 'Beim Rauchen liegt ihr weit auseinander.' : 'Beim Rauchen gibt es kleine Unterschiede.' });
  }
  if (a.drinking && b.drinking) {
    const d = steps('drinking', a.drinking, b.drinking);
    out.push({ key: 'drinking', label: 'Alkohol', value: byDiff(d, [1, 0.65, 0.25]), detail: d === 0 ? 'Gleiche Einstellung zu Alkohol.' : 'Etwas unterschiedlich beim Alkohol.' });
  }
  if (a.sport && b.sport) {
    const d = steps('sport', a.sport, b.sport);
    const sporty = ['often', 'daily'].includes(a.sport) && ['often', 'daily'].includes(b.sport);
    out.push({ key: 'sport', label: 'Sport', value: byDiff(d, [1, 0.75, 0.4, 0.15]), reason: sporty ? 'Beide sportlich' : undefined,
      detail: d === 0 ? 'Ihr bewegt euch gleich gern.' : d === 1 ? 'Beim Sport fast im gleichen Takt.' : 'Beim Sport ziemlich verschieden.' });
  }
  if (a.diet && b.diet) {
    const veg = (x?: string) => x === 'vegetarian' || x === 'vegan';
    const v = a.diet === b.diet ? 1 : veg(a.diet) !== veg(b.diet) && (a.diet === 'all' || b.diet === 'all') ? 0.5 : 0.8;
    out.push({ key: 'diet', label: 'Ernährung', value: v,
      reason: a.diet === b.diet && veg(a.diet) ? (a.diet === 'vegan' ? 'Beide vegan' : 'Beide vegetarisch') : undefined,
      detail: v === 1 ? 'Ihr esst gleich – Kochen wird leicht.' : 'Beim Essen etwas unterschiedlich.' });
  }
  if (a.pets?.length && b.pets?.length) {
    const allergic = (x: string[], y: string[]) => x.includes('allergic') && (y.includes('dog') || y.includes('cat'));
    const both = ['dog', 'cat'].filter((t) => a.pets!.includes(t) && b.pets!.includes(t));
    const v = allergic(a.pets, b.pets) || allergic(b.pets, a.pets) ? 0.15 : both.length ? 1 : 0.7;
    out.push({ key: 'pets', label: 'Tiere', value: v, reason: both.includes('dog') ? 'Beide Hundemenschen' : both.includes('cat') ? 'Beide Katzenmenschen' : undefined,
      detail: v === 1 ? 'Ihr teilt die Liebe zu Tieren.' : v < 0.5 ? 'Achtung: Allergie und Haustier.' : 'Bei Tieren passt es.' });
  }
  if (a.personality && b.personality) {
    const d = steps('personality', a.personality, b.personality);
    out.push({ key: 'personality', label: 'Typ', value: byDiff(d, [1, 0.75, 0.45]),
      reason: d === 0 && a.personality === 'extro' ? 'Beide gesellig' : d === 0 && a.personality === 'intro' ? 'Beide eher ruhig' : undefined,
      detail: d === 0 ? 'Ihr tickt ähnlich.' : d === 1 ? 'Ihr ergänzt euch gut.' : 'Ganz unterschiedliche Typen.' });
  }
  if (a.rhythm && b.rhythm) {
    const v = a.rhythm === b.rhythm ? 1 : a.rhythm === 'flexible' || b.rhythm === 'flexible' ? 0.8 : 0.35;
    out.push({ key: 'rhythm', label: 'Rhythmus', value: v,
      reason: v === 1 && a.rhythm === 'early' ? 'Beide Frühaufsteher:innen' : v === 1 && a.rhythm === 'night' ? 'Beide Nachteulen' : undefined,
      detail: v === 1 ? 'Gleicher Tagesrhythmus.' : v > 0.5 ? 'Der Rhythmus passt.' : 'Frühaufsteher:in trifft Nachteule.' });
  }
  if (a.education && b.education) {
    const d = steps('education', a.education, b.education);
    out.push({ key: 'education', label: 'Ausbildung', value: byDiff(d, [1, 0.85, 0.65]), detail: d === 0 ? 'Ähnlicher Bildungsweg.' : 'Unterschiedliche Bildungswege.' });
  }
  if (a.languages?.length && b.languages?.length) {
    const common = a.languages.filter((l) => b.languages!.includes(l));
    const extra = common.filter((l) => l !== 'Deutsch');
    out.push({ key: 'languages', label: 'Sprachen', value: common.length === 0 ? 0.2 : extra.length ? 1 : 0.7,
      reason: extra.length ? `Ihr sprecht beide ${extra[0]}` : undefined,
      detail: common.length ? `Gemeinsame Sprachen: ${common.join(', ')}.` : 'Keine gemeinsame Sprache angegeben.' });
  }
  if (a.skills?.length && b.skills?.length) {
    const common = a.skills.filter((s) => b.skills!.includes(s));
    out.push({ key: 'skills', label: 'Das könnt ihr', value: common.length ? 1 : 0.65,
      reason: common.length ? `Ihr könnt beide ${common[0]}` : undefined,
      detail: common.length ? `Gemeinsame Stärken: ${common.join(', ')}.` : `${name} kann ${b.skills.slice(0, 2).join(' und ')} – ihr ergänzt euch.` });
  }
  const km = cand.distanceKm;
  if (km != null) {
    out.push({ key: 'distance', label: 'Nähe', value: km <= 5 ? 1 : km <= 15 ? 0.8 : km <= 40 ? 0.55 : 0.3,
      reason: km <= 5 ? 'Ganz in deiner Nähe' : undefined, detail: `${km} km entfernt.` });
  }
  return out;
}

function weightOf(key: PartKey, p: Profile, mode: Mode) {
  const w = BASE[mode][key] ?? 0;
  return p.prefs?.important?.includes(key as ImportantKey) ? w * IMPORTANT_FACTOR : w;
}

function direction(viewer: Profile, cand: Profile, mode: Mode) {
  const ps = parts(viewer, cand, mode);
  let sum = 0;
  let wsum = 0;
  for (const part of ps) {
    const w = weightOf(part.key, viewer, mode);
    sum += part.value * w;
    wsum += w;
  }
  const value = (sum + PRIOR_VALUE * PRIOR_WEIGHT) / (wsum + PRIOR_WEIGHT);
  return { value, parts: ps };
}

export function compatibility(me: Profile, other: Profile, mode: Mode = 'dating'): Compatibility {
  const mine = direction(me, other, mode);
  // the other side: their wishes, their priorities, the same distance
  const theirs = direction({ ...other, distanceKm: undefined }, { ...me, distanceKm: other.distanceKm }, mode);
  const mutual = Math.sqrt(mine.value * theirs.value);
  const score = Math.min(99, Math.round(35 + 64 * mutual));
  const weightBoth = (k: PartKey) => weightOf(k, me, mode) + weightOf(k, other, mode);
  const reasons = mine.parts
    .filter((p) => p.reason && p.value >= 0.75)
    .sort((x, y) => y.value * weightBoth(y.key) - x.value * weightBoth(x.key))
    .slice(0, 3)
    .map((p) => p.reason!);
  return {
    score,
    reasons,
    shared: other.interests.filter((i) => me.interests.includes(i)),
    parts: mine.parts.sort((x, y) => weightOf(y.key, me, mode) - weightOf(x.key, me, mode)),
    forMe: Math.round(mine.value * 100),
    forThem: Math.round(theirs.value * 100),
  };
}
