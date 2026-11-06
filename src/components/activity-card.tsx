import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, Space, useTheme } from '@/constants/theme';
import { categoryOf, type Activity, type Person } from '@/lib/types';
import { formatWhen } from '@/lib/utils';

import { T } from './ui';

/** Overlapping round photos of the first members. */
export function Faces({ people, size = 28, max = 5, border }: { people: Person[]; size?: number; max?: number; border: string }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {people.slice(0, max).map((p, i) => (
        <Image key={p.id} source={p.photo} accessibilityLabel={p.name}
          style={{ width: size, height: size, borderRadius: size / 2, marginLeft: i ? -size / 3 : 0, borderWidth: 2, borderColor: border, backgroundColor: '#3A1358' }} />
      ))}
    </View>
  );
}

export function ActivityCard({ a, onPress }: { a: Activity; onPress: () => void }) {
  const c = useTheme();
  const cat = categoryOf(a.category);
  const full = a.memberCount >= a.maxPeople;
  const badge = a.cancelled ? 'Abgesagt' : a.isHost ? 'Du lädst ein' : a.joined ? 'Du bist dabei' : full ? 'Voll' : null;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${a.title}, ${formatWhen(a.startsAt)}`}
      style={({ pressed }) => [styles.card, { backgroundColor: c.surface, borderColor: a.joined || a.isHost ? Brand.text : c.border, opacity: pressed ? 0.85 : 1 }]}>
      <View style={styles.top}>
        <View style={[styles.emoji, { backgroundColor: c.dark ? '#2A1F36' : '#ECE6F2' }]}><Text style={{ fontSize: 26 }}>{cat.emoji}</Text></View>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="small" style={{ color: Brand.text, fontWeight: '700' }}>{formatWhen(a.startsAt)}</T>
          <T variant="h3" numberOfLines={2}>{a.title}</T>
          <T variant="small" muted numberOfLines={1}>
            📍 {a.place}{a.distanceKm != null && !a.isHost ? ` · ${a.distanceKm} km` : ''}
          </T>
        </View>
      </View>
      <View style={styles.bottom}>
        <Faces people={a.members} border={c.surface} />
        <T variant="small" muted style={{ flex: 1 }}>{a.memberCount} von {a.maxPeople} dabei</T>
        {badge && (
          <View style={[styles.badge, { backgroundColor: a.cancelled ? Brand.pass : a.joined || a.isHost ? Brand.primary : c.surfaceStrong }]}>
            <Text style={[styles.badgeText, { color: a.cancelled || a.joined || a.isHost ? '#fff' : c.text }]}>{badge}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, padding: Space.lg, gap: Space.md, borderWidth: 1 },
  top: { flexDirection: 'row', gap: Space.md },
  emoji: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  badge: { borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '800' },
});
