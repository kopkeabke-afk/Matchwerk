import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileView } from '@/components/profile-view';
import { Button, Card, T } from '@/components/ui';
import { Brand, Space, TabInset, useTheme, WebTabTop } from '@/constants/theme';
import { backend } from '@/lib';
import { useSession } from '@/lib/session';
import type { Limits } from '@/lib/types';
import { ageFrom } from '@/lib/utils';

/** Profile completeness drives tips – complete profiles get noticeably more matches. */
function completeness(p: NonNullable<ReturnType<typeof useSession>['profile']>) {
  const checks: [boolean, string][] = [
    [p.photos.length >= 4, 'Füge mindestens 4 Fotos hinzu'],
    [p.prompts.length >= 3, 'Beantworte 3 Prompts'],
    [p.bio.length >= 40, 'Schreib ein paar Sätze über dich'],
    [!!p.job, 'Gib deinen Job an'],
    [!!p.heightCm, 'Gib deine Größe an'],
    [p.interests.length >= 5, 'Wähle mindestens 5 Interessen'],
  ];
  const done = checks.filter(([ok]) => ok).length;
  return { pct: Math.round(40 + (60 * done) / checks.length), todo: checks.filter(([ok]) => !ok).map(([, t]) => t) };
}

export default function Me() {
  const c = useTheme();
  const { profile } = useSession();
  const [preview, setPreview] = useState(false);
  const [limits, setLimits] = useState<Limits | null>(null);
  useFocusEffect(useCallback(() => { backend.getLimits().then(setLimits).catch(() => {}); }, []));
  if (!profile) return null;
  const { pct, todo } = completeness(profile);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <View style={{ height: WebTabTop }} />
      <ScrollView contentContainerStyle={{ padding: Space.lg, gap: Space.xl, paddingBottom: TabInset + Space.xl }}>
        <View style={styles.header}>
          <T variant="title">Profil</T>
          <Pressable onPress={() => router.push('/settings')} hitSlop={10} accessibilityLabel="Einstellungen">
            <Ionicons name="settings-outline" size={26} color={c.text} />
          </Pressable>
        </View>

        <View style={{ alignItems: 'center', gap: Space.sm }}>
          <View style={[styles.ring, { borderColor: Brand.text }]}>
            <Image source={profile.photos[0]} style={styles.avatar} contentFit="cover" />
          </View>
          <View style={[styles.pct, { backgroundColor: Brand.primary }]}>
            <T variant="small" style={{ color: '#fff', fontWeight: '800' }}>{pct}% vollständig</T>
          </View>
          <T variant="h2">{profile.name}, {ageFrom(profile.birthdate)}</T>
          {profile.paused && <T muted>⏸ Profil pausiert</T>}
        </View>

        <View style={{ flexDirection: 'row', gap: Space.md }}>
          <Button title="Bearbeiten" icon="create-outline" onPress={() => router.push('/edit-profile')} style={{ flex: 1 }} />
          <Button title={preview ? 'Schließen' : 'Vorschau'} icon="eye-outline" variant="secondary" onPress={() => setPreview(!preview)} style={{ flex: 1 }} />
        </View>

        {!preview && (
          <Pressable onPress={() => router.push('/premium')} accessibilityRole="button">
            <LinearGradient colors={Brand.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.plus}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.plusTitle}>{limits?.premium ? `${limits.tier === 'vip' ? 'Matchwerk VIP' : 'Matchwerk+'} ist aktiv` : 'Matchwerk+ oder VIP holen'}</Text>
                <Text style={styles.plusText}>
                  {limits?.premium
                    ? `${limits.freeBoostAvailable ? 'Boost verfügbar · ' : ''}${limits.superlikesLeft + limits.funkenCredits} Funken heute`
                    : 'Mehr Profile, unbegrenzt Likes, mehr Funken – ab 8,99 € im Monat'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#fff" />
            </LinearGradient>
          </Pressable>
        )}

        {todo.length > 0 && !preview && (
          <Card style={{ gap: Space.sm }}>
            <T variant="h3">💡 Mehr Matches bekommen</T>
            {todo.slice(0, 3).map((t) => <T key={t} muted>• {t}</T>)}
          </Card>
        )}

        {!preview && (
          <Card style={{ gap: Space.sm }}>
            <T variant="h3">🛡️ Verifizierung</T>
            <T muted>
              {profile.verified
                ? 'Dein Profil ist verifiziert. Andere sehen den blauen Haken.'
                : 'Verifizierte Profile bekommen mehr Vertrauen und Likes. Die Verifizierung erfolgt per Selfie-Abgleich durch unser Team.'}
            </T>
          </Card>
        )}

        {preview && <ProfileView profile={profile} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ring: { borderWidth: 3, borderRadius: 80, padding: 4 },
  avatar: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#333' },
  plus: { flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.lg, borderRadius: 20 },
  plusTitle: { color: '#fff', fontSize: 20, fontWeight: '900' },
  plusText: { color: '#fff', fontSize: 14, fontWeight: '500', opacity: 0.95 },
  pct: { marginTop: -22, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
});
