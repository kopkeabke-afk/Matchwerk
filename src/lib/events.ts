import type { Match } from './types';

type Events = {
  swiped: { id: string };
  matched: { match: Match };
};
type AnyHandler = (p: never) => void;

const handlers = new Map<keyof Events, Set<AnyHandler>>();

/** Tiny app-wide event bus (e.g. a like sent from a profile modal removes the card from the deck). */
export const bus = {
  on<K extends keyof Events>(k: K, h: (p: Events[K]) => void) {
    if (!handlers.has(k)) handlers.set(k, new Set());
    handlers.get(k)!.add(h as AnyHandler);
    return () => {
      handlers.get(k)?.delete(h as AnyHandler);
    };
  },
  emit<K extends keyof Events>(k: K, p: Events[K]) {
    handlers.get(k)?.forEach((h) => (h as (p: Events[K]) => void)(p));
  },
};
