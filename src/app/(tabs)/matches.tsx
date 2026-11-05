import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Empty, T } from '@/components/ui';
import { Brand, Radius, Space, TabInset, useTheme, WebTabTop } from '@/constants/theme';
import { backend } from '@/lib';
import { profileCache } from '@/lib/cache';
import { useSession } from '@/lib/session';
import { messagePreview, type Match } from '@/lib/types';
import { hoursLeft, timeAgo } from '@/lib/utils';

export default function Matches() {
  const c = useTheme();
  const { userId } = useSession();
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const m = await backend.getMatches().catch(() => []);
    profileCache.put(m.map((x) => x.profile));
    setMatches(m);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => backend.subscribeMatches(load), [load]);

  const fresh = (matches ?? []).filter((m) => !m.lastMessage);
  const convos = (matches ?? []).filter((m) => m.lastMessage);
  const open = (m: Match) => router.push(`/chat/${m.id}`);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <View style={{ height: WebTabTop }} />
      <FlatList
        data={convos}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ paddingBottom: TabInset + Space.xl, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={Brand.primary} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListHeaderComponent={
          <View style={{ gap: Space.md }}>
            <T variant="title" style={{ paddingHorizontal: Space.lg, paddingTop: Space.sm }}>Chats</T>
            {fresh.length > 0 && (
              <>
                <T variant="h3" style={{ paddingHorizontal: Space.lg }}>Neue Matches</T>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Space.lg, gap: Space.md }}>
                  {fresh.map((m) => {
                    const h = hoursLeft(m.expiresAt);
                    const urgent = h < 12;
                    return (
                      <Pressable key={m.id} onPress={() => open(m)} style={{ alignItems: 'center', gap: 6, width: 84 }}>
                        <View style={[styles.ring, { borderColor: urgent ? Brand.pass : Brand.text }]}>
                          <Image source={m.profile.photos[0]} style={styles.avatarLg} contentFit="cover" />
                        </View>
                        <T variant="small" style={{ fontWeight: '700' }} numberOfLines={1}>{m.profile.name}</T>
                        <Text style={{ fontSize: 11, color: urgent ? Brand.pass : c.textSecondary, fontWeight: '600' }}>
                          {m.opener === 'them' ? '⏳ wartet' : `⏱ ${Math.ceil(h)} h`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            )}
            {convos.length > 0 && <T variant="h3" style={{ paddingHorizontal: Space.lg, marginTop: Space.sm }}>Nachrichten</T>}
          </View>
        }
        ListEmptyComponent={matches && fresh.length === 0 ? (
          <Empty icon="chatbubbles-outline" title="Noch keine Chats" text="Sobald ihr euch gegenseitig liked, erscheint euer Match hier." />
        ) : undefined}
        renderItem={({ item: m }) => (
          <Pressable onPress={() => open(m)} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
            <Image source={m.profile.photos[0]} style={styles.avatar} contentFit="cover" />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <T variant="h3">{m.profile.name}</T>
                  {m.mode === 'friends' && <View style={styles.friendTag}><Text style={styles.friendTagText}>Freunde</Text></View>}
                </View>
                <T variant="small" muted>{timeAgo(m.lastMessage!.createdAt)}</T>
              </View>
              <T muted={!m.unread} numberOfLines={1} style={m.unread ? { fontWeight: '700' } : undefined}>
                {m.lastMessage!.senderId === userId ? 'Du: ' : ''}{messagePreview(m.lastMessage!)}
              </T>
            </View>
            {m.unread > 0 && <View style={styles.dot}><Text style={styles.dotText}>{m.unread}</Text></View>}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: 3, borderRadius: 42, padding: 3 },
  avatarLg: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#333' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingHorizontal: Space.lg, paddingVertical: Space.md },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#333' },
  friendTag: { backgroundColor: Brand.super, borderRadius: Radius.pill, paddingHorizontal: 7, paddingVertical: 1 },
  friendTagText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  dot: { minWidth: 22, height: 22, borderRadius: Radius.pill, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  dotText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
