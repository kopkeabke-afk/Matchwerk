import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Fragment, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, Space, useTheme } from '@/constants/theme';
import { GENDER_LABELS, INTENTION_EMOJI, INTENTION_LABELS, type LikeNote, type Mode, type Profile } from '@/lib/types';
import { ageFrom, type Compatibility } from '@/lib/utils';

import { Chip, T } from './ui';

type Item = NonNullable<LikeNote['item']>;

/** Editorial serif for prompt answers – gives Matchwerk its own voice. */
export const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' });

/**
 * Full, scrollable profile (used for discovery, the profile modal and the own-profile preview).
 * Every photo and answer can be liked individually, optionally with a comment.
 */
export function ProfileView({ profile, compat, onLikeItem, mode = 'dating', spark }: {
  profile: Profile; compat?: Compatibility; onLikeItem?: (item: Item) => void; mode?: Mode; spark?: boolean;
}) {
  const c = useTheme();
  const age = ageFrom(profile.birthdate);
  const likeIcon = mode === 'friends' ? 'hand-left' : 'heart';

  const likeBtn = (item: Item, onDark = false) =>
    onLikeItem ? (
      <Pressable
        onPress={() => onLikeItem(item)}
        accessibilityRole="button"
        accessibilityLabel={item.kind === 'photo' ? 'Auf dieses Foto reagieren' : 'Auf diese Antwort reagieren'}
        style={({ pressed }) => [styles.likeBtn, { backgroundColor: onDark ? 'rgba(255,255,255,0.95)' : c.card, transform: [{ scale: pressed ? 0.9 : 1 }] }]}>
        <Ionicons name={likeIcon} size={24} color={mode === 'friends' ? Brand.super : Brand.heart} />
      </Pressable>
    ) : null;

  const photo = (i: number) =>
    profile.photos[i] ? (
      <View key={`p${i}`} style={styles.photoWrap}>
        <Image source={profile.photos[i]} style={styles.photo} contentFit="cover" transition={150} />
        {likeBtn({ kind: 'photo', index: i }, true)}
      </View>
    ) : null;

  const prompt = (i: number) =>
    profile.prompts[i] ? (
      <View key={`q${i}`} style={[styles.prompt, { backgroundColor: c.surface }]}>
        <Text style={[styles.question, { color: c.textSecondary }]}>{profile.prompts[i].question}</Text>
        <Text style={[styles.answer, { color: c.text }]}>{profile.prompts[i].answer}</Text>
        <View style={styles.promptLike}>{likeBtn({ kind: 'prompt', index: i })}</View>
      </View>
    ) : null;

  const basics: [string, string | undefined][] = [
    ['👤', GENDER_LABELS[profile.gender]],
    ['📏', profile.heightCm ? `${profile.heightCm} cm` : undefined],
    ['💼', profile.job],
    ['🎓', profile.school],
    ['🏡', profile.city],
  ];

  const blocks: ReactNode[] = [];

  // 1 · hero photo with name
  blocks.push(
    <View key="hero" style={styles.heroWrap}>
      <Image source={profile.photos[0]} style={styles.hero} contentFit="cover" transition={150} />
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(20,6,30,0.85)']} style={styles.heroShade} pointerEvents="none" />
      {spark && (
        <View style={styles.spark} pointerEvents="none">
          <Text style={styles.sparkText}>✨ Dein Daily Spark</Text>
        </View>
      )}
      <View style={styles.heroText} pointerEvents="box-none">
        <View style={{ flex: 1 }} pointerEvents="none">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.name} numberOfLines={1}>{profile.name}, {age}</Text>
            {profile.verified && <Ionicons name="checkmark-circle" size={22} color="#7CC4FF" accessibilityLabel="Verifiziert" />}
          </View>
          <Text style={styles.heroMeta}>
            {profile.distanceKm != null ? `${profile.distanceKm} km entfernt` : profile.city}
            {profile.job ? ` · ${profile.job}` : ''}
          </Text>
        </View>
        {likeBtn({ kind: 'photo', index: 0 }, true)}
      </View>
    </View>,
  );

  // 2 · why you match (Matchwerk's own feature)
  if (compat) {
    blocks.push(
      <View key="compat" style={[styles.compat, { backgroundColor: Brand.tint }]}>
        <View style={styles.score}>
          <Text style={styles.scoreNum}>{compat.score}</Text>
          <Text style={styles.scorePct}>%</Text>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <T variant="h3">{mode === 'friends' ? 'Was euch verbindet' : 'Warum ihr passt'}</T>
          <T muted variant="small">{compat.reasons.join(' · ') || 'Lernt euch kennen!'}</T>
          {compat.shared.length > 0 && (
            <View style={styles.wrap}>
              {compat.shared.map((s) => (
                <View key={s} style={[styles.shared, { borderColor: Brand.primary }]}><Text style={[styles.sharedText, { color: Brand.primary }]}>{s}</Text></View>
              ))}
            </View>
          )}
        </View>
      </View>,
    );
  }

  // 3 · intention + basics
  blocks.push(
    <View key="basics" style={{ gap: Space.md }}>
      <View style={[styles.intent, { borderColor: c.border }]}>
        <Text style={{ fontSize: 22 }}>{mode === 'friends' ? '👋' : INTENTION_EMOJI[profile.intention]}</Text>
        <View style={{ flex: 1 }}>
          <T variant="small" muted>{mode === 'friends' ? 'Hier für' : 'Sucht'}</T>
          <T variant="h3">{mode === 'friends' ? 'Neue Freundschaften & gemeinsame Aktivitäten' : INTENTION_LABELS[profile.intention]}</T>
        </View>
      </View>
      <View style={styles.wrap}>
        {basics.filter(([, v]) => v).map(([e, v]) => <Chip key={e} label={v!} icon={e} />)}
      </View>
    </View>,
  );

  // 4 · magazine-style interleaving of answers and photos
  blocks.push(prompt(0), photo(1));
  if (profile.bio) {
    blocks.push(
      <View key="bio" style={{ gap: 6, paddingHorizontal: 4 }}>
        <Text style={[styles.question, { color: c.textSecondary }]}>Über mich</Text>
        <T style={{ fontSize: 17, lineHeight: 25 }}>{profile.bio}</T>
      </View>,
    );
  }
  blocks.push(prompt(1), photo(2));
  if (profile.interests.length) {
    blocks.push(
      <View key="interests" style={{ gap: Space.sm }}>
        <Text style={[styles.question, { color: c.textSecondary }]}>Interessen</Text>
        <View style={styles.wrap}>
          {profile.interests.map((i) => <Chip key={i} label={i} selected={compat?.shared.includes(i)} />)}
        </View>
      </View>,
    );
  }
  for (let i = 2; i < Math.max(profile.photos.length, profile.prompts.length); i++) {
    blocks.push(prompt(i), photo(i + 1));
  }

  return <View style={{ gap: Space.lg }}>{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</View>;
}

