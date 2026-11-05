import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, Space, useTheme } from '@/constants/theme';
import { buy, loadPlans, type StorePlan } from '@/lib/purchases';

import { Button, T } from './ui';

/**
 * Shown when today's Funken are used up: buy a single Funke (or a cheaper pack) right away
 * and send it – without leaving the profile.
 */
export function FunkeSheet({ visible, name, onClose, onBought }: {
  visible: boolean; name?: string; onClose: () => void; onBought: () => void;
}) {
  const c = useTheme();
  const [plans, setPlans] = useState<StorePlan[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (visible && !plans) loadPlans().then((p) => setPlans(p.filter((x) => x.kind === 'funken'))).catch(() => setPlans([]));
  }, [visible, plans]);

  const single = plans?.find((p) => p.amount === 1);
  const save = (p: StorePlan) => (single && p.amount && p.amount > 1 ? Math.round((1 - p.price / (single.price * p.amount)) * 100) : 0);

  async function purchase(p: StorePlan) {
    setBusy(p.id);
    try {
      if (await buy(p)) onBought();
    } catch (e) {
      Alert.alert('Kauf nicht möglich', (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: c.overlay }]} onPress={onClose} accessibilityLabel="Schließen">
        <Pressable style={[styles.sheet, { backgroundColor: c.background }]} onPress={() => {}}>
          <View style={[styles.handle, { backgroundColor: c.border }]} />
          <View style={styles.icon}><Ionicons name="sparkles" size={30} color={Brand.accent} /></View>
          <T variant="h2" style={{ textAlign: 'center' }}>Deine Funken für heute sind weg</T>
          <T muted style={{ textAlign: 'center' }}>
            {name ? `Schick ${name} trotzdem einen Funken – ` : 'Hol dir einen neuen Funken – '}
            er wird gleich danach gesendet. Gekaufte Funken verfallen nicht.
          </T>
          {plans === null ? (
            <ActivityIndicator color={Brand.text} style={{ marginVertical: Space.lg }} />
          ) : (
            <View style={{ gap: Space.sm }}>
              {plans.map((p) => (
                <Pressable key={p.id} onPress={() => purchase(p)} disabled={!!busy} accessibilityRole="button"
                  accessibilityLabel={`${p.title} für ${p.priceString}`}
                  style={({ pressed }) => [styles.option, { borderColor: p.amount === 1 ? Brand.accent : c.border, backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 }]}>
                  <Ionicons name="sparkles" size={20} color={Brand.accent} />
                  <T style={{ flex: 1, fontWeight: '700' }}>{p.title}</T>
                  {save(p) > 0 && <View style={styles.badge}><Text style={styles.badgeText}>−{save(p)} %</Text></View>}
                  {busy === p.id ? <ActivityIndicator color={Brand.text} /> : <T style={{ fontWeight: '800', color: Brand.text }}>{p.priceString}</T>}
                </Pressable>
              ))}
            </View>
          )}
          <Button title="Täglich mehr Funken: Matchwerk+" variant="ghost"
            onPress={() => { onClose(); router.push({ pathname: '/premium', params: { reason: 'superlikes' } }); }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Space.xl, gap: Space.md, paddingBottom: 40 },
  handle: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: Space.xs },
  icon: { alignSelf: 'center', width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(233,169,46,0.15)' },
  option: { flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.lg, borderRadius: Radius.lg, borderWidth: 1.5 },
  badge: { backgroundColor: Brand.accent, borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#2A0E3F', fontSize: 11, fontWeight: '800' },
});
