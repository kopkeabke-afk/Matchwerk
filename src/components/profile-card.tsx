import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, Radius } from '@/constants/theme';
import { INTENTION_EMOJI, INTENTION_LABELS, type Profile } from '@/lib/types';
import { ageFrom, type Compatibility } from '@/lib/utils';

/** The visual swipe card: tap left/right edges to browse photos, tap ⓘ for the full profile. */
export function ProfileCard({ profile, compat, onInfo, spark }: {
  profile: Profile; compat?: Compatibility; onInfo?: () => void; spark?: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const photos = profile.photos.length ? profile.photos : [undefined];
  const go = (d: number) => setIdx((i) => Math.max(0, Math.min(photos.length - 1, i + d)));

  return (
    <View style={styles.card}>
      <Image source={photos[idx]} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }} />
      <View style={styles.tapZones}>
        <Pressable style={{ flex: 1 }} onPress={() => go(-1)} accessibilityLabel="Vorheriges Foto" />
        <Pressable style={{ flex: 1 }} onPress={() => go(1)} accessibilityLabel="Nächstes Foto" />
      </View>
      {photos.length > 1 && (
        <View style={styles.bars} pointerEvents="none">
          {photos.map((_, i) => (
            <View key={i} style={[styles.bar, { backgroundColor: i === idx ? '#fff' : 'rgba(255,255,255,0.4)' }]} />
          ))}
        </View>
      )}
      <View style={styles.badges} pointerEvents="none">
        {spark && (
          <View style={[styles.badge, { backgroundColor: Brand.gold }]}>
            <Text style={styles.badgeText}>✨ Daily Spark</Text>
          </View>
        )}
        {compat && (
          <View style={[styles.badge, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
            <Text style={styles.badgeText}>🔥 {compat.score}% Match</Text>
          </View>
        )}
      </View>
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.bottom} pointerEvents="box-none">
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }} pointerEvents="box-none">
          <View style={{ flex: 1, gap: 6 }} pointerEvents="none">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.name}>{profile.name}</Text>
              <Text style={styles.age}>{ageFrom(profile.birthdate)}</Text>
              {profile.verified && <Ionicons name="checkmark-circle" size={22} color={Brand.super} />}
            </View>
            {idx === 0 ? (
              <>
                {profile.job && <Text style={styles.meta}>💼 {profile.job}</Text>}
                <Text style={styles.meta}>
                  📍 {profile.distanceKm != null ? `${profile.distanceKm} km entfernt` : profile.city}
                </Text>
                <Text style={styles.meta}>{INTENTION_EMOJI[profile.intention]} {INTENTION_LABELS[profile.intention]}</Text>
              </>
            ) : idx === 1 && profile.prompts[0] ? (
              <>
                <Text style={[styles.meta, { opacity: 0.8 }]}>{profile.prompts[0].question}</Text>
                <Text style={styles.prompt}>{profile.prompts[0].answer}</Text>
              </>
            ) : (
              <Text style={styles.meta} numberOfLines={3}>{profile.bio}</Text>
            )}
            {compat && compat.shared.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {compat.shared.slice(0, 3).map((s) => (
                  <View key={s} style={styles.shared}><Text style={styles.sharedText}>♥ {s}</Text></View>
                ))}
              </View>
            )}
          </View>
          {onInfo && (
            <Pressable onPress={onInfo} hitSlop={12} accessibilityLabel="Ganzes Profil ansehen" style={styles.info}>
              <Ionicons name="chevron-up" size={22} color="#fff" />
            </Pressable>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: Radius.xl, overflow: 'hidden', backgroundColor: '#222' },
  tapZones: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', bottom: 180 },
  bars: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  badges: { position: 'absolute', top: 24, left: 12, gap: 6, alignItems: 'flex-start' },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, paddingTop: 80 },
  name: { color: '#fff', fontSize: 32, fontWeight: '800' },
  age: { color: '#fff', fontSize: 28, fontWeight: '400' },
  meta: { color: '#fff', fontSize: 15, fontWeight: '500' },
  prompt: { color: '#fff', fontSize: 20, fontWeight: '700' },
  shared: { backgroundColor: 'rgba(255,77,109,0.85)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill },
  sharedText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  info: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
});
