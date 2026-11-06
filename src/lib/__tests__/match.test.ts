import { compatibility } from '../match';
import type { Profile } from '../types';
import { mutuallyCompatible, passesPrefs, seekingOf } from '../utils';

const base = (over: Partial<Profile>): Profile => ({
  id: 'x', name: 'X', birthdate: '1995-01-01', gender: 'woman', interestedIn: 'men', bio: '', photos: ['a'], prompts: [],
  interests: ['Wandern', 'Kochen', 'Kaffee'], intention: 'long_term', verified: false, firstMove: 'anyone', paused: false, ...over,
});

describe('match score', () => {
  const me = base({ id: 'me', name: 'Alex', gender: 'man', interestedIn: 'women',
    traits: { kidsWish: 'want', smoking: 'never', sport: 'often', rhythm: 'early', diet: 'vegetarian' } });

  it('rewards a real fit and explains why', () => {
    const good = base({ name: 'Lena', distanceKm: 3, traits: { kidsWish: 'want', smoking: 'never', sport: 'daily', rhythm: 'early', diet: 'vegetarian' } });
    const bad = base({ name: 'Mia', distanceKm: 3, intention: 'short_fun', interests: ['Techno'], traits: { kidsWish: 'no', smoking: 'yes', sport: 'never', rhythm: 'night', diet: 'all' } });
    const g = compatibility(me, good);
    const b = compatibility(me, bad);
    expect(g.score).toBeGreaterThan(85);
    expect(b.score).toBeLessThanOrEqual(60);
    expect(g.score - b.score).toBeGreaterThan(25);
    expect(g.reasons.length).toBe(3);
    expect(g.reasons).toEqual(expect.arrayContaining(['Gleicher Kinderwunsch']));
    expect(g.parts.find((p) => p.key === 'kids')?.value).toBe(1);
  });

  it('is two-sided: their priorities count too', () => {
    const smokerFriendlyMe = { ...me, traits: { ...me.traits, smoking: 'yes' as const } };
    const caresAboutSmoking = base({ distanceKm: 3, traits: { smoking: 'never' }, prefs: { important: ['smoking'] } });
    const doesNotCare = base({ distanceKm: 3, traits: { smoking: 'never' } });
    const a = compatibility(smokerFriendlyMe, caresAboutSmoking);
    const b = compatibility(smokerFriendlyMe, doesNotCare);
    expect(a.forThem).toBeLessThan(b.forThem);
    expect(a.score).toBeLessThan(b.score);
  });

  it('does not invent fits for empty profiles', () => {
    const empty = base({ interests: [], traits: {} });
    const c = compatibility({ ...me, interests: [], traits: {} }, empty);
    expect(c.score).toBeGreaterThan(55);
    expect(c.score).toBeLessThan(80);
  });

  it('friends mode ignores dating-only parts', () => {
    const c = compatibility(me, base({ traits: { kidsWish: 'no' } }), 'friends');
    expect(c.parts.some((p) => p.key === 'kids' || p.key === 'intention')).toBe(false);
  });
});

describe('seeking and dealbreakers', () => {
  it('supports several genders', () => {
    const noa = base({ gender: 'nonbinary', seeking: ['woman', 'nonbinary'] });
    const ida = base({ gender: 'woman', seeking: ['nonbinary'] });
    const tom = base({ gender: 'man', seeking: ['nonbinary'] });
    expect(mutuallyCompatible(noa, ida)).toBe(true);
    expect(mutuallyCompatible(noa, tom)).toBe(false);
    expect(seekingOf(base({ interestedIn: 'everyone' }))).toEqual(['woman', 'man', 'nonbinary']);
  });

  it('hides smokers, height and Kinderwunsch mismatches', () => {
    const picky = base({ traits: { kidsWish: 'want' }, prefs: { nonSmokerOnly: true, kidsMatch: true, heightMin: 175 } });
    expect(passesPrefs(picky, base({ heightCm: 180, traits: { smoking: 'never', kidsWish: 'open' } }))).toBe(true);
    expect(passesPrefs(picky, base({ heightCm: 180, traits: { smoking: 'sometimes' } }))).toBe(false);
    expect(passesPrefs(picky, base({ heightCm: 170 }))).toBe(false);
    expect(passesPrefs(picky, base({ heightCm: 180, traits: { kidsWish: 'no' } }))).toBe(false);
    expect(passesPrefs(picky, base({}))).toBe(true); // unknown passes
  });
});
