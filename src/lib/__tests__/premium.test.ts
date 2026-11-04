import { createDemoBackend } from '../demo-backend';
import { FREE_LIMITS } from '../plans';
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

describe('free plan limits and funke+', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it('blocks the second super-like and the 51st like for free users', async () => {
    const b = await fresh();
    const deck = await b.getDeck({ ...DEFAULT_FILTERS, maxAge: 99, maxDistanceKm: 500 });
    await b.swipe(deck[0].id, 'superlike');
    await expect(b.swipe(deck[1].id, 'superlike')).rejects.toThrow('LIMIT:superlikes');
    // fill up the remaining likes with ids outside the deck
    for (let i = 1; i < FREE_LIMITS.likesPerDay; i++) await b.swipe(`x-${i}`, 'like');
    expect((await b.getLimits()).likesLeft).toBe(0);
    const err = await b.swipe(deck[2].id, 'like').catch((e) => e);
    expect(limitReason(err)).toBe('likes');
    await expect(b.swipe(deck[2].id, 'pass')).resolves.toBeDefined();
  });

  it('a purchase unlocks unlimited likes, 5 super-likes and a weekly boost', async () => {
    const b = await fresh();
    for (let i = 0; i < FREE_LIMITS.likesPerDay; i++) await b.swipe(`y-${i}`, 'like');
    await expect(b.activateBoost()).rejects.toThrow('LIMIT:boost');
    await b.simulatePurchase!('funke_plus_6m');
    const l = await b.getLimits();
    expect(l.premium).toBe(true);
    expect(l.likesLeft).toBeNull();
    expect(new Date(l.premiumUntil!).getTime()).toBeGreaterThan(Date.now() + 170 * 86_400_000);
    await b.swipe('y-extra', 'like');
    expect(l.freeBoostAvailable).toBe(true);
    const until = await b.activateBoost();
    expect(new Date(until).getTime()).toBeGreaterThan(Date.now());
    expect((await b.getLimits()).freeBoostAvailable).toBe(false);
  });

  it('boost packs add credits', async () => {
    const b = await fresh();
    await b.simulatePurchase!('funke_boost_5');
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
