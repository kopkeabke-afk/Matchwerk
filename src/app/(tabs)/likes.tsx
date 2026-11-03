import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Empty, T } from '@/components/ui';
import { Brand, Radius, Space, TabInset, useTheme, WebTabTop } from '@/constants/theme';
import { backend } from '@/lib';
import { profileCache } from '@/lib/cache';
import { bus } from '@/lib/events';
import { useSession } from '@/lib/session';
import type { IncomingLike } from '@/lib/types';
import { ageFrom, compatibility } from '@/lib/utils';

export default function Likes() {
  const c = useTheme();
  const { profile: me } = useSession();
  const [likes, setLikes] = useState<IncomingLike[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const l = await backend.getIncomingLikes().catch(() => []);
    profileCache.put(l.map((x) => x.profile));
    setLikes(l);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => bus.on('swiped', ({ id }) => setLikes((l) => l?.filter((x) => x.profile.id !== id) ?? l)), []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <View style={{ height: WebTabTop }} />
      <View style={styles.header}>
        <T variant="title">Likes</T>
        <T muted>Bei funke siehst du kostenlos, wer dich mag. Like zurück – und es ist ein Match.</T>
      </View>
      <FlatList
        data={likes ?? []}
        keyExtractor={(l) => l.profile.id}
        numColumns={2}
        columnWrapperStyle={{ gap: Space.md }}
        contentContainerStyle={{ padding: Space.lg, gap: Space.md, paddingBottom: TabInset + Space.xl, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={Brand.primary} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListEmptyComponent={likes ? (
          <Empty icon="heart-outline" title="Noch keine Likes" text="Ein vollständiges Profil mit 3+ Fotos und beantworteten Prompts bekommt bis zu 3× mehr Likes." />
        ) : undefined}
        renderItem={({ item }) => {
          const score = me ? compatibility(me, item.profile).score : undefined;
          return (
            <Pressable
              style={styles.tile}
              onPress={() => router.push({ pathname: '/profile/[id]', params: { id: item.profile.id, from: 'likes' } })}>
              <Image source={item.profile.photos[0]} style={StyleSheet.absoluteFill} contentFit="cover" />
              {item.action === 'superlike' && (
                <View style={[styles.tag, { backgroundColor: Brand.super }]}><Ionicons name="star" size={12} color="#fff" /></View>
              )}
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.tileBottom}>
                {item.note?.comment && (
                  <View style={styles.bubble}>
                    <Text style={styles.bubbleText} numberOfLines={3}>💬 {item.note.comment}</Text>
                  </View>
                )}
                <Text style={styles.name}>
                  {item.profile.name}, {ageFrom(item.profile.birthdate)} {item.profile.verified ? '✓' : ''}
                </Text>
                {score != null && <Text style={styles.score}>🔥 {score}% Match</Text>}
              </LinearGradient>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Space.lg, paddingTop: Space.sm, gap: 4 },
  tile: { flex: 1, aspectRatio: 3 / 4.4, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: '#333', maxWidth: '50%' },
  tag: { position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 10, paddingTop: 50, gap: 4 },
  bubble: { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 12, padding: 8, marginBottom: 4 },
  bubbleText: { color: '#111', fontSize: 12, fontWeight: '500' },
  name: { color: '#fff', fontWeight: '800', fontSize: 16 },
  score: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
