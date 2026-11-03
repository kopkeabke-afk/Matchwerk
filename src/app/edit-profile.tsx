import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { InterestPicker, PhotoGrid, PromptEditor } from '@/components/profile-editors';
import { Button, Chip, Field, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { useSession } from '@/lib/session';
import { GENDER_LABELS, INTENTION_EMOJI, INTENTION_LABELS, INTEREST_LABELS, type Gender, type Intention, type Interest, type Profile } from '@/lib/types';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: Space.md }}>
      <T variant="h3">{title}</T>
      {children}
    </View>
  );
}

export default function EditProfile() {
  const { profile, saveProfile } = useSession();
  const [p, setP] = useState<Profile>(profile!);
  const [height, setHeight] = useState(profile?.heightCm ? String(profile.heightCm) : '');
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));

  async function save() {
    if (p.photos.length < 2) return Alert.alert('Mindestens 2 Fotos', 'Bitte behalte mindestens 2 Fotos in deinem Profil.');
    if (p.name.trim().length < 2) return Alert.alert('Name fehlt');
    const h = Number(height);
    setBusy(true);
    try {
      await saveProfile({ ...p, heightCm: h >= 120 && h <= 240 ? h : undefined, prompts: p.prompts.filter((x) => x.answer.trim()) });
      router.back();
    } catch (e) {
      Alert.alert('Speichern fehlgeschlagen', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: Space.lg, gap: Space.xl, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Section title="Fotos">
          <T muted variant="small">Tippe auf ein Foto, um es zum Hauptfoto zu machen.</T>
          <PhotoGrid photos={p.photos} onChange={(photos) => set({ photos })} />
        </Section>
        <Section title="Prompts">
          <PromptEditor value={p.prompts} onChange={(prompts) => set({ prompts })} />
        </Section>
        <Section title="Über mich">
          <Field value={p.bio} onChangeText={(bio) => set({ bio })} multiline maxLength={500} placeholder="Ein paar Sätze über dich …" />
        </Section>
        <Section title="Basics">
          <Field label="Name" value={p.name} onChangeText={(name) => set({ name })} maxLength={40} />
          <Field label="Job" value={p.job ?? ''} onChangeText={(job) => set({ job })} maxLength={60} placeholder="z. B. Designerin" />
          <Field label="Ausbildung" value={p.school ?? ''} onChangeText={(school) => set({ school })} maxLength={60} placeholder="z. B. TU Berlin" />
          <Field label="Größe (cm)" value={height} onChangeText={(t) => setHeight(t.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" placeholder="175" />
        </Section>
        <Section title="Ich bin">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(Object.keys(GENDER_LABELS) as Gender[]).map((g) => <Chip key={g} label={GENDER_LABELS[g]} selected={p.gender === g} onPress={() => set({ gender: g })} />)}
          </View>
        </Section>
        <Section title="Ich möchte kennenlernen">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(Object.keys(INTEREST_LABELS) as Interest[]).map((g) => <Chip key={g} label={INTEREST_LABELS[g]} selected={p.interestedIn === g} onPress={() => set({ interestedIn: g })} />)}
          </View>
        </Section>
        <Section title="Ich suche">
          <View style={{ gap: 8 }}>
            {(Object.keys(INTENTION_LABELS) as Intention[]).map((i) => (
              <Chip key={i} icon={INTENTION_EMOJI[i]} label={INTENTION_LABELS[i]} selected={p.intention === i} onPress={() => set({ intention: i })} />
            ))}
          </View>
        </Section>
        <Section title="Interessen">
          <InterestPicker value={p.interests} onChange={(interests) => set({ interests })} />
        </Section>
        <Button title="Speichern" onPress={save} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
