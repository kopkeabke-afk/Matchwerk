import { createDemoBackend } from '../demo-backend';
import { messagePreview } from '../types';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const me = {
  id: '', name: 'Alex', birthdate: '1996-03-14', gender: 'man' as const, interestedIn: 'women' as const, bio: '',
  photos: ['a', 'b'], prompts: [], interests: ['Kaffee'], intention: 'long_term' as const,
  verified: false, firstMove: 'anyone' as const, paused: false,
};

describe('voice messages', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('sends a voice message, shows it in the list and can be played back', async () => {
    const b = createDemoBackend();
    await b.verifyLoginCode('a@b.de', '000000');
    await b.saveMyProfile(me);
    const likes = await b.getIncomingLikes();
    const { match } = await b.swipe(likes[0].profile.id, 'like');
    expect(match).toBeDefined();

    const msg = await b.sendVoice(match!.id, 'file:///rec/hallo.m4a', 4200);
    expect(msg).toMatchObject({ kind: 'voice', durationMs: 4200, text: '' });
    expect(await b.getVoiceUrl(msg)).toBe('file:///rec/hallo.m4a');

    const [m] = (await b.getMatches()).filter((x) => x.id === match!.id);
    expect(messagePreview(m.lastMessage!)).toBe('🎤 Sprachnachricht');
    expect(messagePreview({ ...msg, kind: 'text', text: 'Hi' })).toBe('Hi');
  });
});
