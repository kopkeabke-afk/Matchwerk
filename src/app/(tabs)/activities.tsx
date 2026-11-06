import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivityAgenda } from '@/components/activity-card';
import { Button, Empty, T } from '@/components/ui';
import { Brand, Radius, Space, TabInset, useTheme, WebTabTop } from '@/constants/theme';
import { backend } from '@/lib';
import { useSession } from '@/lib/session';
import { ACTIVITY_CATEGORIES, type Activity, type ActivityCategory } from '@/lib/types';

export default function Activities() {
  const c = useTheme();
  const { filters } = useSession();
  const [list, setList] = useState<Activity[] | null>(null);
  const [cat, setCat] = useState<ActivityCategory | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setList(await backend.getActivities(filters.maxDistanceKm));
    } catch {
      setList((l) => l ?? []);
    }
  }, [filters.maxDistanceKm]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const mine = (list ?? []).filter((a) => a.isHost || a.joined);
  const nearby = (list ?? []).filter((a) => !a.isHost && !a.joined && (!cat || a.category === cat));
  const open = (a: Activity) => router.push(`/activity/${a.id}`);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <View style={{ height: WebTabTop }} />
      <ScrollView
        contentContainerStyle={{ padding: Space.lg, paddingBottom: TabInset + Space.xxl, gap: Space.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={Brand.text}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <T variant="title">Aktivitäten</T>
            <T muted>Gemeinsam etwas unternehmen – mit Gruppenchat. Für alle Altersgruppen.</T>
          </View>
        </View>
        <Button title="Aktivität anbieten" icon="add-circle" onPress={() => router.push('/activity/new')} />

        {list === null ? (
          <ActivityIndicator color={Brand.text} style={{ marginTop: Space.xxl }} />
        ) : (
          <>
            {mine.length > 0 && (
              <View style={{ gap: Space.md }}>
                <T variant="h2">Deine Aktivitäten</T>
                <ActivityAgenda list={mine} onOpen={open} />
              </View>
            )}

            <View style={{ gap: Space.md }}>
              <T variant="h2">In deiner Nähe</T>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -Space.lg }}
                contentInset={{ left: Space.lg }}>
                <View style={{ width: Space.lg - 8 }} />
                {[null, ...ACTIVITY_CATEGORIES.map((x) => x.id)].map((id) => {
                  const on = cat === id;
                  const info = ACTIVITY_CATEGORIES.find((x) => x.id === id);
                  return (
                    <Pressable key={id ?? 'all'} onPress={() => setCat(id)} accessibilityRole="button" accessibilityState={{ selected: on }}
                      style={[styles.filter, { backgroundColor: on ? Brand.primary : c.surface, borderColor: on ? Brand.primary : c.border }]}>
                      <Text style={{ color: on ? '#fff' : c.text, fontWeight: '700', fontSize: 14 }}>{info ? info.label : 'Alle'}</Text>
                    </Pressable>
                  );
                })}
                <View style={{ width: Space.lg - 8 }} />
              </ScrollView>
              {nearby.length === 0 ? (
                <Empty icon="people" title="Noch nichts in deiner Nähe"
                  text={cat ? 'In dieser Kategorie gibt es gerade nichts. Starte doch selbst etwas!' : 'Sei die erste Person und biete etwas an – Kaffee, Wandern, Spieleabend …'} />
              ) : (
                <ActivityAgenda list={nearby} onOpen={open} />
              )}
            </View>

            <View style={[styles.safety, { backgroundColor: c.surface }]}>
              <Ionicons name="shield-checkmark" size={20} color={Brand.text} />
              <T variant="small" muted style={{ flex: 1 }}>
                Trefft euch an öffentlichen Orten und sagt jemandem Bescheid, wohin ihr geht. Unangenehmes Verhalten kannst du jederzeit melden.
              </T>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: Space.md },
  filter: { borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  safety: { flexDirection: 'row', gap: Space.md, padding: Space.lg, borderRadius: Radius.lg, alignItems: 'flex-start' },
});
