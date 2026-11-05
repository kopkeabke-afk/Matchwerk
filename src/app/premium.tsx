import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, T } from '@/components/ui';
import { Brand, Radius, Space, useTheme } from '@/constants/theme';
import { backend } from '@/lib';
import { FEATURES, TIER_NAMES } from '@/lib/plans';
import { buy, loadPlans, manageSubscriptionsUrl, restore, storeEnabled, type StorePlan } from '@/lib/purchases';
import type { LimitReason, Limits } from '@/lib/types';

type PaidTier = 'plus' | 'vip';

const REASON_TEXT: Partial<Record<LimitReason, string>> = {
  swipes: 'Du hast heute alle Profile gesehen. Mit Matchwerk+ siehst du 250 am Tag, mit VIP unbegrenzt viele.',
  likes: 'Deine 25 Gratis-Likes für heute sind vergeben. Mit Matchwerk+ likest du unbegrenzt.',
  superlikes: 'Dein Funke für heute ist vergeben. Hol dir mehr Funken einzeln oder täglich mit Matchwerk+ oder VIP.',
  boost: 'Mit einem Boost stehst du 30 Minuten ganz oben in den Stapeln in deiner Nähe.',
  extend: 'Mit Matchwerk+ kannst du Matches so oft verlängern, wie du willst.',
};

const VIP_GOLD = ['#F2B544', '#B9781C'] as const;

