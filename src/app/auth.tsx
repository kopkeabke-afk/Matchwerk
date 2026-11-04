import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Radius } from '@/constants/theme';
import { APP } from '@/constants/app';

const USPS: [string, string][] = [
  ['🔥', 'Sieh kostenlos, wer dich mag – und warum ihr passt'],
  ['💬', 'Like ein Foto oder eine Antwort – mit Kommentar'],
  ['👋', 'Dating oder neue Freunde – oder beides'],
  ['🛡️', 'Verifizierte Profile und Melden in jedem Chat'],
];

export default function Welcome() {
  return (
    <LinearGradient colors={[Brand.night, Brand.nightDeep]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ flex: 1 }}>
      {/* soft warm glow behind the flame, like in the logo (stacked rings instead of a blur) */}
      <View pointerEvents="none" style={styles.glowWrap}>
        {[420, 330, 250, 180, 120].map((d, i) => (
          <View key={d} style={{ position: 'absolute', width: d, height: d, borderRadius: d / 2, backgroundColor: i < 2 ? Brand.primary : Brand.accent, opacity: 0.05 + i * 0.012 }} />
        ))}
      </View>
      <SafeAreaView style={styles.wrap}>
        <Animated.View entering={FadeIn.duration(600)} style={styles.hero}>
          <Image source={require('@/assets/brand/logo-mark.png')} style={styles.mark} contentFit="contain" accessibilityLabel="Matchwerk-Logo" />
          <Text style={styles.brand} accessibilityRole="header">
            Match<Text style={{ color: Brand.accent }}>werk</Text>
          </Text>
          <Text style={styles.tagline}>{APP.slogan}</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={{ gap: 16 }}>
          <View style={styles.usps}>
            {USPS.map(([icon, t]) => (
              <View key={t} style={styles.uspRow}>
                <Text style={styles.uspIcon}>{icon}</Text>
                <Text style={styles.usp}>{t}</Text>
              </View>
            ))}
          </View>
          <LinearGradient colors={Brand.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
            <Text style={styles.ctaText} onPress={() => router.push('/sign-in')} accessibilityRole="button">
              {'Los geht\u2019s'}
            </Text>
          </LinearGradient>
          <Text style={styles.legal}>
            Mit dem Fortfahren akzeptierst du unsere{' '}
            <Link href="/legal/terms" style={styles.link}>Nutzungsbedingungen</Link> und die{' '}
            <Link href="/legal/privacy" style={styles.link}>Datenschutzerklärung</Link>. Ab 18 Jahren.
          </Text>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  glowWrap: { position: 'absolute', top: '8%', left: 0, right: 0, height: 420, alignItems: 'center', justifyContent: 'center' },
  wrap: { flex: 1, padding: 24, justifyContent: 'space-between' },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 6 },
  mark: { width: 190, height: 190, marginBottom: -6 },
  brand: { color: Brand.cream, fontSize: 52, fontWeight: '900', letterSpacing: -1.5 },
  tagline: { color: '#E9D5F5', fontSize: 19, fontWeight: '600', textAlign: 'center', marginTop: 4 },
  usps: { backgroundColor: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderRadius: 22, padding: 16, gap: 12 },
  uspRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  uspIcon: { fontSize: 18 },
  usp: { color: Brand.cream, fontSize: 15, fontWeight: '500', flex: 1 },
  cta: { borderRadius: Radius.pill, overflow: 'hidden' },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '800', textAlign: 'center', paddingVertical: 16 },
  legal: { color: 'rgba(255,241,220,0.75)', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  link: { textDecorationLine: 'underline', fontWeight: '700', color: Brand.cream },
});
