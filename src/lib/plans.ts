/**
 * matchwerk+ – one premium tier, deliberately cheaper than the big apps.
 * Real prices are set in App Store Connect / Google Play and fetched through RevenueCat;
 * the values here are only used in demo mode and as fallback copy.
 * Keep the limits in sync with plan_limits() in supabase/migrations/0003_premium.sql.
 */
export const FREE_LIMITS = { likesPerDay: 50, superlikesPerDay: 1, matchExtensions: 1 };
export const PLUS_LIMITS = { likesPerDay: Infinity, superlikesPerDay: 5, boostsPerWeek: 1 };

export interface Plan {
  id: string;            // store product id
  kind: 'subscription' | 'boost';
  title: string;
  months?: number;
  boosts?: number;
  price: number;         // EUR, demo/fallback only
  badge?: string;
}

export const DEMO_PLANS: Plan[] = [
  { id: 'matchwerk_plus_1m', kind: 'subscription', title: '1 Monat', months: 1, price: 7.99 },
  { id: 'matchwerk_plus_6m', kind: 'subscription', title: '6 Monate', months: 6, price: 29.99, badge: 'Beliebt' },
  { id: 'matchwerk_plus_12m', kind: 'subscription', title: '12 Monate', months: 12, price: 44.99, badge: 'Bester Preis' },
  { id: 'matchwerk_boost_1', kind: 'boost', title: '1 Boost', boosts: 1, price: 2.99 },
  { id: 'matchwerk_boost_5', kind: 'boost', title: '5 Boosts', boosts: 5, price: 9.99, badge: '−33 %' },
];

export const PLUS_FEATURES: { icon: string; title: string; text: string; free: string; plus: string }[] = [
  { icon: 'heart', title: 'Unbegrenzt liken', text: 'Kein Tageslimit mehr', free: '50 / Tag', plus: '∞' },
  { icon: 'star', title: '5 Super-Likes täglich', text: 'Fall sofort auf', free: '1 / Tag', plus: '5 / Tag' },
  { icon: 'flash', title: 'Wöchentlicher Boost', text: '30 Minuten ganz oben im Stapel', free: '–', plus: '1 / Woche' },
  { icon: 'time', title: 'Matches unbegrenzt verlängern', text: 'Kein Match läuft dir mehr davon', free: '1×', plus: '∞' },
  { icon: 'eye', title: 'Sehen, wer dich mag', text: 'Bei uns immer kostenlos', free: '✓', plus: '✓' },
  { icon: 'arrow-undo', title: 'Rückgängig', text: 'Bei uns immer kostenlos', free: '✓', plus: '✓' },
];

export const euro = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
