import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, Space, useTheme } from '@/constants/theme';
import { coverOf } from '@/lib/covers';
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

/** The tear-off date of a ticket: weekday, big day number, month. */
function DateStub({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <View style={styles.stub} accessibilityElementsHidden>
      <Text style={styles.stubDay}>{d.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '')}</Text>
      <Text style={styles.stubNum}>{d.getDate()}</Text>
      <Text style={styles.stubMonth}>{d.toLocaleDateString('de-DE', { month: 'short' }).replace('.', '')}</Text>
    </View>
  );
}

function badgeOf(a: Activity) {
  if (a.cancelled) return { text: 'Abgesagt', bg: Brand.pass, fg: '#fff' };
  if (a.isHost) return { text: 'Du lädst ein', bg: Brand.accent, fg: '#2A0E3F' };
  if (a.joined) return { text: 'Du bist dabei ✓', bg: Brand.accent, fg: '#2A0E3F' };
  if (a.memberCount >= a.maxPeople) return { text: 'Voll', bg: 'rgba(20,6,30,0.75)', fg: '#fff' };
  return null;
}

/**
 * An activity as a Matchwerk ticket: big picture with the date stub, a perforated
 * tear-off line, then title, time, place and who is coming.
 */
export function ActivityCard({ a, onPress, pageBg }: { a: Activity; onPress: () => void; pageBg?: string }) {
  const c = useTheme();
  const cat = categoryOf(a.category);
  const free = Math.max(0, a.maxPeople - a.memberCount);
  const badge = badgeOf(a);
  const notch = pageBg ?? c.background;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${a.title}, ${formatWhen(a.startsAt)}, ${a.place}`}
      style={({ pressed }) => [styles.ticket, { backgroundColor: c.surface, transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
      <View>
        <Image source={coverOf(a)} style={styles.cover} contentFit="cover" transition={150} />
        <LinearGradient colors={['rgba(20,6,30,0)', 'rgba(20,6,30,0.55)']} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <DateStub iso={a.startsAt} />
        {badge && <View style={[styles.badge, { backgroundColor: badge.bg }]}><Text style={[styles.badgeText, { color: badge.fg }]}>{badge.text}</Text></View>}
        <View style={styles.catChip}><Text style={styles.catText}>{cat.emoji} {cat.label}</Text></View>
      </View>

      {/* perforated tear-off line */}
      <View style={styles.perf}>
        <View style={[styles.notch, { left: -11, backgroundColor: notch }]} />
        <View style={[styles.dashes, { borderColor: c.border }]} />
        <View style={[styles.notch, { right: -11, backgroundColor: notch }]} />
      </View>

      <View style={styles.body}>
        <T variant="h3" numberOfLines={2} style={{ fontSize: 19 }}>{a.title}</T>
        <T variant="small" muted numberOfLines={1}>
          🕙 {formatWhen(a.startsAt)} · 📍 {a.place}
          {a.distanceKm != null && !a.isHost ? ` · ${a.distanceKm} km` : ''}
        </T>
        <View style={styles.row}>
          <Faces people={a.members} border={c.surface} />
          <T variant="small" muted style={{ flex: 1 }}>{a.memberCount} dabei</T>
          {!a.cancelled && (
            <Text style={[styles.free, { color: free ? Brand.text : c.textSecondary }]}>
              {free ? `${free} ${free === 1 ? 'Platz' : 'Plätze'} frei` : 'ausgebucht'}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

/** Small horizontal ticket for lists inside other screens (profile, invites, chat). */
export function ActivityMini({ a, onPress, right }: { a: Activity; onPress?: () => void; right?: ReactNode }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${a.title}, ${formatWhen(a.startsAt)}`}
      style={({ pressed }) => [styles.mini, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.85 : 1 }]}>
      <Image source={coverOf(a)} style={styles.miniImg} contentFit="cover" />
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="small" style={{ color: Brand.text, fontWeight: '800' }}>{formatWhen(a.startsAt)}</T>
        <T style={{ fontWeight: '700' }} numberOfLines={1}>{a.title}</T>
        <T variant="small" muted numberOfLines={1}>📍 {a.place} · {a.memberCount}/{a.maxPeople} dabei</T>
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ticket: { borderRadius: Radius.xl, overflow: 'hidden' },
  cover: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#2A0E3F' },
  stub: {
    position: 'absolute', top: 12, left: 12, width: 58, paddingVertical: 6, borderRadius: 14, alignItems: 'center',
    backgroundColor: '#FFF6E6', borderWidth: 2, borderColor: Brand.accent,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  stubDay: { color: '#8A5A12', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  stubNum: { color: '#2A0E3F', fontSize: 24, fontWeight: '900', lineHeight: 26 },
  stubMonth: { color: '#5B2687', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  badge: { position: 'absolute', top: 14, right: 12, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 12, fontWeight: '800' },
  catChip: { position: 'absolute', left: 12, bottom: 12, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(20,6,30,0.6)' },
  catText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  perf: { height: 22, justifyContent: 'center' },
  notch: { position: 'absolute', top: 0, width: 22, height: 22, borderRadius: 11 },
  dashes: { marginHorizontal: 18, borderTopWidth: 2, borderStyle: 'dashed' },
  body: { paddingHorizontal: Space.lg, paddingBottom: Space.lg, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, marginTop: 4 },
  free: { fontSize: 13, fontWeight: '800' },
  mini: { flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: 10, borderRadius: Radius.lg, borderWidth: 1 },
  miniImg: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#2A0E3F' },
});
