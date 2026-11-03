import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, T } from '@/components/ui';
import { Brand, Radius, Space, useTheme } from '@/constants/theme';
import { backend } from '@/lib';
import { profileCache } from '@/lib/cache';
import { useSession } from '@/lib/session';
import type { Match, Message } from '@/lib/types';
import { hoursLeft, icebreakers } from '@/lib/utils';

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { profile: me, userId } = useSession();
  const [match, setMatch] = useState<Match | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const list = useRef<FlatList<Message>>(null);

  const load = useCallback(async () => {
    const [m, ms] = await Promise.all([backend.getMatch(id), backend.getMessages(id)]);
    if (m) profileCache.put([m.profile]);
    setMatch(m);
    setMsgs(ms);
    backend.markRead(id).catch(() => {});
  }, [id]);

  // load() sets state only after awaiting the backend
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  useEffect(() => backend.subscribeMessages(id, (m) => {
    setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    backend.markRead(id).catch(() => {});
  }), [id]);

  async function send(body = text) {
    const t = body.trim();
    if (!t) return;
    setSending(true);
    try {
      const m = await backend.sendMessage(id, t);
      setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      setText('');
    } catch (e) {
      Alert.alert('Nachricht nicht gesendet', (e as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (!match || !me) return <View style={{ flex: 1, backgroundColor: c.background }} />;

  const p = match.profile;
  const first = msgs.length === 0;
  const waiting = first && match.opener === 'them';
  const left = hoursLeft(match.expiresAt);

  const header = (
    <Stack.Screen
      options={{
        headerTitle: () => (
          <Pressable
            onPress={() => router.push({ pathname: '/profile/[id]', params: { id: p.id, from: 'match', matchId: match.id } })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Image source={p.photos[0]} style={{ width: 32, height: 32, borderRadius: 16 }} />
            <T variant="h3">{p.name}</T>
            {p.verified && <Ionicons name="checkmark-circle" size={16} color={Brand.super} />}
          </Pressable>
        ),
        headerRight: () => (
          <Pressable
            hitSlop={10}
            accessibilityLabel="Profil, melden oder Match auflösen"
            onPress={() => router.push({ pathname: '/profile/[id]', params: { id: p.id, from: 'match', matchId: match.id } })}>
            <Ionicons name="shield-checkmark-outline" size={22} color={Brand.primary} />
          </Pressable>
        ),
      }}
    />
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      {header}
      <FlatList
        ref={list}
        data={msgs}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: Space.lg, gap: 6, flexGrow: 1 }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={
          <View style={styles.intro}>
            <Image source={p.photos[0]} style={styles.introImg} />
            <T variant="h2">Du und {p.name} habt ein Match 🔥</T>
            {first && (
              <T muted style={{ textAlign: 'center' }}>
                {waiting
                  ? `${p.name} hat sich gewünscht, den ersten Schritt zu machen. Du wirst benachrichtigt!`
                  : `Noch ${Math.ceil(left)} Stunden, um das Gespräch zu beginnen.`}
              </T>
            )}
            {first && !match.extended && left < 24 && (
              <Button title="Um 24 h verlängern" icon="time-outline" variant="secondary" onPress={async () => { await backend.extendMatch(match.id); load(); }} />
            )}
          </View>
        }
        renderItem={({ item }) => {
          const mine = item.senderId === userId;
          return (
            <View style={[styles.bubble, mine ? styles.mine : [styles.theirs, { backgroundColor: c.surface }]]}>
              <T style={{ color: mine ? '#fff' : c.text }}>{item.text}</T>
            </View>
          );
        }}
      />
      {first && !waiting && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Space.lg, gap: 8, paddingBottom: 8 }} style={{ flexGrow: 0 }}>
          {icebreakers(me, p).map((q) => (
            <Pressable key={q} onPress={() => setText(q)} style={[styles.ice, { borderColor: Brand.primary }]}>
              <T variant="small" style={{ color: Brand.primary, fontWeight: '600' }}>💡 {q}</T>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <View style={[styles.composer, { borderTopColor: c.border, paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          editable={!waiting}
          placeholder={waiting ? `Warte auf ${p.name} …` : 'Nachricht schreiben …'}
          placeholderTextColor={c.textSecondary}
          multiline
          maxLength={2000}
          style={[styles.input, { color: c.text, backgroundColor: c.surface }]}
        />
        <Pressable
          onPress={() => send()}
          disabled={!text.trim() || sending || waiting}
          accessibilityLabel="Senden"
          style={[styles.send, { opacity: !text.trim() || waiting ? 0.4 : 1 }]}>
          <Ionicons name="arrow-up" size={22} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  intro: { alignItems: 'center', gap: Space.sm, paddingVertical: Space.xl },
  introImg: { width: 96, height: 96, borderRadius: 48, marginBottom: Space.sm, backgroundColor: '#333' },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  mine: { alignSelf: 'flex-end', backgroundColor: Brand.primary, borderBottomRightRadius: 6 },
  theirs: { alignSelf: 'flex-start', borderBottomLeftRadius: 6 },
  ice: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 8, maxWidth: 280 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: Space.md, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, borderRadius: 22, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 16, maxHeight: 120 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
});
