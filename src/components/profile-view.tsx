import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, Space, useTheme } from '@/constants/theme';
import { GENDER_LABELS, INTENTION_EMOJI, INTENTION_LABELS, type LikeNote, type Profile } from '@/lib/types';
import { ageFrom, type Compatibility } from '@/lib/utils';

import { Chip, T } from './ui';

type Item = NonNullable<LikeNote['item']>;

/** Full, scrollable profile. Every photo and prompt can be liked individually (with optional comment). */
export function ProfileView({ profile, compat, onLikeItem }: {
  profile: Profile; compat?: Compatibility; onLikeItem?: (item: Item) => void;
}) {
  const c = useTheme();
  const age = ageFrom(profile.birthdate);

  const heart = (item: Item) =>
    onLikeItem ? (
      <Pressable
        onPress={() => onLikeItem(item)}
        accessibilityLabel={item.kind === 'photo' ? 'Dieses Foto liken' : 'Diese Antwort liken'}
        style={[styles.heart, { backgroundColor: c.card }]}>
        <Ionicons name="heart" size={24} color={Brand.primary} />
      </Pressable>
    ) : null;

  const photo = (i: number) =>
    profile.photos[i] ? (
      <View key={`p${i}`} style={styles.photoWrap}>
        <Image source={profile.photos[i]} style={styles.photo} contentFit="cover" transition={150} />
        {heart({ kind: 'photo', index: i })}
      </View>
    ) : null;

  const prompt = (i: number) =>
    profile.prompts[i] ? (
      <View key={`q${i}`} style={[styles.prompt, { backgroundColor: c.surface }]}>
        <T variant="small" muted style={{ fontWeight: '600' }}>{profile.prompts[i].question}</T>
        <T style={{ fontSize: 24, fontWeight: '700', lineHeight: 30, marginTop: 6 }}>{profile.prompts[i].answer}</T>
        {heart({ kind: 'prompt', index: i })}
      </View>
    ) : null;

  const basics: [string, string | undefined][] = [
    ['🎂', `${age}`],
    ['👤', GENDER_LABELS[profile.gender]],
    ['📏', profile.heightCm ? `${profile.heightCm} cm` : undefined],
    ['📍', profile.distanceKm != null ? `${profile.distanceKm} km` : profile.city],
    ['💼', profile.job],
    ['🎓', profile.school],
  ];

  // interleave photos and prompts like a magazine layout
  const blocks: ReactNode[] = [photo(0)];
  blocks.push(
    <View key="head" style={{ gap: Space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <T variant="title">{profile.name}</T>
        {profile.verified && <Ionicons name="checkmark-circle" size={24} color={Brand.super} />}
      </View>
      <View style={[styles.intent, { backgroundColor: c.surface }]}>
        <Text style={{ fontSize: 22 }}>{INTENTION_EMOJI[profile.intention]}</Text>
        <View>
          <T variant="small" muted>Sucht</T>
          <T variant="h3">{INTENTION_LABELS[profile.intention]}</T>
        </View>
      </View>
      <View style={styles.wrap}>
        {basics.filter(([, v]) => v).map(([e, v]) => <Chip key={e} label={v!} icon={e} />)}
      </View>
    </View>,
  );
  if (compat) {
    blocks.push(
      <View key="compat" style={[styles.compat, { borderColor: Brand.primary }]}>
        <T variant="h3">🔥 {compat.score}% Kompatibilität</T>
        <T muted>{compat.reasons.join(' · ') || 'Lernt euch kennen!'}</T>
        {compat.shared.length > 0 && (
          <View style={styles.wrap}>{compat.shared.map((s) => <Chip key={s} label={s} selected />)}</View>
        )}
      </View>,
    );
  }
  blocks.push(prompt(0), photo(1));
  if (profile.bio) {
    blocks.push(
      <View key="bio" style={{ gap: 6 }}>
        <T variant="h3">Über mich</T>
        <T>{profile.bio}</T>
      </View>,
    );
  }
  blocks.push(prompt(1), photo(2));
  if (profile.interests.length) {
    blocks.push(
      <View key="interests" style={{ gap: Space.sm }}>
        <T variant="h3">Interessen</T>
        <View style={styles.wrap}>
          {profile.interests.map((i) => <Chip key={i} label={i} selected={compat?.shared.includes(i)} />)}
        </View>
      </View>,
    );
  }
  for (let i = 2; i < Math.max(profile.photos.length, profile.prompts.length); i++) {
    blocks.push(prompt(i), photo(i + 1));
  }

  return <View style={{ gap: Space.xl }}>{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</View>;
}

const styles = StyleSheet.create({
  photoWrap: { borderRadius: Radius.lg, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 4 / 5, backgroundColor: '#333' },
  heart: {
    position: 'absolute', right: 14, bottom: 14, width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  prompt: { borderRadius: Radius.lg, padding: Space.xl, paddingBottom: 72 },
  intent: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Space.md, borderRadius: Radius.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  compat: { borderWidth: 2, borderRadius: Radius.lg, padding: Space.lg, gap: Space.sm },
});
