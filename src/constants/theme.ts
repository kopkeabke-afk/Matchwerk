import { Platform, useColorScheme } from 'react-native';

/**
 * Matchwerk's own palette, taken from the logo: night plum + violet as the main colour,
 * match-head gold as the accent (Funken, Daily Spark, highlights), warm cream on dark.
 * Deliberately distinct from the pink/red-orange look of other dating apps.
 */
export const Brand = {
  primary: '#8338D0',
  primaryDark: '#5E1E99',
  /** match-head gold: Funken, Daily Spark, highlights */
  accent: '#E9A92E',
  gradient: ['#9046DB', '#5E1E99'] as const,
  /** hearts and likes */
  heart: '#8338D0',
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
    textSecondary: '#A1A1AA',
    background: '#0B0B0F',
    surface: '#17171D',
    surfaceStrong: '#24242C',
    border: '#2A2A33',
    card: '#17171D',
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
