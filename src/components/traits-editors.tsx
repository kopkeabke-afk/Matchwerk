import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Brand, Radius, Space, useTheme } from '@/constants/theme';
import {
  GENDER_DETAILS, IMPORTANT_OPTIONS, LANGUAGE_OPTIONS, PET_OPTIONS, SEEKING_LABELS, SKILL_OPTIONS, TRAIT_FIELDS,
  type ImportantKey, type Prefs, type Traits,
} from '@/lib/traits';
import { GENDER_LABELS, type Gender, type Profile } from '@/lib/types';
import { interestFrom, seekingOf } from '@/lib/utils';

import { Chip, T } from './ui';

const GENDERS: Gender[] = ['woman', 'man', 'nonbinary'];

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <T variant="h3">{title}</T>
      {hint && <T variant="small" muted>{hint}</T>}
      <View style={styles.wrap}>{children}</View>
    </View>
  );
}

const toggle = <T,>(list: T[] | undefined, v: T) => (list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v]);

/** "Ich bin" + optional precise gender + whom I want to meet (several allowed). */
export function GenderEditor({ p, onChange }: { p: Profile; onChange: (patch: Partial<Profile>) => void }) {
  const seeking = seekingOf(p);
  const setSeeking = (s: Gender[]) => { if (s.length) onChange({ seeking: s, interestedIn: interestFrom(s) }); };
  return (
    <View style={{ gap: Space.lg }}>
      <Group title="Ich bin">
        {GENDERS.map((g) => <Chip key={g} label={GENDER_LABELS[g]} selected={p.gender === g} onPress={() => onChange({ gender: g })} />)}
      </Group>
      <Group title="Genauer (optional)" hint="Wird in deinem Profil angezeigt, wenn du etwas wählst.">
        {GENDER_DETAILS.map((d) => (
          <Chip key={d} label={d} selected={p.genderDetail === d} onPress={() => onChange({ genderDetail: p.genderDetail === d ? undefined : d })} />
        ))}
      </Group>
      <Group title="Beim Dating möchte ich kennenlernen" hint="Mehrfachauswahl möglich.">
        {GENDERS.map((g) => <Chip key={g} label={SEEKING_LABELS[g]} selected={seeking.includes(g)} onPress={() => setSeeking(toggle(seeking, g))} />)}
        <Chip label="Alle" selected={seeking.length === 3} onPress={() => setSeeking(GENDERS)} />
      </Group>
    </View>
  );
}

/** Eigenschaften: all optional, one tap per answer, tap again to clear. */
export function TraitsEditor({ value, onChange }: { value: Traits; onChange: (t: Traits) => void }) {
  const set = (patch: Partial<Traits>) => onChange({ ...value, ...patch });
  return (
    <View style={{ gap: Space.lg }}>
      {TRAIT_FIELDS.map((f) => (
        <Group key={f.key} title={f.title}>
          {f.options.map((o) => (
            <Chip key={o.id} label={o.label} selected={value[f.key] === o.id}
              onPress={() => set({ [f.key]: value[f.key] === o.id ? undefined : o.id } as Partial<Traits>)} />
          ))}
        </Group>
      ))}
      <Group title="Tiere">
        {PET_OPTIONS.map((o) => <Chip key={o.id} icon={o.emoji} label={o.label} selected={value.pets?.includes(o.id)} onPress={() => set({ pets: toggle(value.pets, o.id) })} />)}
      </Group>
      <Group title="Sprachen">
        {LANGUAGE_OPTIONS.map((l) => <Chip key={l} label={l} selected={value.languages?.includes(l)} onPress={() => set({ languages: toggle(value.languages, l) })} />)}
      </Group>
      <Group title="Das kann ich gut" hint="Bis zu 5 – gut für gemeinsame Aktivitäten.">
        {SKILL_OPTIONS.map((s) => (
          <Chip key={s} label={s} selected={value.skills?.includes(s)}
            onPress={() => { const next = toggle(value.skills, s); if (next.length <= 5) set({ skills: next }); }} />
        ))}
      </Group>
    </View>
  );
}

function Stepper({ label, value, onChange, min, max }: { label: string; value?: number; onChange: (n?: number) => void; min: number; max: number }) {
  const c = useTheme();
  return (
    <View style={[styles.stepper, { backgroundColor: c.surface }]}>
      <T style={{ flex: 1, fontWeight: '600' }}>{label}</T>
      <Pressable hitSlop={8} accessibilityLabel={`${label} kleiner`} onPress={() => onChange(value ? Math.max(min, value - 1) : undefined)} style={[styles.stepBtn, { borderColor: c.border }]}>
        <Ionicons name="remove" size={18} color={c.text} />
      </Pressable>
      <Pressable onPress={() => onChange(value ? undefined : label.startsWith('Mindestens') ? 160 : 190)} accessibilityLabel={`${label} ein- oder ausschalten`}>
        <T variant="h3" style={{ minWidth: 72, textAlign: 'center' }}>{value ? `${value} cm` : 'egal'}</T>
      </Pressable>
      <Pressable hitSlop={8} accessibilityLabel={`${label} größer`} onPress={() => onChange(value ? Math.min(max, value + 1) : label.startsWith('Mindestens') ? 160 : 190)} style={[styles.stepBtn, { borderColor: c.border }]}>
        <Ionicons name="add" size={18} color={c.text} />
      </Pressable>
    </View>
  );
}

/** Was dir wichtig ist: priorities for the score, plus a few dealbreakers that hide people. */
export function PrefsEditor({ value, onChange }: { value: Prefs; onChange: (p: Prefs) => void }) {
  const c = useTheme();
  const set = (patch: Partial<Prefs>) => onChange({ ...value, ...patch });
  return (
    <View style={{ gap: Space.lg }}>
      <Group title="Was ist dir besonders wichtig?" hint="Bis zu 5. Das zählt bei deinem Match-Score doppelt so viel.">
        {IMPORTANT_OPTIONS.map((o) => (
          <Chip key={o.id} label={o.label} selected={value.important?.includes(o.id)}
            onPress={() => { const next = toggle<ImportantKey>(value.important, o.id); if (next.length <= 5) set({ important: next }); }} />
        ))}
      </Group>
      <View style={{ gap: 8 }}>
        <T variant="h3">Wunschgröße (optional)</T>
        <Stepper label="Mindestens" value={value.heightMin} min={140} max={value.heightMax ?? 220} onChange={(heightMin) => set({ heightMin })} />
        <Stepper label="Höchstens" value={value.heightMax} min={value.heightMin ?? 140} max={220} onChange={(heightMax) => set({ heightMax })} />
      </View>
      <View style={{ gap: 8 }}>
        <T variant="h3">Ausschlusskriterien</T>
        <T variant="small" muted>Wer nicht passt, wird dir nicht angezeigt – und du ihnen auch nicht.</T>
        {([
          ['nonSmokerOnly', 'Nur Nichtraucher:innen'],
          ['kidsMatch', 'Nur mit passendem Kinderwunsch'],
        ] as const).map(([k, label]) => (
          <View key={k} style={[styles.switchRow, { backgroundColor: c.surface }]}>
            <Text style={{ color: c.text, fontSize: 16, flex: 1 }}>{label}</Text>
            <Switch value={!!value[k]} onValueChange={(v) => set({ [k]: v })} trackColor={{ true: Brand.primary }} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, borderRadius: Radius.lg, paddingHorizontal: Space.md, paddingVertical: 8 },
  stepBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.lg, paddingHorizontal: Space.lg, paddingVertical: 10 },
});
