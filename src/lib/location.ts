import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

import type { Profile } from './types';
import { haversineKm } from './utils';

/**
 * Where someone is looking for people.
 * - "auto": the phone's position, refreshed quietly whenever the app opens (visiting friends just works)
 * - a chosen place ("Reisemodus"): stays until the user switches back
 * Coordinates are always rounded to ~1 km before they leave the phone.
 */
export interface Place { lat: number; lng: number; city?: string }
const TRAVEL_KEY = 'matchwerk.travel';
const round = (n: number) => Math.round(n * 100) / 100;

export async function getTravelPlace(): Promise<Place | null> {
  try {
    const raw = await AsyncStorage.getItem(TRAVEL_KEY);
    return raw ? (JSON.parse(raw) as Place) : null;
  } catch {
    return null;
  }
}

export async function setTravelPlace(place: Place | null) {
  if (place) await AsyncStorage.setItem(TRAVEL_KEY, JSON.stringify(place));
  else await AsyncStorage.removeItem(TRAVEL_KEY);
}

async function cityOf(lat: number, lng: number): Promise<string | undefined> {
  try {
    const [g] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    return g?.city ?? g?.subregion ?? g?.region ?? undefined;
  } catch {
    return undefined;
  }
}

/** Current phone position. Only asks for permission when `ask` is true. */
export async function currentPlace(ask = false): Promise<Place | null> {
  try {
    const perm = ask ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const lat = round(pos.coords.latitude);
    const lng = round(pos.coords.longitude);
    return { lat, lng, city: await cityOf(lat, lng) };
  } catch {
    return null;
  }
}

/** Finds a town or city by name ("Reisemodus"). Uses the phone's geocoder, OpenStreetMap on the web. */
export async function findPlace(query: string): Promise<Place | null> {
  const q = query.trim();
  if (q.length < 2) return null;
  try {
    if (Platform.OS === 'web') {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=de&q=${encodeURIComponent(q)}`);
      const [hit] = (await res.json()) as { lat: string; lon: string; display_name: string }[];
      if (!hit) return null;
      return { lat: round(Number(hit.lat)), lng: round(Number(hit.lon)), city: hit.display_name.split(',')[0] };
    }
    const [hit] = await Location.geocodeAsync(q);
    if (!hit) return null;
    const lat = round(hit.latitude);
    const lng = round(hit.longitude);
    return { lat, lng, city: (await cityOf(lat, lng)) ?? q };
  } catch {
    return null;
  }
}

/**
 * Called when the app opens: keeps the profile's position up to date without asking again.
 * Skips if a travel place is set, or if the user moved less than 3 km.
 */
export async function refreshProfileLocation(profile: Profile, save: (p: Profile) => Promise<void>) {
  if (await getTravelPlace()) return;
  const here = await currentPlace(false);
  if (!here) return;
  const moved = profile.lat == null || profile.lng == null ? Infinity : haversineKm(profile.lat, profile.lng, here.lat, here.lng);
  if (moved < 3) return;
  await save({ ...profile, lat: here.lat, lng: here.lng, city: here.city ?? profile.city });
}
