import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Brand, Radius, Space, useTheme } from '@/constants/theme';
import { backend } from '@/lib';
import { ALL_INTERESTS, PROMPT_QUESTIONS, type Prompt } from '@/lib/types';

import { Button, Chip, Field, T } from './ui';

export const MAX_PHOTOS = 6;

export function PhotoGrid({ photos, onChange }: { photos: string[]; onChange: (p: string[]) => void }) {
  const c = useTheme();
  const [busy, setBusy] = useState<number | null>(null);

  async function add(slot: number) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Zugriff benötigt', 'Bitte erlaube den Zugriff auf deine Fotos in den Einstellungen.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.8 });
    if (res.canceled) return;
    setBusy(slot);
    try {
      const url = await backend.uploadPhoto(res.assets[0].uri);
      onChange([...photos, url]);
    } catch (e) {
      Alert.alert('Upload fehlgeschlagen', (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function remove(i: number) {
    onChange(photos.filter((_, j) => j !== i));
  }
  function makeMain(i: number) {
    onChange([photos[i], ...photos.filter((_, j) => j !== i)]);
  }

  return (
    <View style={styles.grid}>
      {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
        const uri = photos[i];
        return (
          <Pressable
            key={i}
            onPress={() => (uri ? (i > 0 ? makeMain(i) : undefined) : add(i))}
            accessibilityLabel={uri ? (i === 0 ? 'Hauptfoto' : 'Als Hauptfoto festlegen') : 'Foto hinzufügen'}
            style={[styles.slot, { backgroundColor: c.surface, borderColor: c.border }]}>
            {uri ? (
              <>
                <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" />
                {i === 0 && <View style={styles.main}><T variant="small" style={{ color: '#fff', fontWeight: '700' }}>Hauptfoto</T></View>}
                <Pressable onPress={() => remove(i)} hitSlop={8} style={styles.remove} accessibilityLabel="Foto entfernen">
                  <Ionicons name="close" size={16} color="#fff" />
                </Pressable>
              </>
            ) : busy === i ? (
              <ActivityIndicator color={Brand.primary} />
            ) : (
              <Ionicons name="add-circle" size={32} color={i === photos.length ? Brand.primary : c.textSecondary} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export function InterestPicker({ value, onChange, max = 10 }: { value: string[]; onChange: (v: string[]) => void; max?: number }) {
  return (
    <View style={styles.wrap}>
      {ALL_INTERESTS.map((i) => {
        const on = value.includes(i);
        return (
          <Chip
            key={i} label={i} selected={on}
            onPress={() => onChange(on ? value.filter((x) => x !== i) : value.length >= max ? value : [...value, i])}
          />
        );
      })}
    </View>
  );
}

export function PromptEditor({ value, onChange, max = 3 }: { value: Prompt[]; onChange: (v: Prompt[]) => void; max?: number }) {
  const c = useTheme();
  const [picking, setPicking] = useState<number | null>(null);
  const used = value.map((p) => p.question);

  return (
    <View style={{ gap: Space.md }}>
      {value.map((p, i) => (
        <View key={i} style={[styles.prompt, { backgroundColor: c.surface }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable style={{ flex: 1 }} onPress={() => setPicking(i)}>
              <T variant="small" style={{ fontWeight: '700', color: Brand.primary }}>{p.question} ▾</T>
            </Pressable>
            <Pressable onPress={() => onChange(value.filter((_, j) => j !== i))} hitSlop={8} accessibilityLabel="Prompt entfernen">
              <Ionicons name="trash-outline" size={18} color={c.textSecondary} />
            </Pressable>
          </View>
          <Field
            value={p.answer} multiline maxLength={150} placeholder="Deine Antwort …"
            onChangeText={(t) => onChange(value.map((x, j) => (j === i ? { ...x, answer: t } : x)))}
          />
        </View>
      ))}
      {value.length < max && (
        <Button title="Prompt hinzufügen" icon="add" variant="secondary" onPress={() => setPicking(-1)} />
      )}
      <Modal visible={picking !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPicking(null)}>
        <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: Space.xl, gap: Space.sm }}>
          <T variant="h2" style={{ marginBottom: Space.md }}>Wähle einen Prompt</T>
          {PROMPT_QUESTIONS.filter((q) => !used.includes(q) || (picking !== null && picking >= 0 && value[picking]?.question === q)).map((q) => (
            <Pressable
              key={q}
              onPress={() => {
                if (picking === -1) onChange([...value, { question: q, answer: '' }]);
                else if (picking !== null) onChange(value.map((x, j) => (j === picking ? { ...x, question: q } : x)));
                setPicking(null);
              }}
              style={[styles.option, { borderColor: c.border }]}>
              <T>{q}</T>
            </Pressable>
          ))}
          <Button title="Abbrechen" variant="ghost" onPress={() => setPicking(null)} />
        </ScrollView>
      </Modal>
    </View>
  );
}

/** Requests foreground location and returns rounded coordinates (≈1 km precision for privacy) + city. */
export async function locate(): Promise<{ lat: number; lng: number; city?: string } | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const lat = Math.round(pos.coords.latitude * 100) / 100;
  const lng = Math.round(pos.coords.longitude * 100) / 100;
  let city: string | undefined;
  try {
    const [g] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    city = g?.city ?? g?.subregion ?? undefined;
  } catch {}
  return { lat, lng, city };
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slot: {
    width: '31%', aspectRatio: 4 / 5, borderRadius: Radius.md, borderWidth: 1, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  main: { position: 'absolute', left: 6, bottom: 6, backgroundColor: Brand.primary, borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  remove: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prompt: { borderRadius: Radius.md, padding: Space.md, gap: Space.sm },
  option: { paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
});
