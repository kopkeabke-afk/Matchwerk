import { router } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, SERIF, Space, useTheme } from '@/constants/theme';
import type { Compatibility } from '@/lib/match';

import { Button, T } from './ui';

/** The full breakdown behind the percentage on the photo. */
export function MatchSheet({ visible, compat, name, onClose }: { visible: boolean; compat: Compatibility; name: string; onClose: () => void }) {
  const c = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: c.overlay }]} onPress={onClose} accessibilityLabel="Schließen">
        <Pressable style={[styles.sheet, { backgroundColor: c.background }]} onPress={() => {}}>
          <View style={[styles.handle, { backgroundColor: c.border }]} />
          <View style={styles.head}>
            <Text style={[styles.big, { color: Brand.text }]}>{compat.score}<Text style={styles.pct}> %</Text></Text>
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="h3">So gut passt ihr</T>
              <T variant="small" muted>In beide Richtungen gerechnet: {name} passt zu dir {compat.forMe} %, du passt zu {name} {compat.forThem} %.</T>
            </View>
          </View>
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: Space.md }}>
            {compat.parts.map((p) => (
              <View key={p.key} style={{ gap: 4 }}>
                <View style={styles.row}>
                  <T style={{ fontWeight: '700', flex: 1 }}>{p.label}</T>
                  <T variant="small" style={{ fontWeight: '800', color: p.value >= 0.75 ? Brand.text : p.value >= 0.2 ? c.textSecondary : Brand.pass }}>
                    {Math.round(p.value * 100)} %
                  </T>
                </View>
                <View style={[styles.bar, { backgroundColor: c.surfaceStrong }]}>
                  <View style={[styles.fill, { width: `${Math.max(4, p.value * 100)}%`, backgroundColor: p.value >= 0.75 ? Brand.accent : p.value >= 0.2 ? Brand.primary : Brand.pass }]} />
                </View>
                <T variant="small" muted>{p.detail}</T>
              </View>
            ))}
            {compat.parts.length < 4 && (
              <T variant="small" muted>Noch wenige Angaben – sobald ihr beide mehr „Über dich“ ausfüllt, wird die Zahl genauer.</T>
            )}
          </ScrollView>
          <T variant="small" muted>
            Was dir wichtig ist, zählt doppelt. Unbekanntes raten wir nicht, sondern lassen es weg.
          </T>
          <Button title="Was mir wichtig ist anpassen" variant="secondary" icon="options-outline"
            onPress={() => { onClose(); router.push('/edit-profile'); }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Space.xl, gap: Space.md, paddingBottom: 40 },
  handle: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: Space.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: Space.lg },
  big: { fontSize: 52, fontWeight: '900', fontFamily: SERIF, letterSpacing: -1.5 },
  pct: { fontSize: 22 },
  row: { flexDirection: 'row', alignItems: 'center' },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
