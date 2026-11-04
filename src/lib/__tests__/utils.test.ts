import { DEMO_PROFILES } from '../demo-data';
import type { Profile } from '../types';
import {
  ageFrom, compatibility, DEFAULT_FILTERS, haversineKm, icebreakers, isAdult,
  mutuallyCompatible, passesFilters, resolveOpener,
} from '../utils';

const me: Profile = {
  id: 'me', name: 'Alex', birthdate: '1996-03-14', gender: 'man', interestedIn: 'women', bio: '',
  photos: ['a', 'b', 'c'], prompts: [], interests: ['Kaffee', 'Wandern', 'Design'], intention: 'long_term',
  verified: false, firstMove: 'anyone', paused: false,
};
const lena = DEMO_PROFILES.find((p) => p.name === 'Lena')!;

describe('ageFrom / isAdult', () => {
  it('counts birthdays correctly', () => {
    const now = new Date('2026-03-14T12:00:00');
    expect(ageFrom('2000-03-14', now)).toBe(26);
    expect(ageFrom('2000-03-15', now)).toBe(25);
  });
  it('rejects minors and invalid dates', () => {
    const y = new Date().getFullYear();
    expect(isAdult(`${y - 17}-01-01`)).toBe(false);
    expect(isAdult(`${y - 30}-01-01`)).toBe(true);
    expect(isAdult('not-a-date')).toBe(false);
  });
});

describe('resolveOpener', () => {
  it.each([
    ['anyone', 'anyone', 'anyone'],
    ['me', 'anyone', 'me'],
    ['anyone', 'me', 'them'],
    ['them', 'anyone', 'them'],
    ['anyone', 'them', 'me'],
    ['me', 'me', 'anyone'],
    ['them', 'them', 'anyone'],
    ['me', 'them', 'me'],
  ] as const)('mine=%s theirs=%s -> %s', (mine, theirs, expected) => {
    expect(resolveOpener(mine, theirs)).toBe(expected);
  });
  it('is symmetric (one side "me" means the other sees "them")', () => {
    const opts = ['me', 'them', 'anyone'] as const;
    const flip = { me: 'them', them: 'me', anyone: 'anyone' } as const;
    for (const a of opts) for (const b of opts) expect(resolveOpener(b, a)).toBe(flip[resolveOpener(a, b)]);
  });
});

describe('matching rules', () => {
  it('requires mutual interest', () => {
    expect(mutuallyCompatible(me, lena)).toBe(true);
    expect(mutuallyCompatible({ ...me, interestedIn: 'men' }, lena)).toBe(false);
    expect(mutuallyCompatible(me, { ...lena, interestedIn: 'women' })).toBe(false);
  });
  it('applies filters', () => {
    expect(passesFilters(lena, DEFAULT_FILTERS)).toBe(true);
    expect(passesFilters(lena, { ...DEFAULT_FILTERS, maxDistanceKm: 1 })).toBe(false);
    expect(passesFilters(lena, { ...DEFAULT_FILTERS, intentions: ['friends'] })).toBe(false);
    expect(passesFilters({ ...lena, verified: false }, { ...DEFAULT_FILTERS, verifiedOnly: true })).toBe(false);
  });
});

describe('compatibility', () => {
  it('stays within 40–99 and explains itself', () => {
    for (const p of DEMO_PROFILES) {
      const c = compatibility(me, p);
      expect(c.score).toBeGreaterThanOrEqual(40);
      expect(c.score).toBeLessThanOrEqual(99);
    }
    const c = compatibility(me, lena);
    expect(c.shared).toEqual(expect.arrayContaining(['Kaffee', 'Wandern', 'Design']));
    expect(c.reasons).toContain('Ihr sucht dasselbe');
  });
  it('rewards shared interests', () => {
    const none = compatibility({ ...me, interests: [] }, lena).score;
    expect(compatibility(me, lena).score).toBeGreaterThan(none);
  });
});

describe('icebreakers', () => {
  it('uses shared interests and caps at 4', () => {
    const ib = icebreakers(me, lena);
    expect(ib.length).toBeLessThanOrEqual(4);
    expect(ib[0]).toMatch(/Design|Kaffee|Wandern/);
  });
});

describe('haversineKm', () => {
  it('Berlin → Potsdam is about 27 km', () => {
    expect(haversineKm(52.52, 13.405, 52.39, 13.065)).toBeCloseTo(27, -1);
  });
});
