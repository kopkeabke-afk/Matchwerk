/**
 * Matchwerk tiers. Real prices are set in the Play Console and fetched through RevenueCat;
 * the prices here are only used in demo mode and as fallback copy.
 * Keep the limits in sync with tier_limits() in supabase/migrations/0005_tiers.sql.
 */
export type Tier = 'free' | 'plus' | 'vip';

export const TIER_LIMITS: Record<Tier, { swipesPerDay: number; likesPerDay: number; funkenPerDay: number; boostEveryDays: number | null }> = {
  free: { swipesPerDay: 60, likesPerDay: 25, funkenPerDay: 1, boostEveryDays: null },
  plus: { swipesPerDay: 250, likesPerDay: Infinity, funkenPerDay: 3, boostEveryDays: 30 },
  vip: { swipesPerDay: Infinity, likesPerDay: Infinity, funkenPerDay: 7, boostEveryDays: 7 },
};
/** @deprecated kept for older imports */
export const FREE_LIMITS = { likesPerDay: TIER_LIMITS.free.likesPerDay, superlikesPerDay: TIER_LIMITS.free.funkenPerDay };

export const TIER_NAMES: Record<Tier, string> = { free: 'Gratis', plus: 'Matchwerk+', vip: 'Matchwerk VIP' };

export interface Plan {
  id: string; // store product id
  kind: 'subscription' | 'funken' | 'boost';
  tier?: Exclude<Tier, 'free'>;
  title: string;
  months?: number;
  amount?: number; // Funken or boosts in a pack
  price: number; // EUR, demo/fallback only
  badge?: string;
}

export const DEMO_PLANS: Plan[] = [
  { id: 'matchwerk_plus_1m', kind: 'subscription', tier: 'plus', title: '1 Monat', months: 1, price: 11.99 },
  { id: 'matchwerk_plus_6m', kind: 'subscription', tier: 'plus', title: '6 Monate', months: 6, price: 59.99, badge: 'Beliebt' },
  { id: 'matchwerk_plus_12m', kind: 'subscription', tier: 'plus', title: '12 Monate', months: 12, price: 107.88 },
  { id: 'matchwerk_vip_1m', kind: 'subscription', tier: 'vip', title: '1 Monat', months: 1, price: 19.99 },
  { id: 'matchwerk_vip_6m', kind: 'subscription', tier: 'vip', title: '6 Monate', months: 6, price: 99.99, badge: 'Beliebt' },
  { id: 'matchwerk_vip_12m', kind: 'subscription', tier: 'vip', title: '12 Monate', months: 12, price: 179.88 },
  { id: 'matchwerk_funken_5', kind: 'funken', title: '5 Funken', amount: 5, price: 4.99 },
  { id: 'matchwerk_funken_15', kind: 'funken', title: '15 Funken', amount: 15, price: 11.99 },
  { id: 'matchwerk_funken_30', kind: 'funken', title: '30 Funken', amount: 30, price: 19.99 },
  { id: 'matchwerk_boost_1', kind: 'boost', title: '1 Boost', amount: 1, price: 3.99 },
  { id: 'matchwerk_boost_5', kind: 'boost', title: '5 Boosts', amount: 5, price: 14.99 },
];

export interface FeatureRow { icon: string; title: string; free: string; plus: string; vip: string }
export const FEATURES: FeatureRow[] = [
  { icon: 'images', title: 'Profile pro Tag', free: '60', plus: '250', vip: '∞' },
  { icon: 'heart', title: 'Likes pro Tag', free: '25', plus: '∞', vip: '∞' },
  { icon: 'flame', title: 'Funken pro Tag', free: '1', plus: '3', vip: '7' },
  { icon: 'flash', title: 'Boost (30 Min. ganz oben)', free: '–', plus: '1 / Monat', vip: '1 / Woche' },
  { icon: 'time', title: 'Matches verlängern', free: '1×', plus: '∞', vip: '∞' },
  { icon: 'trending-up', title: 'Bevorzugt angezeigt', free: '–', plus: '–', vip: '✓' },
  { icon: 'eye', title: 'Sehen, wer dich mag', free: '✓', plus: '✓', vip: '✓' },
  { icon: 'arrow-undo', title: 'Rückgängig', free: '✓', plus: '✓', vip: '✓' },
];

export const euro = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
