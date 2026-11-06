import { createDemoBackend } from '../demo-backend';
import { messagePreview } from '../types';
import { formatWhen } from '../utils';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const me = {
  id: '', name: 'Alex', birthdate: '1960-03-14', gender: 'man' as const, interestedIn: 'women' as const, bio: '',
  photos: ['a', 'b'], prompts: [], interests: ['Wandern'], intention: 'long_term' as const,
  verified: false, firstMove: 'anyone' as const, paused: false, modes: ['friends' as const],
};
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

describe('Aktivitäten (demo)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  async function fresh() {
    const b = createDemoBackend();
    await b.verifyLoginCode('a@b.de', '000000');
    await b.saveMyProfile(me);
    return b;
  }

  it('lists nearby activities, join, group chat, leave', async () => {
    const b = await fresh();
    const list = await b.getActivities(50);
    expect(list.length).toBeGreaterThan(2);
    const a = list.find((x) => x.memberCount < x.maxPeople)!;
    expect(a.joined).toBe(false);
    expect(await b.getActivityMessages(a.id)).toEqual([]);
    await expect(b.sendActivityMessage(a.id, 'Hi')).rejects.toThrow();

    await b.joinActivity(a.id);
    const joined = (await b.getActivity(a.id))!;
    expect(joined.joined).toBe(true);
    expect(joined.memberCount).toBe(a.memberCount + 1);
    expect((await b.getActivities(50))[0].id).toBe(a.id); // mine first

    await b.sendActivityMessage(a.id, 'Ich bin dabei!');
    await jest.advanceTimersByTimeAsync(3000);
    expect((await b.getActivityMessages(a.id)).length).toBe(2);

    await b.leaveActivity(a.id);
    expect((await b.getActivity(a.id))!.joined).toBe(false);
  });

  it('respects distance, capacity and the hosting limit', async () => {
    const b = await fresh();
    expect((await b.getActivities(1)).length).toBe(0);

    const id = await b.createActivity({ category: 'hike', title: 'Runde um den See', description: '', place: 'Seeufer', startsAt: inDays(2), maxPeople: 2 });
    const mine = (await b.getActivity(id))!;
    expect(mine.isHost && mine.joined && mine.memberCount === 1).toBe(true);
    await expect(b.leaveActivity(id)).rejects.toThrow();
    await expect(b.createActivity({ category: 'food', title: 'Pizza', description: '', place: 'Toni', startsAt: inDays(3), maxPeople: 4 }))
      .rejects.toThrow('LIMIT:activities');
    await expect(b.createActivity({ category: 'food', title: 'Gestern', description: '', place: 'Toni', startsAt: inDays(-1), maxPeople: 4 }))
      .rejects.toThrow();

    await jest.advanceTimersByTimeAsync(4500); // someone joins the new activity
    expect((await b.getActivity(id))!.memberCount).toBe(2);

    await b.cancelActivity(id);
    expect((await b.getActivity(id))!.cancelled).toBe(true);
    await expect(b.sendActivityMessage(id, 'Noch da?')).rejects.toThrow();
    expect(await b.createActivity({ category: 'coffee', title: 'Kaffee', description: '', place: 'Markt', startsAt: inDays(1), maxPeople: 4 })).toBeTruthy();
  });

  it('shows "Macht mit bei", keeps own cover photos and lets you invite a match', async () => {
    const b = await fresh();
    const list = await b.getActivities(50);
    const a = list.find((x) => !x.isHost && !x.joined && x.members.length > 0)!;
    const someone = a.members[0];
    expect((await b.getPersonActivities(someone.id)).map((x) => x.id)).toContain(a.id);

    for (const mine of (await b.getActivities(50)).filter((x) => x.isHost && !x.cancelled)) await b.cancelActivity(mine.id);
    const id = await b.createActivity({ category: 'games', title: 'Doppelkopf', description: '', place: 'Dorfkrug', startsAt: inDays(1), maxPeople: 4, coverUrl: 'file:///cover.jpg' });
    expect((await b.getActivity(id))!.coverUrl).toBe('file:///cover.jpg');

    const likes = await b.getIncomingLikes('friends');
    const { match } = await b.swipe(likes[0].profile.id, 'like', undefined, 'friends');
    const msg = await b.sendInvite(match!.id, id, 'Kommst du mit?');
    expect(msg).toMatchObject({ kind: 'invite', activityId: id });
    const [m] = (await b.getMatches()).filter((x) => x.id === match!.id);
    expect(messagePreview(m.lastMessage!)).toBe('🎉 Einladung zu einer Aktivität');
    await b.cancelActivity(id);
    await expect(b.sendInvite(match!.id, id, 'Und jetzt?')).rejects.toThrow();
  });

  it('formats the time of an activity', () => {
    const now = new Date('2026-11-05T10:00:00');
    expect(formatWhen('2026-11-05T19:00:00', now)).toBe('Heute, 19:00');
    expect(formatWhen('2026-11-06T10:30:00', now)).toBe('Morgen, 10:30');
    expect(formatWhen('2026-11-14T11:00:00', now)).toMatch(/14\. Nov.*11:00/);
  });
});
