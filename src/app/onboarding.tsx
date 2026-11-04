import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InterestPicker, locate, PhotoGrid, PromptEditor } from '@/components/profile-editors';
import { Button, Chip, Field, T } from '@/components/ui';
import { Brand, Radius, Space, useTheme } from '@/constants/theme';
import { backend } from '@/lib';
import { useSession } from '@/lib/session';
import {
  FIRST_MOVE_LABELS, GENDER_LABELS, INTENTION_EMOJI, INTENTION_LABELS, INTEREST_LABELS,
  type FirstMove, type Gender, type Intention, type Interest, type Profile,
} from '@/lib/types';
import { isAdult } from '@/lib/utils';

const STEPS = 8;

export default function Onboarding() {
  const c = useTheme();
  const { saveProfile } = useSession();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dd, setDd] = useState('');
  const [mm, setMm] = useState('');
  const [yyyy, setYyyy] = useState('');
  const [p, setP] = useState<Profile>({
    id: '', name: '', birthdate: '', gender: 'woman', interestedIn: 'men', bio: '', photos: [], prompts: [],
    interests: [], intention: 'long_term', verified: false, firstMove: 'anyone', paused: false,
  });
  const set = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));
  const birthdate = `${yyyy.padStart(4, '0')}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  const dateValid = yyyy.length === 4 && !!mm && !!dd && !Number.isNaN(new Date(birthdate).getTime()) && new Date(birthdate).getDate() === Number(dd);

  const valid = [
    p.name.trim().length >= 2,
    dateValid && isAdult(birthdate),
    true,
    true,
    p.photos.length >= 2,
    p.interests.length >= 3,
    p.prompts.filter((x) => x.answer.trim()).length >= 2,
    true,
  ][step];

  async function next() {
    if (step === 1 && dateValid && !isAdult(birthdate)) {
      Alert.alert('Leider nein', 'matchwerk ist nur für Personen ab 18 Jahren.');
      return;
    }
    if (step === 1) set({ birthdate });
    if (step < STEPS - 1) return setStep(step + 1);
    setBusy(true);
    try {
      const loc = await locate().catch(() => null);
      // demo without location permission: default to Berlin so the deck has people nearby
      const where = loc ?? (backend.mode === 'demo' ? { lat: 52.52, lng: 13.4, city: 'Berlin' } : {});
      await saveProfile({ ...p, birthdate, prompts: p.prompts.filter((x) => x.answer.trim()), ...where });
    } catch (e) {
      Alert.alert('Fehler', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const titles = [
    'Wie heißt du?', 'Wann hast du Geburtstag?', 'Erzähl uns von dir', 'Was suchst du?',
    'Zeig dich', 'Was begeistert dich?', 'Gib Gesprächsstoff', 'Fast fertig!',
  ];
  const subtitles = [
    'So wird dein Name auf matchwerk angezeigt.', 'Dein Alter wird angezeigt, dein Geburtsdatum nicht.', '',
    'Ehrlichkeit von Anfang an – wir zeigen dir Menschen mit ähnlichen Zielen.',
    'Mindestens 2 Fotos. Tipp: Gesicht gut sichtbar, natürliches Licht.',
    'Wähle 3–10 Interessen. Gemeinsamkeiten erhöhen deinen Match-Score.',
    'Beantworte mindestens 2 Prompts – sie sind der beste Einstieg ins Gespräch.',
    'Wir nutzen deinen ungefähren Standort (auf ~1 km gerundet), um Menschen in deiner Nähe zu zeigen.',
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.progress}>
          {Array.from({ length: STEPS }).map((_, i) => (
            <View key={i} style={[styles.seg, { backgroundColor: i <= step ? Brand.primary : c.surfaceStrong }]} />
          ))}
        </View>
        <ScrollView contentContainerStyle={{ padding: Space.xl, gap: Space.lg }} keyboardShouldPersistTaps="handled">
          <T variant="title">{titles[step]}</T>
          {!!subtitles[step] && <T muted>{subtitles[step]}</T>}

          {step === 0 && (
            <Field value={p.name} onChangeText={(name) => set({ name })} placeholder="Vorname" autoFocus maxLength={40} textContentType="givenName" />
          )}

          {step === 1 && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Field label="Tag" value={dd} onChangeText={(t) => setDd(t.replace(/\D/g, '').slice(0, 2))} placeholder="TT" keyboardType="number-pad" autoFocus /></View>
              <View style={{ flex: 1 }}><Field label="Monat" value={mm} onChangeText={(t) => setMm(t.replace(/\D/g, '').slice(0, 2))} placeholder="MM" keyboardType="number-pad" /></View>
              <View style={{ flex: 1.5 }}><Field label="Jahr" value={yyyy} onChangeText={(t) => setYyyy(t.replace(/\D/g, '').slice(0, 4))} placeholder="JJJJ" keyboardType="number-pad" /></View>
            </View>
          )}

          {step === 2 && (
            <View style={{ gap: Space.lg }}>
              <T variant="h3">Ich bin</T>
              <View style={styles.wrap}>
                {(Object.keys(GENDER_LABELS) as Gender[]).map((g) => (
                  <Chip key={g} label={GENDER_LABELS[g]} selected={p.gender === g} onPress={() => set({ gender: g })} />
                ))}
              </View>
              <T variant="h3">Ich möchte kennenlernen</T>
              <View style={styles.wrap}>
                {(Object.keys(INTEREST_LABELS) as Interest[]).map((g) => (
                  <Chip key={g} label={INTEREST_LABELS[g]} selected={p.interestedIn === g} onPress={() => set({ interestedIn: g })} />
                ))}
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={{ gap: 10 }}>
              {(Object.keys(INTENTION_LABELS) as Intention[]).map((i) => (
                <Chip key={i} icon={INTENTION_EMOJI[i]} label={INTENTION_LABELS[i]} selected={p.intention === i} onPress={() => set({ intention: i })} />
              ))}
            </View>
          )}

          {step === 4 && <PhotoGrid photos={p.photos} onChange={(photos) => set({ photos })} />}
          {step === 5 && <InterestPicker value={p.interests} onChange={(interests) => set({ interests })} />}
          {step === 6 && (
            <View style={{ gap: Space.lg }}>
              <PromptEditor value={p.prompts} onChange={(prompts) => set({ prompts })} />
              <Field label="Kurz über dich (optional)" value={p.bio} onChangeText={(bio) => set({ bio })} multiline maxLength={500} placeholder="Ein paar Sätze, die dich beschreiben …" />
            </View>
          )}
          {step === 7 && (
            <View style={{ gap: Space.md }}>
              <T variant="h3">Wer schreibt nach einem Match zuerst?</T>
              <T muted variant="small">Du entscheidest. Wer zuerst schreiben darf, hat 48 Stunden Zeit – danach läuft das Match ab (einmal verlängerbar).</T>
              {(Object.keys(FIRST_MOVE_LABELS) as FirstMove[]).map((f) => (
                <Chip key={f} label={FIRST_MOVE_LABELS[f]} selected={p.firstMove === f} onPress={() => set({ firstMove: f })} />
              ))}
              <View style={[styles.note, { backgroundColor: c.surface }]}>
                <T variant="small">🛡️ Deine Sicherheit zuerst: Du kannst jedes Profil jederzeit melden oder blockieren. Unser Team prüft Meldungen innerhalb von 24 Stunden.</T>
              </View>
            </View>
          )}
        </ScrollView>
        <View style={styles.footer}>
          {step > 0 && <Button title="Zurück" variant="secondary" onPress={() => setStep(step - 1)} style={{ flex: 1 }} />}
          <Button title={step === STEPS - 1 ? 'Standort freigeben & los' : 'Weiter'} onPress={next} disabled={!valid} loading={busy} style={{ flex: 2 }} />
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: 4, paddingHorizontal: Space.xl, paddingTop: Space.md },
  seg: { flex: 1, height: 4, borderRadius: 2 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footer: { flexDirection: 'row', gap: 10, padding: Space.xl, paddingTop: Space.sm },
  note: { padding: Space.md, borderRadius: Radius.md, marginTop: Space.md },
});
