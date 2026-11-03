import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { Button, Chip, Field, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { backend } from '@/lib';
import { bus } from '@/lib/events';
import { REPORT_REASONS } from '@/lib/types';

export default function Report() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!reason) return;
    setBusy(true);
    try {
      await backend.report(id, reason, details.trim());
      bus.emit('swiped', { id });
      Alert.alert('Danke für deine Meldung', 'Wir prüfen sie innerhalb von 24 Stunden. Die Person wurde für dich blockiert.', [
        { text: 'OK', onPress: () => router.dismissAll() },
      ]);
    } catch (e) {
      Alert.alert('Fehler', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: Space.lg, gap: Space.lg }}>
      <T muted>Deine Meldung ist anonym. Die Person erfährt nicht, dass du sie gemeldet hast, und wird automatisch für dich blockiert.</T>
      <View style={{ gap: 8 }}>
        {REPORT_REASONS.map((r) => <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />)}
      </View>
      <Field label="Details (optional)" value={details} onChangeText={setDetails} multiline maxLength={1000} placeholder="Was ist passiert?" />
      <Button title="Melden & blockieren" onPress={submit} disabled={!reason} loading={busy} />
      <T muted variant="small">Bei akuter Gefahr wähle bitte immer den Notruf 110 bzw. 112.</T>
    </ScrollView>
  );
}
