import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Fragment, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, SERIF, Space, useTheme } from '@/constants/theme';
import { GENDER_LABELS, INTENTION_EMOJI, INTENTION_LABELS, type Activity, type LikeNote, type Mode, type Profile } from '@/lib/types';
import { PET_OPTIONS, labelOf } from '@/lib/traits';
import { ageFrom, type Compatibility } from '@/lib/utils';

import { ActivityMini } from './activity-card';
import { MatchSheet } from './match-sheet';
import { Chip, T } from './ui';

type Item = NonNullable<LikeNote['item']>;

/** Editorial serif for prompt answers – gives Matchwerk its own voice. */
export { SERIF };

export interface DecideActions {
  onPass: () => void;
  onLike: () => void;
  onFunke: () => void;
}

/**
 * Full, scrollable profile (used for discovery, the profile modal and the own-profile preview).
 * Every photo and answer can be liked individually, optionally with a comment.
 * With `actions`, the big first photo carries the decision: no on the left, yes on the right,
 * a Funke at the top centre – and the end of the profile repeats no / yes.
 */
export function ProfileView({ profile, compat, onLikeItem, mode = 'dating', spark, actions, activities }: {
  profile: Profile; compat?: Compatibility; onLikeItem?: (item: Item) => void; mode?: Mode; spark?: boolean;
  actions?: DecideActions;
  /** upcoming activities this person hosts or joined ("Macht mit bei") */
  activities?: Activity[];
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
    ['👤', profile.genderDetail ? `${GENDER_LABELS[profile.gender]} · ${profile.genderDetail}` : GENDER_LABELS[profile.gender]],
    ['📏', profile.heightCm ? `${profile.heightCm} cm` : undefined],
    ['💼', profile.job],
    ['🎓', profile.school],
    ['🏡', profile.city],
  ];

  const t = profile.traits ?? {};
  const traitChips: [string, string | undefined][] = [
    ['👶', t.kidsWish ? labelOf('kidsWish', t.kidsWish) : undefined],
    ['🏠', t.hasKids === 'yes' ? 'Hat Kinder' : undefined],
    ['🚭', t.smoking ? labelOf('smoking', t.smoking) : undefined],
    ['🍷', t.drinking ? `Alkohol: ${labelOf('drinking', t.drinking)}` : undefined],
    ['🏃', t.sport ? `Sport: ${labelOf('sport', t.sport)}` : undefined],
    ['🥗', t.diet ? labelOf('diet', t.diet) : undefined],
    ['🙂', t.personality ? labelOf('personality', t.personality) : undefined],
    ['⏰', t.rhythm ? labelOf('rhythm', t.rhythm) : undefined],
    ['🎓', t.education ? labelOf('education', t.education) : undefined],
    ...(t.pets ?? []).filter((x) => x !== 'none').map((x): [string, string | undefined] => [PET_OPTIONS.find((o) => o.id === x)?.emoji ?? '🐾', PET_OPTIONS.find((o) => o.id === x)?.label]),
    ['🗣️', t.languages?.length ? t.languages.join(', ') : undefined],
  ];

  const blocks: ReactNode[] = [];

  const [showMatch, setShowMatch] = useState(false);
  const friends = mode === 'friends';
  const yesColor = friends ? Brand.super : Brand.heart;
  const yesLabel = friends ? 'Verbinden' : 'Like';

  // 1 · hero photo with name
  blocks.push(
    <View key="hero" style={styles.heroWrap}>
      <Image source={profile.photos[0]} style={[styles.hero, actions && styles.heroBig]} contentFit="cover" transition={150} />
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(20,6,30,0.88)']} style={styles.heroShade} pointerEvents="none" />
      <LinearGradient colors={['rgba(20,6,30,0.45)', 'rgba(20,6,30,0)']} style={styles.heroTopShade} pointerEvents="none" />
      {compat && (
        <Pressable onPress={() => setShowMatch(true)} accessibilityRole="button"
          accessibilityLabel={`${compat.score} Prozent Match. ${compat.reasons.join(', ')}. Antippen für alle Details`}
          style={styles.scoreWrap}>
          <View style={styles.scorePill}>
            <Text style={styles.scoreNum}>{compat.score}<Text style={styles.scorePct}> %</Text></Text>
            <Ionicons name="information-circle-outline" size={15} color="#FFE3A3" />
          </View>
          {compat.reasons.map((r) => (
            <View key={r} style={styles.reason}><Text style={styles.reasonText} numberOfLines={1}>{r}</Text></View>
          ))}
        </Pressable>
      )}
      {spark && !actions && (
        <View style={styles.spark} pointerEvents="none">
          <Text style={styles.sparkText}>✨ Dein Daily Spark</Text>
        </View>
      )}
      {actions && (
        <View style={styles.funkeWrap} pointerEvents="box-none">
          <Pressable onPress={actions.onFunke} accessibilityRole="button" accessibilityLabel="Funke senden"
            style={({ pressed }) => [styles.funke, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}>
            <Ionicons name="sparkles" size={18} color={Brand.accent} />
            <Text style={styles.funkeText}>Funke</Text>
          </Pressable>
        </View>
      )}
      {actions ? (
        <View style={styles.heroBottom} pointerEvents="box-none">
          <View pointerEvents="none" style={{ paddingHorizontal: 4 }}>
            {spark && <View style={[styles.spark, styles.sparkInline]}><Text style={styles.sparkText}>✨ Dein Daily Spark</Text></View>}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.name} numberOfLines={1}>{profile.name}, {age}</Text>
              {profile.verified && <Ionicons name="checkmark-circle" size={22} color="#7CC4FF" accessibilityLabel="Verifiziert" />}
            </View>
            <Text style={styles.heroMeta}>
              {profile.distanceKm != null ? `${profile.distanceKm} km entfernt` : profile.city}
              {profile.job ? ` · ${profile.job}` : ''}
            </Text>
          </View>
          <View style={styles.decideRow} pointerEvents="box-none">
            <Pressable onPress={actions.onPass} accessibilityRole="button" accessibilityLabel="Weiter"
              style={({ pressed }) => [styles.decide, styles.decideNo, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}>
              <Ionicons name="close" size={30} color="#fff" />
            </Pressable>
            <Pressable onPress={actions.onLike} onLongPress={onLikeItem ? () => onLikeItem({ kind: 'photo', index: 0 }) : undefined}
              accessibilityRole="button" accessibilityLabel={yesLabel} accessibilityHint="Lange drücken, um etwas dazu zu schreiben"
              style={({ pressed }) => [styles.decide, { backgroundColor: 'rgba(255,255,255,0.96)', transform: [{ scale: pressed ? 0.92 : 1 }] }]}>
              <Ionicons name={likeIcon} size={30} color={yesColor} />
            </Pressable>
          </View>
        </View>
      ) : (
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
      )}
    </View>,
  );

  // 2b · Macht mit bei … – shared plans are the easiest way to start talking
  if (activities?.length) {
    blocks.push(
      <View key="acts" style={{ gap: Space.sm }}>
        <Text style={[styles.question, { color: c.textSecondary }]}>🎉 {profile.name} macht mit bei</Text>
        {activities.map((a) => <ActivityMini key={a.id} a={a} onPress={() => router.push(`/activity/${a.id}`)} />)}
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
        {[...basics, ...traitChips].filter(([, v]) => v).map(([e, v]) => <Chip key={`${e}${v}`} label={v!} icon={e} />)}
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
  if (t.skills?.length) {
    blocks.push(
      <View key="skills" style={{ gap: Space.sm }}>
        <Text style={[styles.question, { color: c.textSecondary }]}>Das kann {profile.name} gut</Text>
        <View style={styles.wrap}>{t.skills.map((x) => <Chip key={x} label={x} icon="⭐" />)}</View>
      </View>,
    );
  }
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

  // end of the profile: decide without scrolling back up
  if (actions) {
    blocks.push(
      <View key="end" style={styles.endRow}>
        <Pressable onPress={actions.onPass} accessibilityRole="button" accessibilityLabel="Weiter"
          style={({ pressed }) => [styles.endBtn, { borderColor: c.border, backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 }]}>
          <Ionicons name="close" size={22} color={Brand.pass} />
          <Text style={[styles.endText, { color: c.text }]}>Nein</Text>
        </Pressable>
        <Pressable onPress={actions.onLike} accessibilityRole="button" accessibilityLabel={yesLabel}
          style={({ pressed }) => [styles.endBtn, { borderColor: yesColor, backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 }]}>
          <Ionicons name={likeIcon} size={22} color={yesColor} />
          <Text style={[styles.endText, { color: c.text }]}>{friends ? 'Verbinden' : 'Ja'}</Text>
        </Pressable>
      </View>,
    );
  }

  return (
    <View style={{ gap: Space.lg }}>
      {blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}
      {compat && <MatchSheet visible={showMatch} compat={compat} name={profile.name} onClose={() => setShowMatch(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  heroWrap: { borderRadius: Radius.xl, overflow: 'hidden', backgroundColor: '#2A0E3F' },
  hero: { width: '100%', aspectRatio: 4 / 5 },
  heroBig: { aspectRatio: 3 / 4.3 },
  heroBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: Space.lg, gap: Space.md },
  decideRow: { flexDirection: 'row', justifyContent: 'space-between' },
  decide: {
    width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  decideNo: { backgroundColor: 'rgba(20,6,30,0.55)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)' },
  funkeWrap: { position: 'absolute', top: 14, left: 0, right: 0, alignItems: 'center' },
  funke: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: Radius.pill,
    backgroundColor: 'rgba(20,6,30,0.6)', borderWidth: 1, borderColor: 'rgba(233,169,46,0.75)',
  },
  funkeText: { color: '#FFE3A3', fontWeight: '800', fontSize: 14 },
  sparkInline: { position: 'relative', top: 0, left: 0, alignSelf: 'flex-start', marginBottom: 8 },
  endRow: { flexDirection: 'row', gap: Space.md, marginTop: Space.sm },
  endBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: Radius.pill, borderWidth: 1.5 },
  endText: { fontSize: 16, fontWeight: '700' },
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
  heroTopShade: { position: 'absolute', left: 0, right: 0, top: 0, height: 140 },
  scoreWrap: { position: 'absolute', top: 12, right: 12, alignItems: 'flex-end', gap: 5, maxWidth: '46%' },
  scorePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 12, paddingRight: 8, paddingVertical: 4, borderRadius: Radius.pill,
    backgroundColor: 'rgba(20,6,30,0.72)', borderWidth: 1.5, borderColor: Brand.accent,
  },
  scoreNum: { color: '#FFE3A3', fontSize: 22, fontWeight: '900', fontFamily: SERIF, letterSpacing: -0.5 },
  scorePct: { fontSize: 14, fontWeight: '800' },
  reasonFirst: { marginTop: 4 },
  reason: { backgroundColor: 'rgba(20,6,30,0.6)', borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  reasonText: { color: '#fff', fontSize: 11.5, fontWeight: '700' },
  intent: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Space.md, borderRadius: Radius.lg, borderWidth: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shared: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  sharedText: { fontSize: 13, fontWeight: '700' },
});