const styles = StyleSheet.create({
  heroWrap: { borderRadius: Radius.xl, overflow: 'hidden', backgroundColor: '#2A0E3F' },
  hero: { width: '100%', aspectRatio: 4 / 5 },
  heroShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' },
  heroText: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: Space.lg, flexDirection: 'row', alignItems: 'flex-end', gap: Space.md },
  name: { color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: -0.5, flexShrink: 1 },
  heroMeta: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '500', marginTop: 2 },
  spark: { position: 'absolute', top: 14, left: 14, backgroundColor: Brand.gold, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  sparkText: { color: '#2A0E3F', fontWeight: '800', fontSize: 13 },
  photoWrap: { borderRadius: Radius.xl, overflow: 'hidden', backgroundColor: '#2A0E3F' },
  photo: { width: '100%', aspectRatio: 4 / 5 },
  likeBtn: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  prompt: { borderRadius: Radius.xl, padding: Space.xl, paddingBottom: Space.xl + 8, gap: 10 },
  promptLike: { position: 'absolute', right: 14, bottom: -14 },
  question: { fontSize: 13, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  answer: { fontSize: 26, lineHeight: 34, fontFamily: SERIF },
  compat: { flexDirection: 'row', gap: Space.lg, padding: Space.lg, borderRadius: Radius.xl, alignItems: 'center' },
  score: { flexDirection: 'row', alignItems: 'flex-start' },
  scoreNum: { fontSize: 44, fontWeight: '900', color: Brand.primary, letterSpacing: -1.5, fontFamily: SERIF },
  scorePct: { fontSize: 18, fontWeight: '800', color: Brand.primary, marginTop: 6 },
  intent: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Space.md, borderRadius: Radius.lg, borderWidth: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shared: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  sharedText: { fontSize: 13, fontWeight: '700' },
});
