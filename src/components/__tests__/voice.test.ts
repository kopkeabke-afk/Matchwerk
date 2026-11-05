jest.mock('expo-audio', () => ({}));
jest.mock('@/lib', () => ({ backend: {} }));

// eslint-disable-next-line import/first
import { formatSeconds, waveform } from '../voice';

describe('voice helpers', () => {
  it('formats durations as m:ss', () => {
    expect(formatSeconds(0)).toBe('0:00');
    expect(formatSeconds(4200)).toBe('0:04');
    expect(formatSeconds(60000)).toBe('1:00');
  });
  it('builds a stable, bounded waveform per message', () => {
    const a = waveform('abc');
    expect(a).toEqual(waveform('abc'));
    expect(a).not.toEqual(waveform('xyz'));
    expect(a.every((v) => v > 0 && v <= 1)).toBe(true);
  });
});
