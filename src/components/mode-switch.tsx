import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, useTheme } from '@/constants/theme';
import { useSession } from '@/lib/session';
import { MODE_LABELS, type Mode } from '@/lib/types';

/** Segmented "Dating | Freunde" switch. Renders nothing if the profile only uses one mode. */
export function ModeSwitch() {
  const c = useTheme();
  const { profile, mode, setMode } = useSession();
  const modes = profile?.modes?.length ? profile.modes : (['dating'] as Mode[]);
  if (modes.length < 2) return null;
  return (
    <View style={[styles.wrap, { backgroundColor: c.surface }]} accessibilityRole="tablist">
      {modes.map((m) => {
        const on = m === mode;
        return (
          <Pressable key={m} onPress={() => setMode(m)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={[styles.seg, on && { backgroundColor: c.card, shadowOpacity: 0.12 }]}>
            <Text style={[styles.text, { color: on ? (m === 'friends' ? Brand.super : Brand.primary) : c.textSecondary }]}>
              {m === 'friends' ? '👋 ' : '🔥 '}{MODE_LABELS[m]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', borderRadius: Radius.pill, padding: 3 },
  seg: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.pill,
    shadowColor: '#000', shadowOpacity: 0, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 0,
  },
  text: { fontWeight: '700', fontSize: 14 },
});
