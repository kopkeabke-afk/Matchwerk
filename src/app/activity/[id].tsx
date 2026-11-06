import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Empty, T } from '@/components/ui';
import { Brand, Radius, Space, useTheme } from '@/constants/theme';
import { backend } from '@/lib';
import { categoryOf, type Activity, type Person } from '@/lib/types';
import { formatWhen } from '@/lib/utils';
import { coverOf } from '@/lib/covers';

/** Ask before something irreversible – works on native and web. */
function confirm(title: string, text: string, ok: string, run: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${text}`)) run();
    return;
  }
  Alert.alert(title, text, [{ text: 'Abbrechen', style: 'cancel' }, { text: ok, style: 'destructive', onPress: run }]);
}

export default function ActivityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [a, setA] = useState<Activity | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => { backend.getActivity(id).then(setA).catch(() => setA(null)); }, [id]);
  useFocusEffect(load);

  async function run(fn: () => Promise<void>, after?: () => void) {
    setBusy(true);
    try {
      await fn();
      if (after) after(); else load();
    } catch (e) {
      Alert.alert('Hat nicht geklappt', (e as Error).message);
      load();
    } finally {
      setBusy(false);
    }
  }

  if (a === undefined) return <View style={{ flex: 1, backgroundColor: c.background, justifyContent: 'center' }}><ActivityIndicator color={Brand.text} /></View>;
  if (a === null) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <Empty icon="calendar-clear-outline" title="Nicht mehr verfügbar" text="Diese Aktivität wurde abgesagt oder ist nicht mehr sichtbar.">
          <Button title="Zurück" variant="secondary" onPress={() => router.back()} />
        </Empty>
      </View>
    );
  }

  const cat = categoryOf(a.category);
  const full = a.memberCount >= a.maxPeople;
  const started = new Date(a.startsAt) < new Date();
  const inGroup = a.joined || a.isHost;
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([a.place, a.city].filter(Boolean).join(', '))}`;

  const member = (p: Person) => (
    <View key={p.id} style={styles.member}>
      <Image source={p.photo} style={styles.memberImg} />
      <View style={{ flex: 1 }}>
        <T style={{ fontWeight: '700' }}>{p.name}, {p.age} {p.verified ? '✓' : ''}</T>
        {p.id === a.host.id && <T variant="small" style={{ color: Brand.text, fontWeight: '700' }}>lädt ein</T>}
      </View>
      {a.isHost && p.id !== a.host.id && (
        <Pressable hitSlop={10} accessibilityLabel={`${p.name} entfernen`}
          onPress={() => confirm(`${p.name} entfernen?`, `${p.name} ist dann nicht mehr in der Gruppe und im Gruppenchat.`, 'Entfernen',
            () => run(() => backend.removeActivityMember(a.id, p.id)))}>
          <Ionicons name="close-circle-outline" size={22} color={c.textSecondary} />
        </Pressable>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{
        title: '',
        headerRight: () => (
          <Pressable hitSlop={10} accessibilityLabel="Melden"
            onPress={() => router.push({ pathname: '/report/[id]', params: { id: a.host.id } })}>
            <Ionicons name="flag-outline" size={22} color={Brand.text} />
          </Pressable>
        ),
      }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View>
          <Image source={coverOf(a)} style={styles.cover} contentFit="cover" transition={150} />
          <LinearGradient colors={['rgba(20,6,30,0)', 'rgba(20,6,30,0.85)']} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
          <View style={styles.heroText}>
            <Text style={styles.heroCat}>{cat.emoji} {cat.label}</Text>
            <Text style={styles.heroTitle}>{a.title}</Text>
            {a.cancelled && <View style={styles.cancelled}><Text style={{ color: '#fff', fontWeight: '800' }}>Abgesagt</Text></View>}
          </View>
        </View>

        <View style={{ padding: Space.lg, gap: Space.lg }}>
          <View style={[styles.box, { backgroundColor: c.surface }]}>
            <View style={styles.line}><Ionicons name="calendar" size={20} color={Brand.text} /><T style={{ fontWeight: '700' }}>{formatWhen(a.startsAt)}</T></View>
            <Pressable style={styles.line} onPress={() => Linking.openURL(maps)} accessibilityRole="link" accessibilityLabel={`Treffpunkt ${a.place} in Karten öffnen`}>
              <Ionicons name="location" size={20} color={Brand.text} />
              <T style={{ fontWeight: '700', flex: 1 }}>{a.place}{a.city ? `, ${a.city}` : ''}</T>
              <Ionicons name="open-outline" size={16} color={c.textSecondary} />
            </Pressable>
            {!a.isHost && a.distanceKm != null && <View style={styles.line}><Ionicons name="navigate" size={20} color={Brand.text} /><T>{a.distanceKm} km von dir</T></View>}
            <View style={styles.line}><Ionicons name="people" size={20} color={Brand.text} /><T>{a.memberCount} von {a.maxPeople} dabei{full ? ' · voll' : ''}</T></View>
          </View>

          {!!a.description && <T style={{ fontSize: 17, lineHeight: 24 }}>{a.description}</T>}

          <View style={{ gap: Space.sm }}>
            <T variant="h3">Wer ist dabei?</T>
            {a.members.map(member)}
          </View>

          <View style={[styles.box, { backgroundColor: c.surface, flexDirection: 'row', gap: Space.md }]}>
            <Ionicons name="shield-checkmark" size={18} color={Brand.text} />
            <T variant="small" muted style={{ flex: 1 }}>
              Trefft euch an öffentlichen Orten. Wenn sich jemand danebenbenimmt, melde es oben rechts über die Fahne – wir prüfen jede Meldung.
            </T>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bar, { backgroundColor: c.background, borderTopColor: c.border, paddingBottom: insets.bottom + Space.md }]}>
        {inGroup ? (
          <>
            <Button title="Zum Gruppenchat" icon="chatbubbles" style={{ flex: 1 }} onPress={() => router.push(`/activity/chat/${a.id}`)} />
            {!a.cancelled && (a.isHost ? (
              <Button title="Absagen" variant="secondary" disabled={busy}
                onPress={() => confirm('Aktivität absagen?', 'Alle Teilnehmenden sehen, dass sie abgesagt ist. Das lässt sich nicht rückgängig machen.', 'Absagen',
                  () => run(() => backend.cancelActivity(a.id)))} />
            ) : (
              <Button title="Austreten" variant="secondary" disabled={busy}
                onPress={() => confirm('Austreten?', 'Du verlässt die Gruppe und den Gruppenchat.', 'Austreten',
                  () => run(() => backend.leaveActivity(a.id), () => router.back()))} />
            ))}
          </>
        ) : (
          <Button title={a.cancelled ? 'Abgesagt' : started ? 'Hat schon begonnen' : full ? 'Leider schon voll' : 'Mitmachen'}
            icon="hand-right" style={{ flex: 1 }} loading={busy} disabled={a.cancelled || started || full}
            onPress={() => run(() => backend.joinActivity(a.id), () => { load(); router.push(`/activity/chat/${a.id}`); })} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#2A0E3F' },
  heroText: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: Space.xl, gap: 4, alignItems: 'flex-start' },
  heroCat: { color: '#FFE3A3', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 13 },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.4 },
  cancelled: { marginTop: 8, backgroundColor: Brand.pass, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 4 },
  box: { borderRadius: Radius.lg, padding: Space.lg, gap: Space.md },
  line: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  member: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  memberImg: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#3A1358' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: Space.md , padding: Space.lg, borderTopWidth: StyleSheet.hairlineWidth },
});
