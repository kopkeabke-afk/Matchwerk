import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Switch, View } from 'react-native';

import { PrefsEditor } from '@/components/traits-editors';
import { Button, Card, Chip, Field, T } from '@/components/ui';
import { Brand, Space, useTheme } from '@/constants/theme';
import { currentPlace, findPlace, getTravelPlace, setTravelPlace, type Place } from '@/lib/location';
import { useSession } from '@/lib/session';
import { SEEKING_LABELS, type Prefs } from '@/lib/traits';
import { INTENTION_EMOJI, INTENTION_LABELS, type Filters, type Gender, type Intention } from '@/lib/types';
import { DEFAULT_FILTERS, interestFrom, seekingOf } from '@/lib/utils';

function Stepper({ label, value, min, max, step = 1, suffix, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void;
}) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.surface, padding: Space.md, borderRadius: 14 }}>
      <T>{label}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.md }}>
        <Chip label="−" onPress={() => onChange(Math.max(min, value - step))} />
        <T variant="h3" style={{ minWidth: 64, textAlign: 'center' }}>{value}{suffix}</T>
        <Chip label="+" onPress={() => onChange(Math.min(max, value + step))} />
      </View>
    </View>
  );
}

const DISTANCES = [5, 10, 25, 40, 60, 80, 120, 200, 300];

export default function FiltersScreen() {
  const { filters, setFilters, profile, saveProfile, mode } = useSession();
  const [f, setF] = useState<Filters>(filters);
  const set = (patch: Partial<Filters>) => setF((x) => ({ ...x, ...patch }));
  const [travel, setTravel] = useState<Place | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  // whom to see and dealbreakers live on the profile (they work in both directions on the server)
  const [seeking, setSeeking] = useState<Gender[]>(profile ? seekingOf(profile) : ['woman', 'man', 'nonbinary']);
  const [prefs, setPrefs] = useState<Prefs>(profile?.prefs ?? {});

  useEffect(() => { getTravelPlace().then(setTravel); }, []);

  async function moveTo(place: Place, isTravel: boolean) {
    if (!profile) return;
    await saveProfile({ ...profile, lat: place.lat, lng: place.lng, city: place.city ?? profile.city });
    await setTravelPlace(isTravel ? place : null);
    setTravel(isTravel ? place : null);
  }

  async function searchPlace() {
    setBusy(true);
    try {
      const place = await findPlace(query);
      if (!place) return Alert.alert('Ort nicht gefunden', 'Versuch es mit dem Namen einer Stadt oder eines Dorfes, z. B. „Freiburg“ oder „Titisee-Neustadt“.');
      await moveTo(place, true);
      setQuery('');
    } finally {
      setBusy(false);
    }
  }

  async function backHome() {
    setBusy(true);
    try {
      const here = await currentPlace(true);
      if (!here) return Alert.alert('Standort nicht verfügbar', 'Bitte erlaube Matchwerk den Zugriff auf deinen ungefähren Standort in den Handy-Einstellungen.');
      await moveTo(here, false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: Space.lg, gap: Space.lg, paddingBottom: 60 }}>
      <T variant="h3">Standort</T>
      <Card style={{ gap: Space.sm }}>
        <T style={{ fontWeight: '700' }}>
          {travel ? `✈️ Unterwegs: ${travel.city ?? 'gewählter Ort'}` : `📍 ${profile?.city ?? 'Dein Standort'} (automatisch)`}
        </T>
        <T muted variant="small">
          {travel
            ? 'Du siehst Leute rund um diesen Ort. Andere sehen dich dort ebenfalls.'
            : 'Wir aktualisieren deinen ungefähren Standort beim Öffnen der App – auch wenn du gerade zu Besuch bist.'}
        </T>
        {travel && <Button title="Zurück zu meinem Standort" icon="navigate" variant="secondary" onPress={backHome} loading={busy} />}
      </Card>
      <T variant="small" muted>Reisemodus – anderen Ort wählen (kostenlos):</T>
      <View style={{ flexDirection: 'row', gap: Space.sm, alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Field value={query} onChangeText={setQuery} placeholder="Stadt oder Dorf, z. B. Freiburg" returnKeyType="search" onSubmitEditing={searchPlace} />
        </View>
        {busy ? <ActivityIndicator color={Brand.text} /> : <Chip label="Suchen" selected onPress={searchPlace} />}
      </View>

      <T variant="h3">Alter</T>
      <Stepper label="Mindestens" value={f.minAge} min={18} max={f.maxAge} onChange={(minAge) => set({ minAge })} />
      <Stepper label="Höchstens" value={f.maxAge} min={f.minAge} max={99} onChange={(maxAge) => set({ maxAge })} />
      <T variant="h3">Entfernung</T>
      <T muted variant="small">Wie weit darf die andere Person höchstens entfernt sein?</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {DISTANCES.map((km) => (
          <Chip key={km} label={`${km} km`} selected={f.maxDistanceKm === km} onPress={() => set({ maxDistanceKm: km })} />
        ))}
      </View>
      {!DISTANCES.includes(f.maxDistanceKm) && (
        <Stepper label="Eigener Wert" value={f.maxDistanceKm} min={1} max={300} step={5} suffix=" km" onChange={(maxDistanceKm) => set({ maxDistanceKm })} />
      )}
      {mode === 'dating' && <T variant="h3">Sucht (Dealbreaker)</T>}
      {mode === 'dating' && <T muted variant="small">Nichts ausgewählt = alle anzeigen.</T>}
      {mode === 'dating' && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(Object.keys(INTENTION_LABELS) as Intention[]).map((i) => {
          const on = f.intentions.includes(i);
          return (
            <Chip key={i} icon={INTENTION_EMOJI[i]} label={INTENTION_LABELS[i]} selected={on}
              onPress={() => set({ intentions: on ? f.intentions.filter((x) => x !== i) : [...f.intentions, i] })} />
          );
        })}
      </View>}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <T variant="h3">Nur verifizierte Profile</T>
          <T muted variant="small">Zeigt nur Profile mit blauem Haken.</T>
        </View>
        <Switch value={f.verifiedOnly} onValueChange={(verifiedOnly) => set({ verifiedOnly })} trackColor={{ true: Brand.primary }} />
      </View>
      {mode === 'dating' && (
        <View style={{ gap: Space.md }}>
          <T variant="h3">Wen möchtest du sehen?</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(['woman', 'man', 'nonbinary'] as Gender[]).map((g) => {
              const on = seeking.includes(g);
              return <Chip key={g} label={SEEKING_LABELS[g]} selected={on}
                onPress={() => { const next = on ? seeking.filter((x) => x !== g) : [...seeking, g]; if (next.length) setSeeking(next); }} />;
            })}
          </View>
          <PrefsEditor value={prefs} onChange={setPrefs} />
        </View>
      )}
      <Button title="Übernehmen" loading={busy} onPress={async () => {
        setFilters(f);
        if (profile && (JSON.stringify(prefs) !== JSON.stringify(profile.prefs ?? {}) || seeking.join() !== seekingOf(profile).join())) {
          setBusy(true);
          try {
            await saveProfile({ ...profile, prefs, seeking, interestedIn: interestFrom(seeking) });
          } catch (e) {
            Alert.alert('Nicht gespeichert', (e as Error).message);
          } finally {
            setBusy(false);
          }
        }
        if (router.canGoBack()) router.back(); else router.replace('/');
      }} />
      <Button title="Zurücksetzen" variant="ghost" onPress={() => setF(DEFAULT_FILTERS)} />
    </ScrollView>
  );
}
