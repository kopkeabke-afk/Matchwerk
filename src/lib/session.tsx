import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { backend } from './index';
import { identifyPurchaser, resetPurchaser } from './purchases';
import type { Filters, Profile } from './types';
import { DEFAULT_FILTERS } from './utils';

interface SessionValue {
  ready: boolean;
  userId: string | null;
  profile: Profile | null;
  filters: Filters;
  setFilters(f: Filters): void;
  saveProfile(p: Profile): Promise<void>;
  refresh(): Promise<void>;
}

const Ctx = createContext<SessionValue | null>(null);
const FILTER_KEY = 'funke.filters';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [filters, setFiltersState] = useState<Filters>(DEFAULT_FILTERS);

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
        if (raw) setFiltersState({ ...DEFAULT_FILTERS, ...JSON.parse(raw) });
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

  const value: SessionValue = {
    ready,
    userId,
    profile,
    filters,
    setFilters(f) {
      setFiltersState(f);
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
