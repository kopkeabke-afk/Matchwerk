import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';

import { Brand, Radius, Space, Type, useTheme } from '@/constants/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function T({ style, variant = 'body', muted, children, ...rest }: {
  style?: StyleProp<TextStyle>; variant?: keyof typeof Type; muted?: boolean; children: ReactNode; numberOfLines?: number;
}) {
  const c = useTheme();
  return (
    <Text {...rest} style={[Type[variant], { color: muted ? c.textSecondary : c.text }, style]}>
      {children}
    </Text>
  );
}

export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, style }: {
  title: string; onPress?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const off = disabled || loading;
  const fg = variant === 'primary' ? '#fff' : variant === 'danger' ? Brand.pass : c.text;
  const inner = (
    <View style={styles.btnInner}>
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon && <Ionicons name={icon} size={18} color={fg} />}
          <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
        </>
      )}
    </View>
  );
  return (
    <Pressable
      accessibilityRole="button"
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [{ opacity: off ? 0.5 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}>
      {variant === 'primary' ? (
        <LinearGradient colors={Brand.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
          {inner}
        </LinearGradient>
      ) : (
        <View style={[styles.btn, variant === 'secondary' && { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }]}>
          {inner}
        </View>
      )}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: string }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? Brand.primary : c.surface, borderColor: selected ? Brand.primary : c.border }]}>
      <Text style={{ color: selected ? '#fff' : c.text, fontWeight: '600', fontSize: 14 }}>
        {icon ? `${icon} ` : ''}{label}
      </Text>
    </Pressable>
  );
}

export function Field({ label, style, ...props }: TextInputProps & { label?: string }) {
  const c = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label && <T variant="small" muted style={{ fontWeight: '600' }}>{label}</T>}
      <TextInput
        placeholderTextColor={c.textSecondary}
        {...props}
        style={[styles.input, { color: c.text, backgroundColor: c.surface, borderColor: c.border }, props.multiline && { minHeight: 96, textAlignVertical: 'top' }, style]}
      />
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  return <View style={[{ backgroundColor: c.surface, borderRadius: Radius.lg, padding: Space.lg }, style]}>{children}</View>;
}

export function Row({ icon, label, value, onPress, danger }: { icon: IconName; label: string; value?: string; onPress?: () => void; danger?: boolean }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      <Ionicons name={icon} size={20} color={danger ? Brand.pass : c.text} />
      <Text style={{ flex: 1, fontSize: 16, color: danger ? Brand.pass : c.text }}>{label}</Text>
      {value ? <Text style={{ color: c.textSecondary, fontSize: 15 }}>{value}</Text> : null}
      {onPress && <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />}
    </Pressable>
  );
}

export function Empty({ icon, title, text, children }: { icon: IconName; title: string; text: string; children?: ReactNode }) {
  const c = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: c.surface }]}>
        <Ionicons name={icon} size={40} color={Brand.primary} />
      </View>
      <T variant="h2" style={{ textAlign: 'center' }}>{title}</T>
      <T muted style={{ textAlign: 'center' }}>{text}</T>
      {children}
    </View>
  );
}

export function IconButton({ icon, onPress, color, bg, size = 56, label }: {
  icon: IconName; onPress: () => void; color: string; bg?: string; size?: number; label: string;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.iconBtn, {
        width: size, height: size, borderRadius: size / 2, backgroundColor: bg ?? c.card,
        transform: [{ scale: pressed ? 0.9 : 1 }], borderColor: c.border,
      }]}>
      <Ionicons name={icon} size={size * 0.45} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: Radius.pill, paddingVertical: 15, paddingHorizontal: Space.xl },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 22 },
  btnText: { fontSize: 16, fontWeight: '700' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1 },
  input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Space.xxl, gap: Space.md },
  emptyIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: Space.sm },
  iconBtn: {
    alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
});
