import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T } from '@/components/ui';
import { Brand, Space, useTheme } from '@/constants/theme';
import { backend } from '@/lib';
import { useSession } from '@/lib/session';
import { categoryOf, type Activity, type ActivityMessage, type Person } from '@/lib/types';
import { formatWhen } from '@/lib/utils';

export default function GroupChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { userId } = useSession();
  const [a, setA] = useState<Activity | null>(null);
  const [msgs, setMsgs] = useState<ActivityMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const list = useRef<FlatList<ActivityMessage>>(null);

  const load = useCallback(async () => {
    const [act, ms] = await Promise.all([backend.getActivity(id), backend.getActivityMessages(id)]);
    setA(act);
    setMsgs(ms);
  }, [id]);
  // load() sets state only after awaiting the backend
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  const memberIds = useRef(new Set<string>());
  useEffect(() => { memberIds.current = new Set((a?.members ?? []).map((p) => p.id)); }, [a]);
  useEffect(() => backend.subscribeActivityMessages(id, (m) => {
    setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    // a new face in the group: refresh the member list
    if (!memberIds.current.has(m.senderId)) load();
  }), [id, load]);

  async function send() {
    const t = text.trim();
    if (!t) return;
    setSending(true);
    try {
      const m = await backend.sendActivityMessage(id, t);
      setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      setText('');
    } catch (e) {
      Alert.alert('Nachricht nicht gesendet', (e as Error).message);
    } finally {
      setSending(false);
    }
  }

  const people = new Map<string, Person>((a?.members ?? []).map((p) => [p.id, p]));
  const closed = !!a?.cancelled;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <Stack.Screen options={{
        headerTitle: () => (
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Details der Aktivität">
            <T variant="h3" numberOfLines={1}>{a ? `${categoryOf(a.category).emoji} ${a.title}` : 'Gruppenchat'}</T>
            {a && <T variant="small" muted numberOfLines={1}>{formatWhen(a.startsAt)} · {a.memberCount} dabei</T>}
          </Pressable>
        ),
      }} />
      <FlatList
        ref={list}
        data={msgs}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: Space.lg, gap: 8, flexGrow: 1 }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={
          <View style={[styles.intro, { backgroundColor: c.surface }]}>
            <T style={{ textAlign: 'center', fontWeight: '700' }}>Willkommen im Gruppenchat 👋</T>
            <T variant="small" muted style={{ textAlign: 'center' }}>
              Stimmt hier Treffpunkt und Uhrzeit ab. Alle, die mitmachen, lesen mit.
            </T>
          </View>
        }
        renderItem={({ item, index }) => {
          const mine = item.senderId === userId || item.senderId === 'me';
          const who = people.get(item.senderId);
          const showName = !mine && msgs[index - 1]?.senderId !== item.senderId;
          return (
            <View style={[styles.row, mine && { justifyContent: 'flex-end' }]}>
              {!mine && (showName ? <Image source={who?.photo} style={styles.avatar} /> : <View style={styles.avatar} />)}
              <View style={[styles.bubble, mine ? styles.mine : { backgroundColor: c.surface, borderBottomLeftRadius: 6 }]}>
                {showName && <T variant="small" style={{ color: Brand.text, fontWeight: '800' }}>{who?.name ?? 'Ehemaliges Mitglied'}</T>}
                <T style={{ color: mine ? '#fff' : c.text }}>{item.text}</T>
              </View>
            </View>
          );
        }}
      />
      <View style={[styles.composer, { borderTopColor: c.border, paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          editable={!closed}
          placeholder={closed ? 'Diese Aktivität ist abgesagt' : 'Nachricht an die Gruppe …'}
          placeholderTextColor={c.textSecondary}
          multiline
          maxLength={2000}
          style={[styles.input, { color: c.text, backgroundColor: c.surface }]}
        />
        <Pressable onPress={send} disabled={!text.trim() || sending || closed} accessibilityLabel="Senden"
          style={[styles.send, { opacity: !text.trim() || closed ? 0.4 : 1 }]}>
          <Ionicons name="arrow-up" size={22} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  intro: { borderRadius: 16, padding: Space.lg, gap: 4, marginBottom: Space.md },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  avatar: { width: 30, height: 30, borderRadius: 15 },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, gap: 2 },
  mine: { backgroundColor: Brand.primary, borderBottomRightRadius: 6 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: Space.md, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, borderRadius: 22, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 16, maxHeight: 120 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
});
