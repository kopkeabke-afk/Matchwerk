import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LikeSheet } from '@/components/like-sheet';
import { ProfileView } from '@/components/profile-view';
import { IconButton, T } from '@/components/ui';
import { Brand, Space, useTheme } from '@/constants/theme';
import { backend } from '@/lib';
import { profileCache } from '@/lib/cache';
import { bus } from '@/lib/events';
import { useSession } from '@/lib/session';
import { limitReason, type LikeNote, type Profile, type SwipeAction } from '@/lib/types';
import { compatibility } from '@/lib/utils';

export default function ProfileScreen() {
  const { id, from, matchId } = useLocalSearchParams<{ id: string; from?: 'deck' | 'likes' | 'match'; matchId?: string }>();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { profile: me, mode } = useSession();
  const [p, setP] = useState<Profile | null>(profileCache.get(id) ?? null);
  const [noteFor, setNoteFor] = useState<LikeNote['item'] | null>(null);
  const [busy, setBusy] = useState(false);
  const canSwipe = from === 'deck' || from === 'likes';

  useEffect(() => {
    if (!p) backend.getProfile(id).then(setP).catch(() => {});
  }, [id, p]);

  async function act(action: SwipeAction, note?: LikeNote) {
    if (!p) return;
    setBusy(true);
    try {
      const { match } = await backend.swipe(p.id, action, note, mode);
      bus.emit('swiped', { id: p.id });
      router.back();
      if (match) setTimeout(() => router.push(`/match/${match.id}`), 350);
    } catch (e) {
      const reason = limitReason(e);
      if (reason) {
        setNoteFor(null);
        router.push({ pathname: '/premium', params: { reason } });
      } else {
        Alert.alert('Fehler', (e as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }

  function more() {
    if (!p) return;
    const options = ['Melden', 'Blockieren', ...(matchId ? ['Match auflösen'] : []), 'Abbrechen'];
    const run = (i: number) => {
      const o = options[i];
      if (o === 'Melden') router.push({ pathname: '/report/[id]', params: { id: p.id } });
      if (o === 'Blockieren') {
        Alert.alert(`${p.name} blockieren?`, 'Ihr seht euch gegenseitig nicht mehr. Das kann nicht rückgängig gemacht werden.', [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Blockieren', style: 'destructive', onPress: async () => {
            await backend.block(p.id);
            bus.emit('swiped', { id: p.id });
            router.dismissAll();
          } },
        ]);
      }
      if (o === 'Match auflösen' && matchId) {
        Alert.alert('Match auflösen?', 'Der Chat wird für euch beide gelöscht.', [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Auflösen', style: 'destructive', onPress: async () => { await backend.unmatch(matchId); router.dismissAll(); } },
        ]);
      }
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: options.length - 1, destructiveButtonIndex: [0, 1] }, run);
    } else {
      Alert.alert(p.name, undefined, options.slice(0, -1).map((o, i) => ({ text: o, onPress: () => run(i), style: 'destructive' as const })).concat({ text: 'Abbrechen', style: 'cancel' as never, onPress: () => {} }));
    }
  }

  if (!p || !me) return <View style={{ flex: 1, backgroundColor: c.background }} />;


  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: Space.lg, paddingTop: Space.xxl, paddingBottom: 140 }}>
        <ProfileView profile={p} compat={compatibility(me, p, mode)} mode={from === 'match' ? 'dating' : mode} onLikeItem={canSwipe ? (item) => setNoteFor(item) : undefined} />
        {canSwipe && (
          <T muted variant="small" style={{ textAlign: 'center', marginTop: Space.xl }}>
            Tipp: Like ein bestimmtes Foto oder eine Antwort und schreib etwas dazu – das erhöht deine Match-Chance deutlich.
          </T>
        )}
      </ScrollView>

      <View style={[styles.topBar, { top: Platform.OS === 'ios' ? 12 : insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={[styles.round, { backgroundColor: c.card }]} accessibilityLabel="Schließen">
          <Ionicons name="chevron-down" size={22} color={c.text} />
        </Pressable>
        <Pressable onPress={more} style={[styles.round, { backgroundColor: c.card }]} accessibilityLabel="Melden oder blockieren">
          <Ionicons name="ellipsis-horizontal" size={22} color={c.text} />
        </Pressable>
      </View>

      {canSwipe && (
        <LinearGradient
          colors={[c.dark ? 'rgba(11,11,15,0)' : 'rgba(255,255,255,0)', c.background]}
          locations={[0, 0.45]}
          style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
          <IconButton icon="close" color={Brand.pass} size={60} label="Weiter" onPress={() => act('pass')} />
          <IconButton icon="flame" color={Brand.accent} size={48} label="Funke" onPress={() => act('superlike')} />
          <IconButton icon={mode === 'friends' ? 'hand-left' : 'heart'} color={Brand.primary} size={60} label={mode === 'friends' ? 'Verbinden' : 'Like'} onPress={() => act('like')} />
        </LinearGradient>
      )}

      <LikeSheet profile={p} item={noteFor ?? null} mode={mode} busy={busy}
        onClose={() => setNoteFor(null)}
        onSend={(note) => act('like', note)} />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { position: 'absolute', left: Space.lg, right: Space.lg, flexDirection: 'row', justifyContent: 'space-between' },
  round: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 28, paddingTop: 40 },
});
