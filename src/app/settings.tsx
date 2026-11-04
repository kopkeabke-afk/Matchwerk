import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, ScrollView, Switch, View } from 'react-native';

import { Card, Chip, Row, T } from '@/components/ui';
import { APP } from '@/constants/app';
import { Brand, Space } from '@/constants/theme';
import { backend } from '@/lib';
import { manageSubscriptionsUrl } from '@/lib/purchases';
import { useSession } from '@/lib/session';
import { FIRST_MOVE_LABELS, type FirstMove } from '@/lib/types';

export default function Settings() {
  const { profile, saveProfile } = useSession();
  const [busy, setBusy] = useState(false);
  if (!profile) return null;

  const update = async (patch: Partial<typeof profile>) => {
    setBusy(true);
    try {
      await saveProfile({ ...profile, ...patch });
    } catch (e) {
      Alert.alert('Fehler', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  function confirmDelete() {
    Alert.alert(
      'Konto endgültig löschen?',
      'Dein Profil, deine Fotos, Matches und Nachrichten werden unwiderruflich gelöscht.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Endgültig löschen', style: 'destructive',
          onPress: async () => {
            try {
              await backend.deleteAccount();
            } catch (e) {
              Alert.alert('Löschen fehlgeschlagen', `${(e as Error).message}\n\nBitte kontaktiere ${APP.supportEmail}.`);
            }
          },
        },
      ],
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: Space.lg, gap: Space.xl, paddingBottom: 60 }}>
      {backend.mode === 'demo' && (
        <Card><T variant="small">🧪 Demo-Modus aktiv – alle Daten bleiben nur auf diesem Gerät.</T></Card>
      )}

      <View style={{ gap: Space.md }}>
        <T variant="h3">Erster Schritt</T>
        <T muted variant="small">Wer darf nach einem Match zuerst schreiben?</T>
        <View style={{ gap: 8 }}>
          {(Object.keys(FIRST_MOVE_LABELS) as FirstMove[]).map((f) => (
            <Chip key={f} label={FIRST_MOVE_LABELS[f]} selected={profile.firstMove === f} onPress={() => !busy && update({ firstMove: f })} />
          ))}
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.md }}>
        <View style={{ flex: 1 }}>
          <T variant="h3">Profil pausieren</T>
          <T muted variant="small">Du wirst niemandem mehr angezeigt. Bestehende Chats bleiben.</T>
        </View>
        <Switch value={profile.paused} disabled={busy} onValueChange={(paused) => update({ paused })} trackColor={{ true: Brand.primary }} />
      </View>

      <View>
        <T variant="h3">Premium</T>
        <Row icon="sparkles-outline" label="Matchwerk+, VIP, Funken & Boosts" onPress={() => router.push('/premium')} />
        <Row icon="card-outline" label="Abo verwalten oder kündigen" onPress={() => Linking.openURL(manageSubscriptionsUrl)} />
      </View>

      <View>
        <T variant="h3">Sicherheit & Rechtliches</T>
        <Row icon="shield-checkmark-outline" label="Sicherheits-Center" onPress={() => router.push('/legal/safety')} />
        <Row icon="document-text-outline" label="Nutzungsbedingungen" onPress={() => router.push('/legal/terms')} />
        <Row icon="lock-closed-outline" label="Datenschutzerklärung" onPress={() => router.push('/legal/privacy')} />
        <Row icon="mail-outline" label="Support kontaktieren" onPress={() => Linking.openURL(`mailto:${APP.supportEmail}`)} />
      </View>

      <View>
        <T variant="h3">Konto</T>
        <Row icon="log-out-outline" label="Abmelden" onPress={() => backend.signOut()} />
        <Row icon="trash-outline" label="Konto löschen" danger onPress={confirmDelete} />
      </View>

      <T muted variant="small" style={{ textAlign: 'center' }}>
        matchwerk v{Constants.expoConfig?.version ?? '1.0.0'}
      </T>
    </ScrollView>
  );
}
