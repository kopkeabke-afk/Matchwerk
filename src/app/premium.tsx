import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, T } from '@/components/ui';
import { Brand, Radius, Space, useTheme } from '@/constants/theme';
import { backend } from '@/lib';
import { PLUS_FEATURES } from '@/lib/plans';
import { buy, loadPlans, manageSubscriptionsUrl, restore, storeEnabled, type StorePlan } from '@/lib/purchases';
import type { LimitReason, Limits } from '@/lib/types';

const REASON_TEXT: Partial<Record<LimitReason, string>> = {
  likes: 'Du hast heute alle 50 Gratis-Likes vergeben. Mit matchwerk+ likest du unbegrenzt.',
  superlikes: 'Dein Super-Like für heute ist vergeben. Mit matchwerk+ hast du 5 pro Tag.',
  boost: 'Mit einem Boost stehst du 30 Minuten ganz oben in den Stapeln in deiner Nähe.',
  extend: 'Mit matchwerk+ kannst du Matches so oft verlängern, wie du willst.',
};

export default function Premium() {
  const { reason } = useLocalSearchParams<{ reason?: LimitReason }>();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [plans, setPlans] = useState<StorePlan[] | null>(null);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [selected, setSelected] = useState<string>('matchwerk_plus_6m');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    loadPlans().then(setPlans).catch((e) => { setPlans([]); Alert.alert('Tarife nicht verfügbar', (e as Error).message); });
    backend.getLimits().then(setLimits).catch(() => {});
  }, []);

  const subs = (plans ?? []).filter((p) => p.kind === 'subscription');
  const boosts = (plans ?? []).filter((p) => p.kind === 'boost');
  const chosen = subs.find((p) => p.id === selected) ?? subs[0];
  const monthly = subs.find((p) => p.months === 1);

  async function purchase(plan: StorePlan) {
    setBusy(plan.id);
    try {
      const ok = await buy(plan);
      if (!ok) return;
      setLimits(await backend.getLimits());
      Alert.alert(
        plan.kind === 'subscription' ? 'Willkommen bei matchwerk+ 🔥' : 'Boost gekauft ⚡',
        plan.kind === 'subscription' ? 'Alle Vorteile sind ab sofort freigeschaltet.' : 'Du findest ihn oben auf dem Entdecken-Bildschirm.',
        [{ text: 'Los geht’s', onPress: () => router.back() }],
      );
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
      Alert.alert(l.premium ? 'matchwerk+ wiederhergestellt' : 'Kein aktives Abo gefunden');
    } catch (e) {
      Alert.alert('Wiederherstellen fehlgeschlagen', (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const savings = (p: StorePlan) =>
    monthly && p.months && p.months > 1 ? Math.round((1 - p.price / (monthly.price * p.months)) * 100) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 220 + insets.bottom }}>
        <LinearGradient colors={Brand.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: Space.xxl }]}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.close} accessibilityLabel="Schließen">
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.logo}>matchwerk<Text style={{ color: '#FFE3A3' }}>+</Text></Text>
          <Text style={styles.heroText}>{(reason && REASON_TEXT[reason]) || 'Mehr Matches. Weniger warten. Schon ab 3,75 € im Monat.'}</Text>
        </LinearGradient>

        <View style={{ padding: Space.lg, gap: Space.xl }}>
          {limits?.premium ? (
            <View style={[styles.active, { borderColor: Brand.like }]}>
              <T variant="h3">✓ matchwerk+ ist aktiv</T>
              {limits.premiumUntil && <T muted>Verlängert bzw. endet am {new Date(limits.premiumUntil).toLocaleDateString('de-DE')}</T>}
              <Button title="Abo verwalten" variant="secondary" onPress={() => Linking.openURL(manageSubscriptionsUrl)} />
            </View>
          ) : null}

          <View style={[styles.table, { borderColor: c.border }]}>
            <View style={[styles.tr, { borderBottomColor: c.border }]}>
              <View style={{ flex: 1 }} />
              <T variant="small" muted style={styles.col}>Gratis</T>
              <T variant="small" style={[styles.col, { color: Brand.primary, fontWeight: '800' }]}>matchwerk+</T>
            </View>
            {PLUS_FEATURES.map((f) => (
              <View key={f.title} style={[styles.tr, { borderBottomColor: c.border }]}>
                <View style={{ flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <Ionicons name={f.icon as never} size={18} color={Brand.primary} />
                  <View style={{ flex: 1 }}>
                    <T style={{ fontWeight: '600', fontSize: 15 }}>{f.title}</T>
                    <T variant="small" muted>{f.text}</T>
                  </View>
                </View>
                <T variant="small" muted style={styles.col}>{f.free}</T>
                <T variant="small" style={[styles.col, { fontWeight: '700' }]}>{f.plus}</T>
              </View>
            ))}
          </View>

          {plans === null ? (
            <ActivityIndicator color={Brand.primary} />
          ) : !limits?.premium && subs.length > 0 ? (
            <View style={{ gap: Space.sm }}>
              <T variant="h3">Wähle deinen Zeitraum</T>
              {subs.map((p) => {
                const on = p.id === chosen?.id;
                const save = savings(p);
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setSelected(p.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    style={[styles.plan, { borderColor: on ? Brand.primary : c.border, backgroundColor: on ? c.surface : c.background }]}>
                    <View style={[styles.radio, { borderColor: on ? Brand.primary : c.border }]}>
                      {on && <View style={styles.radioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <T variant="h3">{p.title}</T>
                      <T variant="small" muted>{p.perMonthString ?? 'monatlich kündbar'}</T>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <T variant="h3">{p.priceString}</T>
                      {(p.badge || save > 0) && (
                        <View style={styles.badge}><Text style={styles.badgeText}>{save > 0 ? `−${save} %` : p.badge}</Text></View>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {boosts.length > 0 && (
            <View style={{ gap: Space.sm }}>
              <T variant="h3">⚡ Boosts einzeln</T>
              <T muted variant="small">30 Minuten lang zeigen wir dein Profil zuerst – ideal am Sonntagabend.</T>
              <View style={{ flexDirection: 'row', gap: Space.sm }}>
                {boosts.map((b) => (
                  <Pressable key={b.id} onPress={() => purchase(b)} disabled={!!busy}
                    style={[styles.boost, { borderColor: c.border, backgroundColor: c.surface }]}>
                    {busy === b.id ? <ActivityIndicator color={Brand.primary} /> : (
                      <>
                        <T variant="h3">{b.title}</T>
                        <T style={{ color: Brand.primary, fontWeight: '700' }}>{b.priceString}</T>
                        {b.badge && <T variant="small" muted>{b.badge}</T>}
                      </>
                    )}
                  </Pressable>
                ))}
              </View>
              {limits && limits.boostCredits > 0 && <T muted variant="small">Du hast {limits.boostCredits} Boost{limits.boostCredits > 1 ? 's' : ''} übrig.</T>}
            </View>
          )}

          <View style={{ gap: Space.sm }}>
            <Pressable onPress={onRestore} disabled={!!busy}>
              <T style={{ color: Brand.primary, fontWeight: '600', textAlign: 'center' }}>
                {busy === 'restore' ? 'Wird geprüft …' : 'Käufe wiederherstellen'}
              </T>
            </Pressable>
            <T variant="small" muted style={{ textAlign: 'center' }}>
              Das Abo verlängert sich automatisch um den gewählten Zeitraum zum angezeigten Preis, wenn du es nicht mindestens
              24 Stunden vor Ablauf in den Einstellungen deines {storeEnabled ? 'Store-Kontos' : 'App-Store- bzw. Google-Play-Kontos'} kündigst.
              Die Zahlung erfolgt über dein Store-Konto.
            </T>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: Space.lg }}>
              <Link href="/legal/terms"><T variant="small" style={{ textDecorationLine: 'underline' }}>Nutzungsbedingungen</T></Link>
              <Link href="/legal/privacy"><T variant="small" style={{ textDecorationLine: 'underline' }}>Datenschutz</T></Link>
            </View>
            {!storeEnabled && <T variant="small" muted style={{ textAlign: 'center' }}>🧪 Demo-Modus: Käufe werden nur simuliert, es wird nichts berechnet.</T>}
          </View>
        </View>
      </ScrollView>

      {!limits?.premium && chosen && (
        <View style={[styles.footer, { backgroundColor: c.background, borderTopColor: c.border, paddingBottom: insets.bottom + 12 }]}>
          <Button title={`Weiter – ${chosen.priceString}`} onPress={() => purchase(chosen)} loading={busy === chosen.id} disabled={!!busy && busy !== chosen.id} />
          <T variant="small" muted style={{ textAlign: 'center' }}>Jederzeit kündbar · {chosen.title} · danach automatische Verlängerung</T>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { padding: Space.xl, paddingBottom: Space.xxl, alignItems: 'center', gap: Space.md },
  close: { position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.15)', alignItems: 'center', justifyContent: 'center' },
  logo: { color: '#fff', fontSize: 48, fontWeight: '900', letterSpacing: -1.5 },
  heroText: { color: '#fff', fontSize: 17, fontWeight: '600', textAlign: 'center', lineHeight: 24, maxWidth: 340 },
  active: { borderWidth: 2, borderRadius: Radius.lg, padding: Space.lg, gap: Space.sm },
  table: { borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Space.md, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  col: { width: 64, textAlign: 'center' },
  plan: { flexDirection: 'row', alignItems: 'center', gap: Space.md, borderWidth: 2, borderRadius: Radius.lg, padding: Space.lg },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Brand.primary },
  badge: { backgroundColor: Brand.primary, borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  boost: { flex: 1, borderWidth: 1, borderRadius: Radius.lg, padding: Space.lg, alignItems: 'center', gap: 4, minHeight: 92, justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: Space.lg, gap: 6, borderTopWidth: StyleSheet.hairlineWidth },
});
