import { createDemoBackend } from '../demo-backend';
import { TIER_LIMITS } from '../plans';
import { toE164 } from '../social-auth';
import { limitReason } from '../types';
import { DEFAULT_FILTERS } from '../utils';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const me = {
  id: '', name: 'Alex', birthdate: '1996-03-14', gender: 'man' as const, interestedIn: 'everyone' as const, bio: '',
  photos: ['a', 'b'], prompts: [], interests: [], intention: 'long_term' as const,
  verified: false, firstMove: 'anyone' as const, paused: false,
};

async function fresh() {
  const b = createDemoBackend();
  await b.deleteAccount();
  await b.verifyLoginCode('a@b.de', '0');
  await b.saveMyProfile(me);
  return b;
}

describe('tiers, Funken and boosts', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('free: 1 Funke, 25 likes and 60 profiles per day', async () => {
    const b = await fresh();
    const deck = await b.getDeck({ ...DEFAULT_FILTERS, maxAge: 99, maxDistanceKm: 500 });
    await b.swipe(deck[0].id, 'superlike');
    await expect(b.swipe(deck[1].id, 'superlike')).rejects.toThrow('LIMIT:superlikes');
    for (let i = 1; i < TIER_LIMITS.free.likesPerDay; i++) await b.swipe(`x-${i}`, 'like');
    const err = await b.swipe(deck[2].id, 'like').catch((e) => e);
    expect(limitReason(err)).toBe('likes');
    for (let i = 0; i < TIER_LIMITS.free.swipesPerDay - TIER_LIMITS.free.likesPerDay; i++) await b.swipe(`p-${i}`, 'pass');
    expect((await b.getLimits()).swipesLeft).toBe(0);
    expect(limitReason(await b.swipe('p-last', 'pass').catch((e) => e))).toBe('swipes');
  });

  it('Plus: unlimited likes, 250 profiles, 3 Funken, monthly boost', async () => {
    const b = await fresh();
    await expect(b.activateBoost()).rejects.toThrow('LIMIT:boost');
    await b.simulatePurchase!('matchwerk_plus_6m');
    const l = await b.getLimits();
    expect(l.tier).toBe('plus');
    expect(l.likesLeft).toBeNull();
    expect(l.swipesLeft).toBe(250);
    expect(l.superlikesLeft).toBe(3);
    expect(l.freeBoostAvailable).toBe(true);
    await b.activateBoost();
    expect((await b.getLimits()).freeBoostAvailable).toBe(false);
  });

  it('VIP: unlimited profiles and 7 Funken', async () => {
    const b = await fresh();
    await b.simulatePurchase!('matchwerk_vip_1m');
    const l = await b.getLimits();
    expect(l.tier).toBe('vip');
    expect(l.swipesLeft).toBeNull();
    expect(l.superlikesLeft).toBe(7);
  });

  it('bought Funken are used after the daily ones', async () => {
    const b = await fresh();
    await b.simulatePurchase!('matchwerk_funken_5');
    expect((await b.getLimits()).funkenCredits).toBe(5);
    await b.swipe('a', 'superlike'); // daily one
    await b.swipe('b', 'superlike'); // bought one
    const l = await b.getLimits();
    expect(l.superlikesLeft).toBe(0);
    expect(l.funkenCredits).toBe(4);
  });

  it('boost packs add credits', async () => {
    const b = await fresh();
    await b.simulatePurchase!('matchwerk_boost_5');
    expect((await b.getLimits()).boostCredits).toBe(5);
    await b.activateBoost();
    expect((await b.getLimits()).boostCredits).toBe(4);
  });
});

describe('toE164', () => {
  it.each([
    ['0151 23456789', '+4915123456789'],
    ['+43 660 1234567', '+436601234567'],
    ['0041 79 123 45 67', '+41791234567'],
    ['15123456789', '+4915123456789'],
    ['123', null],
  ])('%s -> %s', (input, out) => expect(toE164(input)).toBe(out));
});
