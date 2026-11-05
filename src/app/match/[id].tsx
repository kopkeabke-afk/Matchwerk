import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Button } from '@/components/ui';
import { Brand } from '@/constants/theme';
import { backend } from '@/lib';
import { useSession } from '@/lib/session';
import type { Match } from '@/lib/types';

/*
 * The match moment, in four beats:
 * 1. both photos fly in from the sides – still hidden behind a veil, you only see shapes
 * 2. they meet in the middle and a burst of gold sparks flies out
 * 3. "Es funkt!" appears
 * 4. the veil dissolves and both real photos become sharp
 */
const T_MEET = 650;
const T_WORD = 800;
const T_REVEAL = 1450;
const T_REST = 2100;

const SPARKS = Array.from({ length: 20 }, (_, i) => {
  const angle = (i / 20) * Math.PI * 2 + (i % 2 ? 0.15 : -0.15);
  const dist = 140 + (i % 4) * 30;
  return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist * 0.85, size: i % 3 === 0 ? 14 : 8 };
});

export default function MatchCelebration() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile: me } = useSession();
  const [m, setM] = useState<Match | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    backend.getMatch(id).then(setM).catch(() => {});
  }, [id]);

  const fly = useSharedValue(reduced ? 1 : 0); // 0 = off-screen, 1 = together
  const burst = useSharedValue(0);
  const word = useSharedValue(reduced ? 1 : 0);
  const reveal = useSharedValue(reduced ? 1 : 0); // 0 = veiled, 1 = sharp photos
  const rest = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    const buzz = () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); };
    fly.value = withTiming(1, { duration: T_MEET, easing: Easing.bezier(0.2, 0.9, 0.25, 1.15) }, (done) => {
      if (done) runOnJS(buzz)();
    });
    burst.value = withDelay(T_MEET - 60, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
    word.value = withDelay(T_WORD, withSpring(1, { damping: 9, stiffness: 140 }));
    reveal.value = withDelay(T_REVEAL, withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }));
    rest.value = withDelay(T_REST, withTiming(1, { duration: 450 }));
  }, [reduced, fly, burst, word, reveal, rest]);

  const friends = m?.mode === 'friends';

  return (
    <LinearGradient colors={['rgba(58,19,86,0.98)', 'rgba(22,6,32,0.99)']} style={styles.wrap}>
      <Glow burst={burst} />

      <View style={styles.stage}>
        <Card side={-1} uri={me?.photos[0]} fly={fly} reveal={reveal} />
        <Card side={1} uri={m?.profile.photos[0]} fly={fly} reveal={reveal} />
        {SPARKS.map((s, i) => <Spark key={i} {...s} burst={burst} />)}
        <Word word={word} text={friends ? 'Neue Verbindung!' : 'Es funkt!'} />
      </View>

      <Fade v={rest} style={{ alignSelf: 'stretch', gap: 14 }}>
        <Text style={styles.sub}>
          {friends
            ? `Du und ${m?.profile.name ?? '…'} wollt euch kennenlernen. Schlagt doch gleich etwas vor!`
            : `Du und ${m?.profile.name ?? '…'} mögt euch gegenseitig.`}
        </Text>
        {m?.opener === 'them' && (
          <Text style={styles.hint}>{m.profile.name} macht den ersten Schritt – wir sagen dir Bescheid.</Text>
        )}
        <Button
          title={m?.opener === 'them' ? 'Zum Chat' : 'Nachricht schreiben'}
          variant="secondary"
          icon="chatbubble-ellipses"
          onPress={() => { router.back(); router.push(`/chat/${id}`); }}
        />
        <Text style={styles.later} onPress={() => router.back()} accessibilityRole="button">Weiter entdecken</Text>
      </Fade>
    </LinearGradient>
  );
}

