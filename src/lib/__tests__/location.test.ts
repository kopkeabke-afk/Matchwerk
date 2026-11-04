import { refreshProfileLocation, setTravelPlace } from '../location';
import type { Profile } from '../types';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const position = { latitude: 52.52, longitude: 13.4 };
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: position })),
  reverseGeocodeAsync: jest.fn(async () => [{ city: 'Hier' }]),
  Accuracy: { Balanced: 3 },
}));

const base: Profile = {
  id: 'me', name: 'A', birthdate: '1990-01-01', gender: 'man', interestedIn: 'women', bio: '', photos: [], prompts: [],
  interests: [], intention: 'unsure', verified: false, firstMove: 'anyone', paused: false, lat: 52.52, lng: 13.4, city: 'Berlin',
};

describe('refreshProfileLocation', () => {
  beforeEach(() => setTravelPlace(null));

  it('does nothing if you have not moved', async () => {
    const save = jest.fn();
    await refreshProfileLocation(base, save);
    expect(save).not.toHaveBeenCalled();
  });

  it('updates the profile when visiting another place (> 3 km), rounded to ~1 km', async () => {
    position.latitude = 48.0003; position.longitude = 7.8512;
    const save = jest.fn(async () => {});
    await refreshProfileLocation(base, save);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ lat: 48, lng: 7.85, city: 'Hier' }));
  });

  it('keeps a chosen travel place', async () => {
    await setTravelPlace({ lat: 50.94, lng: 6.96, city: 'Köln' });
    const save = jest.fn();
    await refreshProfileLocation(base, save);
    expect(save).not.toHaveBeenCalled();
  });
});
