import { createDemoBackend } from '../demo-backend';
import { DEFAULT_FILTERS } from '../utils';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const me = {
  id: '', name: 'Alex', birthdate: '1996-03-14', gender: 'man' as const, interestedIn: 'women' as const, bio: '',
  photos: ['a', 'b'], prompts: [], interests: ['Kaffee'], intention: 'long_term' as const,
  verified: false, firstMove: 'anyone' as const, paused: false,
};

describe('demo backend', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('runs the full flow: sign in → deck → like back → match → chat → block → delete', async () => {
    const b = createDemoBackend();
    expect(await b.getSessionUserId()).toBeNull();
    await b.verifyLoginCode('a@b.de', '000000');
    expect(await b.getSessionUserId()).toBe('me');
    await b.saveMyProfile(me);

    const deck = await b.getDeck(DEFAULT_FILTERS);
    expect(deck.length).toBeGreaterThan(5);
    expect(deck.every((p) => p.gender === 'woman')).toBe(true);

    const likes = await b.getIncomingLikes();
    expect(likes.length).toBeGreaterThan(0);
    const { match } = await b.swipe(likes[0].profile.id, 'like', { comment: 'Hallo!' });
    expect(match).toBeDefined();
    expect(await b.getDeck(DEFAULT_FILTERS)).not.toContainEqual(expect.objectContaining({ id: likes[0].profile.id }));

    const msgs = await b.getMessages(match!.id);
    expect(msgs.map((m) => m.text)).toContain('Hallo!');
    await b.sendMessage(match!.id, 'Wie geht es dir?');
    await jest.advanceTimersByTimeAsync(3000);
    expect((await b.getMessages(match!.id)).length).toBe(3);
    expect((await b.getMatches())[0].unread).toBe(1);
    await b.markRead(match!.id);
    expect((await b.getMatches())[0].unread).toBe(0);

    await b.block(likes[0].profile.id);
    expect(await b.getMatches()).toHaveLength(0);

    await b.deleteAccount();
    expect(await b.getSessionUserId()).toBeNull();
    expect(await b.getMyProfile()).toBeNull();
  });

  it('undo puts a passed profile back into the deck', async () => {
    const b = createDemoBackend();
    await b.verifyLoginCode('a@b.de', '0');
    await b.saveMyProfile(me);
    const [first] = await b.getDeck(DEFAULT_FILTERS);
    await b.swipe(first.id, 'pass');
    expect((await b.getDeck(DEFAULT_FILTERS)).some((p) => p.id === first.id)).toBe(false);
    await b.undoSwipe(first.id);
    expect((await b.getDeck(DEFAULT_FILTERS)).some((p) => p.id === first.id)).toBe(true);
  });
});
