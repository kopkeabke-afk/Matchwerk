import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brand, Radius, Space, useTheme } from '@/constants/theme';
import type { Activity, ActivityCategory, Person } from '@/lib/types';
import { formatWhen } from '@/lib/utils';

import { T } from './ui';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Calm category look: one plum gradient family, a single thin gold line icon.
 * The shades shift only slightly between categories so a list stays quiet.
 */
export const CATEGORY_STYLE: Record<ActivityCategory, { icon: IconName; colors: readonly [string, string] }> = {
  coffee: { icon: 'cafe-outline', colors: ['#5E2E5C', '#2A0E3F'] },
  hike: { icon: 'trail-sign-outline', colors: ['#3F3A78', '#1F1238'] },
  drinks: { icon: 'beer-outline', colors: ['#6B3150', '#2A0E3F'] },
  games: { icon: 'dice-outline', colors: ['#4B2C86', '#22103F'] },
  sport: { icon: 'bicycle-outline', colors: ['#2F4776', '#1A1236'] },
  culture: { icon: 'color-palette-outline', colors: ['#6E2C6F', '#2A0E3F'] },
  food: { icon: 'restaurant-outline', colors: ['#6A3A45', '#2A0E3F'] },
  other: { icon: 'sparkles-outline', colors: ['#5B2687', '#2A0E3F'] },
};

/** The picture of an activity: the host's own photo, otherwise the calm category cover. */
export function ActivityCover({ a, iconSize = 26, style }: {
  a: Pick<Activity, 'coverUrl' | 'category'>; iconSize?: number; style?: StyleProp<ViewStyle>;
}) {
  if (a.coverUrl) {
    return (
      <View style={[{ overflow: 'hidden', backgroundColor: '#2A0E3F' }, style]}>
        <Image source={{ uri: a.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      </View>
    );
  }
  const st = CATEGORY_STYLE[a.category] ?? CATEGORY_STYLE.other;
  return (
    <LinearGradient colors={st.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.coverBox, style]}>
      <Ionicons name={st.icon} size={iconSize} color="#F4D58D" />
    </LinearGradient>
  );
}

/** Overlapping round photos of the first members. */
export function Faces({ people, size = 22, max = 4, border }: { people: Person[]; size?: number; max?: number; border: string }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {people.slice(0, max).map((p, i) => (
        <Image key={p.id} source={p.photo} accessibilityLabel={p.name}
          style={{ width: size, height: size, borderRadius: size / 2, marginLeft: i ? -size / 3 : 0, borderWidth: 1.5, borderColor: border, backgroundColor: '#3A1358' }} />
      ))}
    </View>
  );
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

/** "Heute" · "Morgen" · "Samstag, 7. November" – headers of the agenda. */
export function dayLabel(iso: string, now = new Date()) {
  const d = new Date(iso);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / 86_400_000);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Morgen';
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

function status(a: Activity): { text: string; color: string } | null {
  if (a.cancelled) return { text: 'Abgesagt', color: Brand.pass };
  if (a.isHost) return { text: 'Du lädst ein', color: Brand.accent };
  if (a.joined) return { text: 'Dabei ✓', color: Brand.accent };
  if (a.memberCount >= a.maxPeople) return { text: 'Voll', color: '#9A8FA6' };
  return null;
}

/**
 * One activity as a compact agenda row: time, small picture, title, place and who is coming.
 * Six or seven fit on a phone screen.
 */
export function ActivityRow({ a, onPress, last }: { a: Activity; onPress: () => void; last?: boolean }) {
  const c = useTheme();
  const free = Math.max(0, a.maxPeople - a.memberCount);
  const st = status(a);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${a.title}, ${formatWhen(a.startsAt)}, ${a.place}`}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.surfaceStrong : 'transparent' }]}>
      <View style={styles.time}>
        <Text style={[styles.timeText, { color: c.text }]}>{timeOf(a.startsAt)}</Text>
      </View>
      <ActivityCover a={a} style={styles.thumb} iconSize={24} />
      <View style={[styles.info, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}>
        <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>{a.title}</Text>
        <Text style={[styles.meta, { color: c.textSecondary }]} numberOfLines={1}>
          {a.place}{a.distanceKm != null && !a.isHost ? ` · ${a.distanceKm} km` : ''}
        </Text>
        <View style={styles.people}>
          <Faces people={a.members} border={c.surface} />
          <Text style={[styles.meta, { color: c.textSecondary }]}>
            {a.memberCount} dabei{!a.cancelled && free > 0 ? ` · ${free} frei` : ''}
          </Text>
          <View style={{ flex: 1 }} />
          {st && <Text style={[styles.status, { color: st.color }]}>{st.text}</Text>}
        </View>
      </View>
    </Pressable>
  );
}

/** Several rows grouped under day headers, each day on one calm card. */
export function ActivityAgenda({ list, onOpen }: { list: Activity[]; onOpen: (a: Activity) => void }) {
  const c = useTheme();
  const days: { label: string; items: Activity[] }[] = [];
  for (const a of list) {
    const label = dayLabel(a.startsAt);
    const g = days[days.length - 1];
    if (g?.label === label) g.items.push(a);
    else days.push({ label, items: [a] });
  }
  return (
    <View style={{ gap: Space.md }}>
      {days.map((d) => (
        <View key={d.label} style={{ gap: 6 }}>
          <Text style={[styles.day, { color: Brand.text }]}>{d.label}</Text>
          <View style={[styles.group, { backgroundColor: c.surface }]}>
            {d.items.map((a, i) => <ActivityRow key={a.id} a={a} onPress={() => onOpen(a)} last={i === d.items.length - 1} />)}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Small horizontal entry for lists inside other screens (profile, invites, chat). */
export function ActivityMini({ a, onPress, right }: { a: Activity; onPress?: () => void; right?: ReactNode }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${a.title}, ${formatWhen(a.startsAt)}`}
      style={({ pressed }) => [styles.mini, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.85 : 1 }]}>
      <ActivityCover a={a} style={styles.miniImg} iconSize={22} />
      <View style={{ flex: 1, gap: 1 }}>
        <T variant="small" style={{ color: Brand.text, fontWeight: '800' }}>{formatWhen(a.startsAt)}</T>
        <T style={{ fontWeight: '700' }} numberOfLines={1}>{a.title}</T>
        <T variant="small" muted numberOfLines={1}>{a.place} · {a.memberCount}/{a.maxPeople} dabei</T>
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  coverBox: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  day: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', paddingHorizontal: 4 },
  group: { borderRadius: Radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: Space.md, gap: Space.md },
  time: { width: 44 },
  timeText: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  thumb: { width: 52, height: 52, borderRadius: 14 },
  info: { flex: 1, paddingVertical: 12, paddingRight: Space.md, gap: 2 },
  title: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13 },
  people: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  status: { fontSize: 12, fontWeight: '800' },
  mini: { flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: 10, borderRadius: Radius.lg, borderWidth: 1 },
  miniImg: { width: 52, height: 52, borderRadius: 12 },
});
