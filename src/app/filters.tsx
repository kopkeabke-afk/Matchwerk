import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';

import { Button, Chip, T } from '@/components/ui';
import { Brand, Space, useTheme } from '@/constants/theme';
import { useSession } from '@/lib/session';
import { INTENTION_EMOJI, INTENTION_LABELS, type Filters, type Intention } from '@/lib/types';
import { DEFAULT_FILTERS } from '@/lib/utils';

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

export default function FiltersScreen() {
  const { filters, setFilters } = useSession();
  const [f, setF] = useState<Filters>(filters);
  const set = (patch: Partial<Filters>) => setF((x) => ({ ...x, ...patch }));

  return (
    <ScrollView contentContainerStyle={{ padding: Space.lg, gap: Space.lg, paddingBottom: 60 }}>
      <T variant="h3">Alter</T>
      <Stepper label="Mindestens" value={f.minAge} min={18} max={f.maxAge} onChange={(minAge) => set({ minAge })} />
      <Stepper label="Höchstens" value={f.maxAge} min={f.minAge} max={99} onChange={(maxAge) => set({ maxAge })} />
      <T variant="h3">Entfernung</T>
      <Stepper label="Maximal" value={f.maxDistanceKm} min={1} max={300} step={5} suffix=" km" onChange={(maxDistanceKm) => set({ maxDistanceKm })} />
      <T variant="h3">Sucht (Dealbreaker)</T>
      <T muted variant="small">Nichts ausgewählt = alle anzeigen.</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(Object.keys(INTENTION_LABELS) as Intention[]).map((i) => {
          const on = f.intentions.includes(i);
          return (
            <Chip key={i} icon={INTENTION_EMOJI[i]} label={INTENTION_LABELS[i]} selected={on}
              onPress={() => set({ intentions: on ? f.intentions.filter((x) => x !== i) : [...f.intentions, i] })} />
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <T variant="h3">Nur verifizierte Profile</T>
          <T muted variant="small">Zeigt nur Profile mit blauem Haken.</T>
        </View>
        <Switch value={f.verifiedOnly} onValueChange={(verifiedOnly) => set({ verifiedOnly })} trackColor={{ true: Brand.primary }} />
      </View>
      <Button title="Übernehmen" onPress={() => { setFilters(f); router.back(); }} />
      <Button title="Zurücksetzen" variant="ghost" onPress={() => setF(DEFAULT_FILTERS)} />
    </ScrollView>
  );
}