export default function Premium() {
  const { reason } = useLocalSearchParams<{ reason?: LimitReason }>();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [plans, setPlans] = useState<StorePlan[] | null>(null);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [tier, setTier] = useState<PaidTier>('plus');
  const [selected, setSelected] = useState<Record<PaidTier, string>>({ plus: 'matchwerk_plus_6m', vip: 'matchwerk_vip_6m' });
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    loadPlans().then(setPlans).catch((e) => { setPlans([]); Alert.alert('Tarife nicht verfügbar', (e as Error).message); });
    backend.getLimits().then((l) => { setLimits(l); if (l.tier === 'plus') setTier('vip'); }).catch(() => {});
  }, []);

  const subs = (plans ?? []).filter((p) => p.kind === 'subscription' && p.tier === tier);
  const funken = (plans ?? []).filter((p) => p.kind === 'funken');
  const boosts = (plans ?? []).filter((p) => p.kind === 'boost');
  const chosen = subs.find((p) => p.id === selected[tier]) ?? subs[0];
  const monthly = subs.find((p) => p.months === 1);
  const gradient = tier === 'vip' ? VIP_GOLD : Brand.gradient;
  const accent = tier === 'vip' ? Brand.gold : Brand.primary;
  const hasThisTier = limits?.tier === tier || limits?.tier === 'vip';

  async function purchase(plan: StorePlan) {
    setBusy(plan.id);
    try {
      const ok = await buy(plan);
      if (!ok) return;
      setLimits(await backend.getLimits());
      const title = plan.kind === 'subscription' ? `Willkommen bei ${TIER_NAMES[plan.tier!]} ✨` : plan.kind === 'funken' ? `${plan.title} gekauft ✨` : `${plan.title} gekauft ⚡`;
      const text = plan.kind === 'subscription' ? 'Alle Vorteile sind ab sofort freigeschaltet.'
        : plan.kind === 'funken' ? 'Sie werden automatisch genutzt, wenn deine täglichen Funken aufgebraucht sind.'
        : 'Du aktivierst ihn mit dem Blitz oben auf dem Entdecken-Bildschirm.';
      Alert.alert(title, text, [{ text: 'Los geht’s', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('Kauf fehlgeschlagen', (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onRestore() {
    setBusy('restore');
    try {
      await restore();
      const l = await backend.getLimits();
      setLimits(l);
      Alert.alert(l.premium ? `${TIER_NAMES[l.tier]} wiederhergestellt` : 'Kein aktives Abo gefunden');
    } catch (e) {
      Alert.alert('Wiederherstellen fehlgeschlagen', (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const savings = (p: StorePlan) =>
    monthly && p.months && p.months > 1 ? Math.round((1 - p.price / (monthly.price * p.months)) * 100) : 0;

  /** saving of a pack compared with buying single items of the same kind */
  const packSave = (p: StorePlan) => {
    const single = (plans ?? []).find((x) => x.kind === p.kind && x.amount === 1);
    return single && p.amount && p.amount > 1 ? Math.round((1 - p.price / (single.price * p.amount)) * 100) : 0;
  };

  const Pack = ({ p, icon }: { p: StorePlan; icon: 'sparkles' | 'flash' }) => (
    <Pressable onPress={() => purchase(p)} disabled={!!busy} accessibilityRole="button"
      style={({ pressed }) => [styles.pack, { borderColor: c.border, backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 }]}>
      {busy === p.id ? <ActivityIndicator color={Brand.text} /> : (
        <>
          <Ionicons name={icon} size={22} color={icon === 'sparkles' ? Brand.accent : Brand.super} />
          <T style={{ fontWeight: '800', fontSize: 15, textAlign: 'center' }}>{p.title}</T>
          <T style={{ color: Brand.text, fontWeight: '700', fontSize: 14 }}>{p.priceString}</T>
          {packSave(p) > 0 && <View style={[styles.badge, { backgroundColor: Brand.accent }]}><Text style={[styles.badgeText, { color: '#2A0E3F' }]}>−{packSave(p)} %</Text></View>}
        </>
      )}
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 200 + insets.bottom }}>
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.close} accessibilityLabel="Schließen">
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.logo}>matchwerk<Text style={{ color: tier === 'vip' ? '#fff' : '#FFE3A3' }}>{tier === 'vip' ? ' VIP' : '+'}</Text></Text>
          <Text style={styles.heroText}>
            {(reason && REASON_TEXT[reason]) || (tier === 'vip'
              ? 'Unbegrenzt Profile, 7 Funken am Tag, jede Woche ein Boost – und du wirst bevorzugt gezeigt.'
              : 'Mehr Profile, unbegrenzt Likes und mehr Funken. Schon ab 8,99 € im Monat.')}
          </Text>
          <View style={styles.tabs} accessibilityRole="tablist">
            {(['plus', 'vip'] as const).map((t) => (
              <Pressable key={t} onPress={() => setTier(t)} accessibilityRole="tab" accessibilityState={{ selected: tier === t }}
                style={[styles.tab, tier === t && styles.tabOn]}>
                <Text style={[styles.tabText, { color: tier === t ? accent : '#fff' }]}>{TIER_NAMES[t]}</Text>
              </Pressable>
            ))}
          </View>
        </LinearGradient>

        <View style={{ padding: Space.lg, gap: Space.xl }}>
          {limits?.premium && (
            <View style={[styles.active, { borderColor: Brand.like }]}>
              <T variant="h3">✓ {TIER_NAMES[limits.tier]} ist aktiv</T>
              {limits.premiumUntil && <T muted>Verlängert bzw. endet am {new Date(limits.premiumUntil).toLocaleDateString('de-DE')}</T>}
              <Button title="Abo verwalten" variant="secondary" onPress={() => Linking.openURL(manageSubscriptionsUrl)} />
            </View>
          )}

          <View style={[styles.table, { borderColor: c.border }]}>
            <View style={[styles.tr, { borderBottomColor: c.border, backgroundColor: c.surface }]}>
              <View style={{ flex: 1 }} />
              <T variant="small" muted style={styles.col}>Gratis</T>
              <T variant="small" style={[styles.col, { color: Brand.text, fontWeight: tier === 'plus' ? '900' : '600' }]}>Plus</T>
              <T variant="small" style={[styles.col, { color: Brand.gold, fontWeight: tier === 'vip' ? '900' : '600' }]}>VIP</T>
            </View>
            {FEATURES.map((f) => (
              <View key={f.title} style={[styles.tr, { borderBottomColor: c.border }]}>
                <View style={{ flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Ionicons name={f.icon as never} size={16} color={accent} />
                  <T style={{ flex: 1, fontWeight: '600', fontSize: 14 }}>{f.title}</T>
                </View>
                <T variant="small" muted style={styles.col}>{f.free}</T>
                <T variant="small" style={[styles.col, tier === 'plus' && styles.colOn]}>{f.plus}</T>
                <T variant="small" style={[styles.col, tier === 'vip' && styles.colOn]}>{f.vip}</T>
              </View>
            ))}
          </View>

          {plans === null ? (
            <ActivityIndicator color={Brand.text} />
          ) : !hasThisTier && subs.length > 0 ? (
            <View style={{ gap: Space.sm }}>
              <T variant="h3">{TIER_NAMES[tier]} – Zeitraum wählen</T>
              {subs.map((p) => {
                const on = p.id === chosen?.id;
                const save = savings(p);
                return (
                  <Pressable key={p.id} onPress={() => setSelected({ ...selected, [tier]: p.id })}
                    accessibilityRole="radio" accessibilityState={{ selected: on }}
                    style={[styles.plan, { borderColor: on ? accent : c.border, backgroundColor: on ? c.surface : c.background }]}>
                    <View style={[styles.radio, { borderColor: on ? accent : c.border }]}>
                      {on && <View style={[styles.radioDot, { backgroundColor: accent }]} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <T variant="h3">{p.title}</T>
                      <T variant="small" muted>{p.perMonthString ?? 'monatlich kündbar'}</T>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <T variant="h3">{p.priceString}</T>
                      {save > 0 && <View style={[styles.badge, { backgroundColor: accent }]}><Text style={styles.badgeText}>−{save} %</Text></View>}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {funken.length > 0 && (
            <View style={{ gap: Space.sm }}>
              <T variant="h3">✨ Funken einzeln</T>
              <T muted variant="small">Ein Funke zeigt sofort, dass du es ernst meinst – dein Profil erscheint ganz oben in den Likes. Gekaufte Funken verfallen nicht.</T>
              <View style={styles.row}>{funken.map((p) => <Pack key={p.id} p={p} icon="sparkles" />)}</View>
              {limits && limits.funkenCredits > 0 && <T muted variant="small">Du hast {limits.funkenCredits} gekaufte Funken übrig.</T>}
            </View>
          )}

          {boosts.length > 0 && (
            <View style={{ gap: Space.sm }}>
              <T variant="h3">⚡ Boosts einzeln</T>
              <T muted variant="small">30 Minuten lang zeigen wir dein Profil zuerst – ideal am Sonntagabend.</T>
              <View style={styles.row}>{boosts.map((p) => <Pack key={p.id} p={p} icon="flash" />)}</View>
              {limits && limits.boostCredits > 0 && <T muted variant="small">Du hast {limits.boostCredits} Boost{limits.boostCredits > 1 ? 's' : ''} übrig.</T>}
            </View>
          )}

          <View style={{ gap: Space.sm }}>
            <Pressable onPress={onRestore} disabled={!!busy}>
              <T style={{ color: Brand.text, fontWeight: '600', textAlign: 'center' }}>
                {busy === 'restore' ? 'Wird geprüft …' : 'Käufe wiederherstellen'}
              </T>
            </Pressable>
            <T variant="small" muted style={{ textAlign: 'center' }}>
              Abos verlängern sich automatisch um den gewählten Zeitraum zum angezeigten Preis, wenn du sie nicht mindestens
              24 Stunden vor Ablauf in deinem Google-Play-Konto kündigst. Die Zahlung erfolgt über dein Store-Konto.
            </T>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: Space.lg }}>
              <Link href="/legal/terms"><T variant="small" style={{ textDecorationLine: 'underline' }}>Nutzungsbedingungen</T></Link>
              <Link href="/legal/privacy"><T variant="small" style={{ textDecorationLine: 'underline' }}>Datenschutz</T></Link>
            </View>
            {!storeEnabled && backend.mode === 'demo' && <T variant="small" muted style={{ textAlign: 'center' }}>🧪 Demo-Modus: Käufe werden nur simuliert, es wird nichts berechnet.</T>}
          </View>
        </View>
      </ScrollView>

      {!hasThisTier && chosen && (
        <View style={[styles.footer, { backgroundColor: c.background, borderTopColor: c.border, paddingBottom: insets.bottom + 12 }]}>
          <Pressable onPress={() => purchase(chosen)} disabled={!!busy} accessibilityRole="button"
            style={({ pressed }) => ({ opacity: busy ? 0.6 : pressed ? 0.85 : 1 })}>
            <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
              {busy === chosen.id ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.ctaText}>{TIER_NAMES[tier]} – {chosen.priceString}</Text>
              )}
            </LinearGradient>
          </Pressable>
          <T variant="small" muted style={{ textAlign: 'center' }}>Jederzeit kündbar · {chosen.title} · danach automatische Verlängerung</T>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { padding: Space.xl, paddingTop: Space.xxl, paddingBottom: Space.xl, alignItems: 'center', gap: Space.md },
  close: { position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.15)', alignItems: 'center', justifyContent: 'center' },
  logo: { color: '#fff', fontSize: 40, fontWeight: '900', letterSpacing: -1.2 },
  heroText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center', lineHeight: 23, maxWidth: 340 },
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: Radius.pill, padding: 4, marginTop: Space.sm },
  tab: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: Radius.pill },
  tabOn: { backgroundColor: '#fff' },
  tabText: { fontWeight: '800', fontSize: 15 },
  active: { borderWidth: 2, borderRadius: Radius.lg, padding: Space.lg, gap: Space.sm },
  table: { borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Space.md, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 },
  col: { width: 58, textAlign: 'center' },
  colOn: { fontWeight: '800' },
  plan: { flexDirection: 'row', alignItems: 'center', gap: Space.md, borderWidth: 2, borderRadius: Radius.lg, padding: Space.lg },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
  badge: { borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  row: { flexDirection: 'row', gap: Space.sm },
  pack: { flex: 1, borderWidth: 1, borderRadius: Radius.lg, paddingVertical: Space.md, paddingHorizontal: 6, alignItems: 'center', gap: 4, minHeight: 96, justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: Space.lg, gap: 6, borderTopWidth: StyleSheet.hairlineWidth },
  cta: { borderRadius: Radius.pill, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', minHeight: 54 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
