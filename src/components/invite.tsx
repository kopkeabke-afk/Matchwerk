import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, Space, useTheme } from '@/constants/theme';
import { backend } from '@/lib';
import { useSession } from '@/lib/session';
import type { Activity, Message } from '@/lib/types';

import { ActivityMini } from './activity-card';
import { Button, T } from './ui';

const upcoming = (a: Activity) => !a.cancelled && new Date(a.startsAt) > new Date();

/** "Gemeinsam hingehen": pick one of your or a nearby activity and invite your match to it. */
export function InviteSheet({ visible, name, onClose, onPick }: {
  visible: boolean; name: string; onClose: () => void; onPick: (a: Activity) => void;
}) {
  const c = useTheme();
  const { filters } = useSession();
  const [list, setList] = useState<Activity[] | null>(null);

  useEffect(() => {
    if (visible) backend.getActivities(filters.maxDistanceKm).then((l) => setList(l.filter(upcoming))).catch(() => setList([]));
  }, [visible, filters.maxDistanceKm]);

  const mine = (list ?? []).filter((a) => a.isHost || a.joined);
  const nearby = (list ?? []).filter((a) => !a.isHost && !a.joined && a.memberCount < a.maxPeople);
  const row = (a: Activity) => (
    <ActivityMini key={a.id} a={a} onPress={() => onPick(a)}
      right={<View style={styles.pick}><Text style={styles.pickText}>Einladen</Text></View>} />
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: c.overlay }]} onPress={onClose} accessibilityLabel="Schließen">
        <Pressable style={[styles.sheet, { backgroundColor: c.background }]} onPress={() => {}}>
          <View style={[styles.handle, { backgroundColor: c.border }]} />
          <T variant="h2" style={{ textAlign: 'center' }}>Gemeinsam hingehen 🎉</T>
          <T muted style={{ textAlign: 'center' }}>
            Lade {name} zu einer Aktivität ein – ein entspanntes erstes Treffen, in der Gruppe statt allein.
          </T>
          {list === null ? <ActivityIndicator color={Brand.text} style={{ marginVertical: Space.xl }} /> : (
            <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: Space.sm }}>
              {mine.length > 0 && <T variant="small" muted style={styles.section}>Deine Aktivitäten</T>}
              {mine.map(row)}
              {nearby.length > 0 && <T variant="small" muted style={styles.section}>In deiner Nähe</T>}
              {nearby.map(row)}
              {list.length === 0 && <T muted style={{ textAlign: 'center', marginVertical: Space.lg }}>Gerade ist nichts geplant – biete doch selbst etwas an!</T>}
            </ScrollView>
          )}
          <Button title="Selbst etwas anbieten" variant="secondary" icon="add-circle"
            onPress={() => { onClose(); router.push('/activity/new'); }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** A chat message that invites to an activity, shown as a small ticket. */
export function InviteBubble({ message, mine, name }: { message: Message; mine: boolean; name: string }) {
  const c = useTheme();
  const [a, setA] = useState<Activity | null | undefined>(undefined);
  useEffect(() => {
    if (message.activityId) backend.getActivity(message.activityId).then(setA).catch(() => setA(null));
  }, [message.activityId]);

  return (
    <View style={[styles.bubble, { alignSelf: mine ? 'flex-end' : 'flex-start', borderColor: Brand.accent, backgroundColor: c.surface }]}>
      <View style={styles.head}>
        <Ionicons name="sparkles" size={16} color={Brand.accent} />
        <T variant="small" style={{ fontWeight: '800', color: Brand.text }}>{mine ? `Du hast ${name} eingeladen` : `${name} lädt dich ein`}</T>
      </View>
      {!!message.text && <T>{message.text}</T>}
      {a === undefined ? <ActivityIndicator color={Brand.text} /> : a === null || a.cancelled ? (
        <T variant="small" muted>Diese Aktivität findet nicht mehr statt.</T>
      ) : (
        <ActivityMini a={a} onPress={() => router.push(`/activity/${a.id}`)}
          right={a.joined ? <Text style={[styles.joined, { color: Brand.text }]}>dabei ✓</Text> : <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Space.xl, gap: Space.md, paddingBottom: 40 },
  handle: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: Space.xs },
  section: { fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Space.xs },
  pick: { backgroundColor: Brand.primary, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  pickText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  bubble: { width: '86%', borderRadius: 20, borderWidth: 1.5, padding: 10, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  joined: { fontWeight: '800', fontSize: 13 },
});
