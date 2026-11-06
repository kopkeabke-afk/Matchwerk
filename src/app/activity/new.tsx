import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Field, T } from '@/components/ui';
import { Brand, Radius, Space, useTheme } from '@/constants/theme';
import { backend } from '@/lib';
import { ACTIVITY_CATEGORIES, limitReason, type ActivityCategory } from '@/lib/types';

const MINUTES = [0, 15, 30, 45];

function Stepper({ value, set, min, max, label, format = String }: {
  value: number; set: (n: number) => void; min: number; max: number; label: string; format?: (n: number) => string;
}) {
  const c = useTheme();
  return (
    <View style={[styles.stepper, { backgroundColor: c.surface }]}>
      <Pressable onPress={() => set(Math.max(min, value - 1))} accessibilityLabel={`${label} weniger`} hitSlop={8} style={[styles.stepBtn, { borderColor: c.border }]}>
        <Ionicons name="remove" size={18} color={c.text} />
      </Pressable>
      <T variant="h3" style={{ minWidth: 44, textAlign: 'center' }}>{format(value)}</T>
      <Pressable onPress={() => set(Math.min(max, value + 1))} accessibilityLabel={`${label} mehr`} hitSlop={8} style={[styles.stepBtn, { borderColor: c.border }]}>
        <Ionicons name="add" size={18} color={c.text} />
      </Pressable>
    </View>
  );
}

/** Offer an activity: what, when, where, how many. */
export default function NewActivity() {
  const c = useTheme();
  const days = useMemo(() => Array.from({ length: 21 }, (_, i) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); return d;
  }), []);
  const [category, setCategory] = useState<ActivityCategory>('coffee');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [place, setPlace] = useState('');
  const [day, setDay] = useState(new Date().getHours() >= 20 ? 1 : 0);
  const [hour, setHour] = useState(Math.min(21, Math.max(9, new Date().getHours() + 2)));
  const [minute, setMinute] = useState(0);
  const [maxPeople, setMaxPeople] = useState(6);
  const [busy, setBusy] = useState(false);
  const [openedAt] = useState(() => Date.now());

  const startsAt = new Date(days[day]);
  startsAt.setHours(hour, minute, 0, 0);
  const tooSoon = startsAt.getTime() < openedAt + 15 * 60_000;
  const valid = title.trim().length >= 3 && place.trim().length >= 2 && !tooSoon;

  const dayLabel = (d: Date, i: number) =>
    i === 0 ? 'Heute' : i === 1 ? 'Morgen' : d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });

  async function create() {
    setBusy(true);
    try {
      const id = await backend.createActivity({ category, title, description, place, maxPeople, startsAt: startsAt.toISOString() });
      router.replace(`/activity/${id}`);
    } catch (e) {
      if (limitReason(e)) {
        router.back();
        router.push({ pathname: '/premium', params: { reason: 'activities' } });
      } else Alert.alert('Nicht gespeichert', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: Space.lg, gap: Space.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: Space.sm }}>
          <T variant="h3">Was habt ihr vor?</T>
          <View style={styles.wrap}>
            {ACTIVITY_CATEGORIES.map((x) => {
              const on = x.id === category;
              return (
                <Pressable key={x.id} onPress={() => setCategory(x.id)} accessibilityRole="button" accessibilityState={{ selected: on }}
                  style={[styles.cat, { backgroundColor: on ? Brand.primary : c.surface, borderColor: on ? Brand.primary : c.border }]}>
                  <Text style={{ fontSize: 22 }}>{x.emoji}</Text>
                  <Text style={{ color: on ? '#fff' : c.text, fontWeight: '700', fontSize: 13 }}>{x.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Field label="Titel" value={title} onChangeText={setTitle} placeholder="z. B. Sonntagswanderung zum Aussichtsturm" maxLength={80} />
        <Field label="Beschreibung (optional)" value={description} onChangeText={setDescription} multiline maxLength={500}
          placeholder="Was erwartet die anderen? Tempo, Kosten, was man mitbringen sollte …" style={{ minHeight: 90, textAlignVertical: 'top' }} />
        <Field label="Treffpunkt" value={place} onChangeText={setPlace} maxLength={80} placeholder="z. B. Marktplatz, vor dem Rathaus" />

        <View style={{ gap: Space.sm }}>
          <T variant="h3">Wann?</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {days.map((d, i) => {
              const on = i === day;
              return (
                <Pressable key={i} onPress={() => setDay(i)} accessibilityRole="button" accessibilityState={{ selected: on }}
                  style={[styles.day, { backgroundColor: on ? Brand.primary : c.surface, borderColor: on ? Brand.primary : c.border }]}>
                  <Text style={{ color: on ? '#fff' : c.text, fontWeight: '700' }}>{dayLabel(d, i)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.timeRow}>
            <Stepper label="Stunde" value={hour} set={setHour} min={0} max={23} format={(n) => `${String(n).padStart(2, '0')} Uhr`} />
            <View style={styles.minutes}>
              {MINUTES.map((m) => (
                <Pressable key={m} onPress={() => setMinute(m)} accessibilityRole="button" accessibilityState={{ selected: m === minute }}
                  style={[styles.minute, { backgroundColor: m === minute ? Brand.primary : c.surface }]}>
                  <Text style={{ color: m === minute ? '#fff' : c.text, fontWeight: '700' }}>:{String(m).padStart(2, '0')}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          {tooSoon && <T variant="small" style={{ color: Brand.pass }}>Dieser Zeitpunkt ist vorbei oder zu knapp – wähle mindestens 15 Minuten in der Zukunft.</T>}
        </View>

        <View style={{ gap: Space.sm }}>
          <T variant="h3">Wie viele Leute höchstens (mit dir)?</T>
          <Stepper label="Personen" value={maxPeople} set={setMaxPeople} min={2} max={30} />
        </View>

        <View style={[styles.note, { backgroundColor: c.surface }]}>
          <Ionicons name="shield-checkmark" size={18} color={Brand.text} />
          <T variant="small" muted style={{ flex: 1 }}>
            Deine Aktivität sehen Menschen in deiner Umgebung – egal welchen Alters. Wähle einen öffentlichen Treffpunkt. Deine genaue Adresse brauchst du nie anzugeben.
          </T>
        </View>

        <Button title="Aktivität veröffentlichen" icon="megaphone" loading={busy} disabled={!valid} onPress={create} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cat: { width: '23%', flexGrow: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1 },
  day: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.pill, borderWidth: 1 },
  timeRow: { flexDirection: 'row', gap: Space.md, alignItems: 'center', flexWrap: 'wrap' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Space.md, borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 6, alignSelf: 'flex-start' },
  stepBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  minutes: { flexDirection: 'row', gap: 6 },
  minute: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: Radius.pill },
  note: { flexDirection: 'row', gap: Space.md, padding: Space.lg, borderRadius: Radius.lg },
});
