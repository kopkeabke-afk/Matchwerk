import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { backend } from './index';
import { identifyPurchaser, resetPurchaser } from './purchases';
import type { Filters, Mode, Profile } from './types';
import { DEFAULT_FILTERS, defaultFiltersFor } from './utils';

interface SessionValue {
  ready: boolean;
  userId: string | null;
  profile: Profile | null;
  filters: Filters;
  setFilters(f: Filters): void;
  /** Dating or Freunde – only switchable when the profile has both */
  mode: Mode;
  setMode(m: Mode): void;
  saveProfile(p: Profile): Promise<void>;
  refresh(): Promise<void>;
}

const Ctx = createContext<SessionValue | null>(null);
const FILTER_KEY = 'matchwerk.filters';
const MODE_KEY = 'matchwerk.mode';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [filters, setFiltersState] = useState<Filters>(DEFAULT_FILTERS);
  const [customFilters, setCustomFilters] = useState(false);
  const [mode, setModeState] = useState<Mode>('dating');

  const load = useCallback(async (id: string | null) => {
    setUserId(id);
    if (!id) {
      setProfile(null);
      resetPurchaser().catch(() => {});
      return;
    }
    identifyPurchaser(id).catch((e) => console.warn('RevenueCat', e));
    try {
      setProfile(await backend.getMyProfile());
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(FILTER_KEY);
        if (raw) {
          setFiltersState({ ...DEFAULT_FILTERS, ...JSON.parse(raw) });
          setCustomFilters(true);
        }
        const m = await AsyncStorage.getItem(MODE_KEY);
        if (m === 'dating' || m === 'friends') setModeState(m);
      } catch {}
      const id = await backend.getSessionUserId().catch(() => null);
      if (!alive) return;
      await load(id);
      setReady(true);
    })();
    const off = backend.onAuthChange((id) => {
      load(id);
    });
    return () => {
      alive = false;
      off();
    };
  }, [load]);

  // until someone sets filters themselves, they follow the profile's age
  const effectiveFilters = customFilters || !profile ? filters : defaultFiltersFor(profile.birthdate);

  const modes = profile?.modes?.length ? profile.modes : (['dating'] as Mode[]);
  const activeMode: Mode = modes.includes(mode) ? mode : modes[0];

  const value: SessionValue = {
    ready,
    userId,
    profile,
    filters: effectiveFilters,
    mode: activeMode,
    setMode(m) {
      setModeState(m);
      AsyncStorage.setItem(MODE_KEY, m).catch(() => {});
    },
    setFilters(f) {
      setFiltersState(f);
      setCustomFilters(true);
      AsyncStorage.setItem(FILTER_KEY, JSON.stringify(f)).catch(() => {});
    },
    async saveProfile(p) {
      setProfile(await backend.saveMyProfile(p));
    },
    async refresh() {
      await load(await backend.getSessionUserId());
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}
