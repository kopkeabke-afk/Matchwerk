import { Appearance, Platform, useColorScheme } from 'react-native';

/**
 * Matchwerk's own palette, taken from the logo: night plum + violet as the main colour,
 * match-head gold as the accent (Funken, Daily Spark, highlights), warm cream on dark.
 * Deliberately distinct from the pink/red-orange look of other dating apps.
 *
 * Two looks: "plum" (light phones) – a deep, calm violet with neutral grey surfaces –
 * and "night & gold" (phones in dark mode) – plum-black with a brighter violet and gold hearts.
 * The colour-dependent values below follow the phone's setting.
 */
const isDark = () => Appearance.getColorScheme() === 'dark';

export const Brand = {
  get primary() { return isDark() ? '#7B3FBF' : '#5B2687'; },
  primaryDark: '#3A1358',
  /** match-head gold: Funken, Daily Spark, highlights */
  accent: '#E9A92E',
  get gradient() { return (isDark() ? ['#7B3FBF', '#3A1358'] : ['#6A2E9C', '#3A1358']) as readonly [string, string]; },
  /** hearts and likes – violet by day, gold at night */
  get heart() { return isDark() ? '#E9A92E' : '#5B2687'; },
  /** soft tinted surface, e.g. the "Warum ihr passt" card */
  get tint() { return isDark() ? '#24133A' : '#F3F1F5'; },
  /** logo background */
  night: '#2A0E3F',
  nightDeep: '#160620',
  cream: '#FFF1DC',
  like: '#22C55E',
  pass: '#EF4444',
  super: '#3B82F6',
  gold: '#FFB938',
};

export const Colors = {
  light: {
    text: '#14141A',
    textSecondary: '#6B6B76',
    background: '#FFFFFF',
    surface: '#F5F5F8',
    surfaceStrong: '#EAEAEF',
    border: '#E2E2E8',
    card: '#FFFFFF',
    overlay: 'rgba(0,0,0,0.45)',
  },
  dark: {
    text: '#F5F5F7',
    textSecondary: '#B3A7BF',
    background: '#120B18',
    surface: '#1E1528',
    surfaceStrong: '#2A1F36',
    border: '#2E2338',
    card: '#1E1528',
    overlay: 'rgba(0,0,0,0.6)',
  },
};

export type Palette = typeof Colors.light;

export function useTheme(): Palette & { dark: boolean } {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  return { ...(dark ? Colors.dark : Colors.light), dark };
}

export const Space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const Radius = { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 } as const;
export const Type = {
  title: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700' as const },
  h3: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 22 },
  small: { fontSize: 13 },
};

/** Space reserved for the native tab bar (it floats over content on iOS). */
export const TabInset = Platform.select({ ios: 60, default: 0 }) ?? 0;
/** On web the tab bar renders at the top; leave room for it. */
export const WebTabTop = Platform.OS === 'web' ? 52 : 0;
