import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ModeSwitch } from '@/components/mode-switch';
import { SwipeDeck, type SwipeDeckHandle } from '@/components/swipe-deck';
import { Button, Empty, IconButton } from '@/components/ui';
import { Brand, Space, TabInset, useTheme, WebTabTop } from '@/constants/theme';
import { backend } from '@/lib';
import { profileCache } from '@/lib/cache';
import { bus } from '@/lib/events';
import { useSession } from '@/lib/session';
import { limitReason, type Limits, type Profile, type SwipeAction } from '@/lib/types';
import { compatibility } from '@/lib/utils';

export default function Discover() {
  const c = useTheme();
  const { profile: me, filters, mode } = useSession();
  const [deck, setDeck] = useState<Profile[] | null>(null);
  const [sparkId, setSparkId] = useState<string>();
  const [last, setLast] = useState<{ p: Profile; action: SwipeAction } | null>(null);
  const [limits, setLimits] = useState<Limits | null>(null);
  const deckRef = useRef<SwipeDeckHandle>(null);
  const refreshLimits = useCallback(() => { backend.getLimits().then(setLimits).catch(() => {}); }, []);

  const compat = useCallback((p: Profile) => compatibility(me!, p, mode), [me, mode]);

  const load = useCallback(async () => {
    try {
      const list = await backend.getDeck(filters, mode);
      profileCache.put(list);
      // Daily Spark: best match of the day goes first
      const scored = list.map((p) => ({ p, s: compatibility(me!, p).score }));
      const best = scored.reduce<{ p: Profile; s: number } | null>((a, b) => (!a || b.s > a.s ? b : a), null);
      setSparkId(best?.p.id);
      setDeck(best ? [best.p, ...list.filter((p) => p.id !== best.p.id)] : list);
    } catch (e) {
      setDeck([]);
      Alert.alert('Laden fehlgeschlagen', (e as Error).message);
    }
  }, [filters, me, mode]);

  // load() sets state only after awaiting the backend
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  useFocusEffect(refreshLimits);
  useEffect(() => bus.on('swiped', ({ id }) => setDeck((d) => d?.filter((p) => p.id !== id) ?? d)), []);

  async function onSwipe(p: Profile, action: SwipeAction) {
    setDeck((d) => d?.filter((x) => x.id !== p.id) ?? d);
    setLast({ p, action });
    try {
      const { match } = await backend.swipe(p.id, action, undefined, mode);
      if (match) {
        setLast(null);
        router.push(`/match/${match.id}`);
      }
      if (action !== 'pass') refreshLimits();
    } catch (e) {
      const reason = limitReason(e);
      if (reason) {
        // put the card back and offer an upgrade
        setDeck((d) => [p, ...(d ?? []).filter((x) => x.id !== p.id)]);
        setLast(null);
        router.push({ pathname: '/premium', params: { reason } });
      } else {
        Alert.alert('Fehler', (e as Error).message);
      }
    }
  }

  async function boost() {
    if (limits?.boostActiveUntil) {
      const min = Math.max(1, Math.round((new Date(limits.boostActiveUntil).getTime() - Date.now()) / 60_000));
      Alert.alert('⚡ Boost läuft', `Dein Profil wird noch ${min} Minuten bevorzugt gezeigt.`);
      return;
    }
    try {
      await backend.activateBoost();
      refreshLimits();
      Alert.alert('⚡ Boost aktiviert', 'Für die nächsten 30 Minuten siehst du dein Profil ganz oben in den Stapeln in deiner Nähe.');
    } catch (e) {
      if (limitReason(e)) router.push({ pathname: '/premium', params: { reason: 'boost' } });
      else Alert.alert('Fehler', (e as Error).message);
    }
  }

  async function undo() {
    if (!last) return;
    await backend.undoSwipe(last.p.id, mode).catch(() => {});
    setDeck((d) => [last.p, ...(d ?? [])]);
    setLast(null);
  }

  if (!me) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <View style={{ height: WebTabTop }} />
      <View style={styles.header}>
        <Text style={styles.logo}>matchwerk{limits?.tier === 'vip' ? <Text style={{ color: Brand.gold }}> VIP</Text> : limits?.premium ? <Text style={{ color: Brand.gold }}>+</Text> : null}</Text>
        <View style={{ flex: 1, alignItems: 'center' }}><ModeSwitch /></View>
        {limits && limits.swipesLeft !== null && limits.swipesLeft <= 10 ? (
          <Pressable onPress={() => router.push({ pathname: '/premium', params: { reason: 'swipes' } })} style={[styles.pill, { backgroundColor: c.surface }]}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>{limits.swipesLeft} Profile übrig</Text>
          </Pressable>
        ) : limits && limits.likesLeft !== null && limits.likesLeft <= 10 ? (
          <Pressable onPress={() => router.push({ pathname: '/premium', params: { reason: 'likes' } })} style={[styles.pill, { backgroundColor: c.surface }]}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>♥ {limits.likesLeft} übrig</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={boost} hitSlop={10} accessibilityLabel="Boost"
          style={[styles.headerBtn, { backgroundColor: limits?.boostActiveUntil ? Brand.super : c.surface }]}>
          <Ionicons name="flash" size={20} color={limits?.boostActiveUntil ? '#fff' : Brand.super} />
        </Pressable>
        <Pressable onPress={() => router.push('/filters')} hitSlop={10} accessibilityLabel="Filter" style={[styles.headerBtn, { backgroundColor: c.surface }]}>
          <Ionicons name="options-outline" size={22} color={c.text} />
        </Pressable>
      </View>

      {me.paused ? (
        <Empty icon="pause-circle" title="Dein Profil ist pausiert" text="Du wirst niemandem angezeigt und siehst keine neuen Profile. Bestehende Chats bleiben erhalten.">
          <Button title="Profil wieder aktivieren" onPress={() => router.push('/settings')} />
        </Empty>
      ) : deck === null ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={Brand.primary} size="large" /></View>
      ) : deck.length === 0 ? (
        <Empty icon={mode === 'friends' ? 'people' : 'sparkles'} title="Das war's für jetzt"
          text={mode === 'friends'
            ? 'Gerade sucht niemand in deiner Nähe neue Freunde. Erweitere den Umkreis oder schau später wieder vorbei.'
            : 'Du hast alle Profile in deiner Nähe gesehen. Erweitere deine Filter oder schau später wieder vorbei.'}>
          <Button title="Filter anpassen" icon="options-outline" onPress={() => router.push('/filters')} />
          <Button title="Neu laden" variant="ghost" onPress={() => { setDeck(null); load(); }} />
        </Empty>
      ) : (
        <>
          <View style={styles.deck}>
            <SwipeDeck
              ref={deckRef}
              profiles={deck}
              compat={compat}
              sparkId={sparkId}
              onSwipe={onSwipe}
              mode={mode}
              onInfo={(p) => router.push({ pathname: '/profile/[id]', params: { id: p.id, from: 'deck' } })}
            />
          </View>
          <View style={styles.actions}>
            <IconButton icon="arrow-undo" color={Brand.gold} size={46} label="Rückgängig" onPress={undo} />
            <IconButton icon="close" color={Brand.pass} size={64} label="Weiter" onPress={() => deckRef.current?.swipe('pass')} />
            <IconButton icon="flame" color={Brand.accent} size={46} label="Funke" onPress={() => deckRef.current?.swipe('superlike')} />
            <IconButton icon={mode === 'friends' ? 'hand-left' : 'heart'} color={Brand.like} size={64} label={mode === 'friends' ? 'Verbinden' : 'Like'} onPress={() => deckRef.current?.swipe('like')} />
            <IconButton icon="information" color={c.textSecondary} size={46} label="Profil ansehen"
              onPress={() => deck[0] && router.push({ pathname: '/profile/[id]', params: { id: deck[0].id, from: 'deck' } })} />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingHorizontal: Space.lg, paddingVertical: Space.sm },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  logo: { fontSize: 30, fontWeight: '900', color: Brand.primary, letterSpacing: -1 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  deck: { flex: 1, marginHorizontal: Space.md, marginTop: Space.xs },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', paddingTop: Space.lg, paddingBottom: TabInset + Space.md },
});