/** One photo card: flies in from its side, veiled at first, then dissolves into the real photo. */
function Card({ side, uri, fly, reveal }: { side: -1 | 1; uri?: string; fly: SharedValue<number>; reveal: SharedValue<number> }) {
  const card = useAnimatedStyle(() => ({
    opacity: Math.min(1, fly.value * 2.5),
    transform: [
      { translateX: side * (46 + (1 - fly.value) * 260) },
      { translateY: (1 - fly.value) * 40 },
      { rotate: `${side * (8 + (1 - fly.value) * 22)}deg` },
      { scale: 0.85 + fly.value * 0.15 },
    ],
  }));
  const sharp = useAnimatedStyle(() => ({ opacity: reveal.value }));
  const veil = useAnimatedStyle(() => ({ opacity: 1 - reveal.value }));
  return (
    <Animated.View style={[styles.card, card]}>
      {/* blurred stand-in: you see that someone is there, not who */}
      <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={40} />
      <Animated.View style={[StyleSheet.absoluteFill, sharp]}>
        <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.veil, veil]} />
    </Animated.View>
  );
}

function Spark({ dx, dy, size, burst }: { dx: number; dy: number; size: number; burst: SharedValue<number> }) {
  const st = useAnimatedStyle(() => ({
    opacity: burst.value === 0 ? 0 : 1 - burst.value,
    transform: [{ translateX: dx * burst.value }, { translateY: dy * burst.value }, { scale: 1 - burst.value * 0.5 }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.spark, { width: size, height: size, borderRadius: size / 2 }, st]} />;
}

function Word({ word, text }: { word: SharedValue<number>; text: string }) {
  const st = useAnimatedStyle(() => ({
    opacity: Math.min(1, word.value * 1.5),
    transform: [{ scale: 0.4 + word.value * 0.6 }, { rotate: `${(1 - word.value) * -6}deg` }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.wordWrap, st]}>
      <Text style={styles.word} accessibilityRole="header">{text}</Text>
    </Animated.View>
  );
}

function Glow({ burst }: { burst: SharedValue<number> }) {
  const st = useAnimatedStyle(() => ({ opacity: burst.value === 0 ? 0 : 0.4 + 0.6 * Math.min(1, burst.value * 3) }));
  return (
    <Animated.View pointerEvents="none" style={[styles.glowWrap, st]}>
      {[460, 360, 270, 190].map((d, i) => (
        <View key={d} style={{ position: 'absolute', width: d, height: d, borderRadius: d / 2, backgroundColor: i < 2 ? Brand.primary : Brand.accent, opacity: 0.07 + i * 0.02 }} />
      ))}
    </Animated.View>
  );
}

function Fade({ v, style, children }: { v: SharedValue<number>; style?: object; children: ReactNode }) {
  const st = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: (1 - v.value) * 16 }] }));
  return <Animated.View style={[style, st]} pointerEvents="box-none">{children}</Animated.View>;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 24 },
  glowWrap: { position: 'absolute', top: '18%', left: 0, right: 0, height: 460, alignItems: 'center', justifyContent: 'center' },
  stage: { width: '100%', height: 360, alignItems: 'center', justifyContent: 'center' },
  card: {
    position: 'absolute', width: 150, height: 205, borderRadius: 22, overflow: 'hidden',
    borderWidth: 4, borderColor: '#FFF1DC', backgroundColor: '#3A1358',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  veil: { backgroundColor: 'rgba(58,19,86,0.55)' },
  spark: { position: 'absolute', backgroundColor: Brand.accent, shadowColor: Brand.accent, shadowOpacity: 0.9, shadowRadius: 6 },
  wordWrap: { position: 'absolute', bottom: -6, left: 0, right: 0, alignItems: 'center' },
  word: {
    color: '#FFE3A3', fontSize: 52, fontWeight: '900', fontStyle: 'italic', letterSpacing: -1, textAlign: 'center',
    textShadowColor: 'rgba(233,169,46,0.55)', textShadowRadius: 18, textShadowOffset: { width: 0, height: 0 },
  },
  sub: { color: '#fff', fontSize: 17, textAlign: 'center' },
  later: { color: '#FFF1DC', fontSize: 16, fontWeight: '700', textAlign: 'center', paddingVertical: 12 },
  hint: { color: '#fff', textAlign: 'center', fontWeight: '600' },
});
