import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ModeSwitch } from '@/components/mode-switch';
import { ActivityCard, ActivityMini } from '@/components/activity-card';
import { FunkeSheet } from '@/components/funke-sheet';
import { LikeSheet } from '@/components/like-sheet';
import { ProfileView } from '@/components/profile-view';
import { Button, Empty } from '@/components/ui';
import { Brand, Space, TabInset, useTheme, WebTabTop } from '@/constants/theme';
import { backend } from '@/lib';
import { profileCache } from '@/lib/cache';
import { bus } from '@/lib/events';
import { useSession } from '@/lib/session';
import { getTravelPlace, type Place } from '@/lib/location';
import { limitReason, type Activity, type LikeNote, type Limits, type Profile, type SwipeAction } from '@/lib/types';
import { compatibility } from '@/lib/utils';

export default function Discover() {
  const c = useTheme();
  const { profile: me, filters, mode } = useSession();
  const [deck, setDeck] = useState<Profile[] | null>(null);
  const [sparkId, setSparkId] = useState<string>();
  const [last, setLast] = useState<{ p: Profile; action: SwipeAction } | null>(null);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [travel, setTravel] = useState<Place | null>(null);
  const [noteFor, setNoteFor] = useState<LikeNote['item'] | null>(null);
  const [sending, setSending] = useState(false);
  const [buyFunkeFor, setBuyFunkeFor] = useState<Profile | null>(null);
  const [nearby, setNearby] = useState<Activity[]>([]);
  const [personActs, setPersonActs] = useState<{ id: string; list: Activity[] } | null>(null);
  // every few profiles we show what is going on nearby – Matchwerk is also about doing things together
  const [decisions, setDecisions] = useState(0);
  const [teaserDoneAt, setTeaserDoneAt] = useState(0);
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
  useFocusEffect(useCallback(() => {
    backend.getActivities(filters.maxDistanceKm)
      .then((l) => setNearby(l.filter((a) => !a.joined && !a.isHost && !a.cancelled && a.memberCount < a.maxPeople && new Date(a.startsAt) > new Date())))
      .catch(() => {});
  }, [filters.maxDistanceKm]));
  const currentId = deck?.[0]?.id;
  useEffect(() => {
    if (!currentId) return;
    backend.getPersonActivities(currentId).then((list) => setPersonActs({ id: currentId, list })).catch(() => {});
  }, [currentId]);
  useFocusEffect(useCallback(() => { getTravelPlace().then(setTravel); }, []));
  useEffect(() => bus.on('swiped', ({ id }) => setDeck((d) => d?.filter((p) => p.id !== id) ?? d)), []);

  /** Pass, like or Funke for the profile currently shown. */
  async function decide(p: Profile, action: SwipeAction, note?: LikeNote) {
    if (Platform.OS !== 'web') {
      if (action === 'pass') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setDeck((d) => d?.filter((x) => x.id !== p.id) ?? d);
    setLast({ p, action });
    setDecisions((n) => n + 1);
    try {
      const { match } = await backend.swipe(p.id, action, note, mode);
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
        // out of Funken: offer a single one right here instead of the full upgrade page
        if (reason === 'superlikes') setBuyFunkeFor(p);
        else router.push({ pathname: '/premium', params: { reason } });
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

  const teaser = decisions > 0 && decisions % 5 === 0 && teaserDoneAt !== decisions && nearby.length > 0
    ? nearby[(decisions / 5 - 1) % nearby.length] : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <View style={{ height: WebTabTop }} />
      <View style={styles.header}>
        {(me.modes?.length ?? 1) > 1 ? (
          <ModeSwitch />
        ) : (
          <Text style={styles.logo}>matchwerk{limits?.tier === 'vip' ? <Text style={{ color: Brand.gold }}> VIP</Text> : limits?.premium ? <Text style={{ color: Brand.gold }}>+</Text> : null}</Text>
        )}
        <View style={{ flex: 1 }} />
        {limits && limits.swipesLeft !== null && limits.swipesLeft <= 10 ? (
          <Pressable onPress={() => router.push({ pathname: '/premium', params: { reason: 'swipes' } })} style={[styles.pill, { backgroundColor: c.surface }]}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>{limits.swipesLeft} Profile übrig</Text>
          </Pressable>
        ) : limits && limits.likesLeft !== null && limits.likesLeft <= 10 ? (
          <Pressable onPress={() => router.push({ pathname: '/premium', params: { reason: 'likes' } })} style={[styles.pill, { backgroundColor: c.surface }]}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>♥ {limits.likesLeft} übrig</Text>
          </Pressable>
        ) : null}
        {last && (
          <Pressable onPress={undo} hitSlop={10} accessibilityLabel="Rückgängig" style={[styles.headerBtn, { backgroundColor: c.surface }]}>
            <Ionicons name="arrow-undo" size={20} color={Brand.gold} />
          </Pressable>
        )}
        <Pressable onPress={boost} hitSlop={10} accessibilityLabel="Boost"
          style={[styles.headerBtn, { backgroundColor: limits?.boostActiveUntil ? Brand.super : c.surface }]}>
          <Ionicons name="flash" size={20} color={limits?.boostActiveUntil ? '#fff' : Brand.super} />
        </Pressable>
        <Pressable onPress={() => router.push('/filters')} hitSlop={10} accessibilityLabel="Filter" style={[styles.headerBtn, { backgroundColor: c.surface }]}>
          <Ionicons name="options-outline" size={22} color={c.text} />
        </Pressable>
      </View>

      {travel && (
        <Pressable onPress={() => router.push('/filters')} accessibilityRole="button" style={[styles.travel, { backgroundColor: c.surface }]}>
          <Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>✈️ Unterwegs in {travel.city ?? 'gewähltem Ort'}</Text>
          <Text style={{ color: Brand.text, fontWeight: '700', fontSize: 14 }}>Ändern</Text>
        </Pressable>
      )}

      {me.paused ? (
        <Empty icon="pause-circle" title="Dein Profil ist pausiert" text="Du wirst niemandem angezeigt und siehst keine neuen Profile. Bestehende Chats bleiben erhalten.">
          <Button title="Profil wieder aktivieren" onPress={() => router.push('/settings')} />
        </Empty>
      ) : deck === null ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={Brand.text} size="large" /></View>
      ) : deck.length === 0 ? (
        <Empty icon={mode === 'friends' ? 'people' : 'sparkles'} title="Das war's für jetzt"
          text={mode === 'friends'
            ? 'Gerade sucht niemand in deiner Nähe neue Freunde. Erweitere den Umkreis oder schau später wieder vorbei.'
            : 'Du hast alle Profile in deiner Nähe gesehen. Erweitere deine Filter oder schau später wieder vorbei.'}>
          <Button title="Filter anpassen" icon="options-outline" onPress={() => router.push('/filters')} />
          <Button title="Neu laden" variant="ghost" onPress={() => { setDeck(null); load(); }} />
          {nearby.length > 0 && (
            <View style={{ alignSelf: 'stretch', gap: Space.sm, marginTop: Space.lg }}>
              <Text style={{ color: c.text, fontWeight: '800', fontSize: 17, textAlign: 'center' }}>🎉 Dafür ist in deiner Nähe was los</Text>
              {nearby.slice(0, 3).map((a) => <ActivityMini key={a.id} a={a} onPress={() => router.push(`/activity/${a.id}`)} />)}
              <Button title="Alle Aktivitäten" variant="secondary" icon="people" onPress={() => router.push('/activities')} />
            </View>
          )}
        </Empty>
      ) : teaser ? (
        <ScrollView contentContainerStyle={[styles.feed, { gap: Space.lg, paddingTop: Space.md }]} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeIn.duration(250)} style={{ gap: Space.lg }}>
            <View style={{ gap: 4, paddingHorizontal: Space.xs }}>
              <Text style={{ color: Brand.text, fontWeight: '800', fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase' }}>Mal was anderes</Text>
              <Text style={{ color: c.text, fontWeight: '800', fontSize: 26, letterSpacing: -0.4 }}>Lern Leute direkt kennen – bei einer Aktivität in deiner Nähe</Text>
            </View>
            <ActivityCard a={teaser} onPress={() => { setTeaserDoneAt(decisions); router.push(`/activity/${teaser.id}`); }} />
            <Button title="Ansehen & mitmachen" icon="hand-right" onPress={() => { setTeaserDoneAt(decisions); router.push(`/activity/${teaser.id}`); }} />
            <Button title="Weiter zu den Profilen" variant="ghost" onPress={() => setTeaserDoneAt(decisions)} />
          </Animated.View>
        </ScrollView>
      ) : (
        <>
          {/* one profile at a time, read like a page – no card swiping */}
          <ScrollView key={deck[0].id} contentContainerStyle={styles.feed} showsVerticalScrollIndicator={false}>
            <Animated.View entering={last ? FadeInRight.duration(260) : FadeIn.duration(200)}>
              <ProfileView profile={deck[0]} compat={compat(deck[0])} mode={mode} spark={deck[0].id === sparkId}
                onLikeItem={(item) => setNoteFor(item)}
                activities={personActs?.id === deck[0].id ? personActs.list : undefined}
                actions={{
                  onPass: () => decide(deck[0], 'pass'),
                  onLike: () => decide(deck[0], 'like'),
                  onFunke: () => decide(deck[0], 'superlike'),
                }} />
            </Animated.View>
          </ScrollView>
          <FunkeSheet visible={!!buyFunkeFor} name={buyFunkeFor?.name} onClose={() => setBuyFunkeFor(null)}
            onBought={() => {
              const p = buyFunkeFor;
              setBuyFunkeFor(null);
              refreshLimits();
              if (p) decide(p, 'superlike');
            }} />
          <LikeSheet profile={deck[0]} item={noteFor ?? null} mode={mode} busy={sending}
            onClose={() => setNoteFor(null)}
            onSend={async (note) => {
              setSending(true);
              setNoteFor(null);
              await decide(deck[0], 'like', note);
              setSending(false);
            }} />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingHorizontal: Space.lg, paddingVertical: Space.sm },
  travel: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: Space.md, marginBottom: Space.sm, paddingHorizontal: Space.md, paddingVertical: 10, borderRadius: 14 },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  logo: { fontSize: 26, fontWeight: '900', color: Brand.text, letterSpacing: -1 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  feed: { paddingHorizontal: Space.sm, paddingTop: Space.xs, paddingBottom: TabInset + Space.xl },
});
