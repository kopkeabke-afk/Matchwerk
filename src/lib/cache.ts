import type { Profile } from './types';

const profiles = new Map<string, Profile>();

/** In-memory cache so detail screens open instantly with data already fetched by lists. */
export const profileCache = {
  put(list: Profile[]) {
    list.forEach((p) => profiles.set(p.id, p));
  },
  get(id: string) {
    return profiles.get(id);
  },
};
