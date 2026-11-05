import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/ui';
import { Brand } from '@/constants/theme';
import { backend } from '@/lib';
import { VOICE_MAX_SECONDS, type Message } from '@/lib/types';

export function formatSeconds(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** A stable pseudo waveform per message, so every bubble looks a bit different. */
export function waveform(seed: string, bars = 28): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return Array.from({ length: bars }, (_, i) => {
    h = Math.imul(h ^ (h >>> 13), 1274126177) + i;
    const r = ((h >>> 0) % 1000) / 1000;
    const envelope = Math.sin((Math.PI * (i + 1)) / (bars + 1));
    return 0.25 + 0.75 * Math.max(0.15, r * 0.6 + envelope * 0.4);
  });
}

function Wave({ seed, progress, color, dim }: { seed: string; progress: number; color: string; dim: string }) {
  const bars = useMemo(() => waveform(seed), [seed]);
  return (
    <View style={styles.wave}>
      {bars.map((b, i) => (
        <View
          key={i}
          style={[styles.bar, { height: 4 + b * 22, backgroundColor: i / bars.length < progress ? color : dim }]}
        />
      ))}
    </View>
  );
}

/** Bubble that plays a voice message. The audio url is only fetched on first tap. */
export function VoiceBubble({ message, mine, surface, text }: { message: Message; mine: boolean; surface: string; text: string }) {
  const player = useAudioPlayer(null, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const [loading, setLoading] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  async function toggle() {
    if (status.playing) {
      player.pause();
      return;
    }
    try {
      if (!loaded.current) {
        setLoading(true);
        const url = await backend.getVoiceUrl(message);
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
        player.replace({ uri: url });
        loaded.current = true;
      }
      player.play();
    } catch (e) {
      Alert.alert('Abspielen nicht möglich', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const total = (status.duration > 0 ? status.duration * 1000 : message.durationMs) ?? 0;
  const pos = status.currentTime * 1000;
  const progress = total > 0 ? Math.min(1, pos / total) : 0;
  const fg = mine ? '#fff' : Brand.primary;
  const dim = mine ? 'rgba(255,255,255,0.4)' : 'rgba(123,63,191,0.35)';

  return (
    <View style={[styles.bubble, mine ? styles.mine : [styles.theirs, { backgroundColor: surface }]]}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Sprachnachricht pausieren' : 'Sprachnachricht abspielen'}
        style={[styles.play, { backgroundColor: mine ? 'rgba(255,255,255,0.22)' : 'rgba(123,63,191,0.18)' }]}>
        {loading ? (
          <ActivityIndicator size="small" color={fg} />
        ) : (
          <Ionicons name={status.playing ? 'pause' : 'play'} size={20} color={fg} style={status.playing ? undefined : { marginLeft: 2 }} />
        )}
      </Pressable>
      <Wave seed={message.id} progress={progress} color={fg} dim={dim} />
      <T variant="small" style={{ color: mine ? '#fff' : text, fontVariant: ['tabular-nums'], minWidth: 34 }}>
        {formatSeconds(status.playing || pos > 0 ? pos : total)}
      </T>
    </View>
  );
}

type Recording = { recording: boolean; elapsedMs: number; start: () => Promise<void>; cancel: () => Promise<void>; finish: () => Promise<void> };

/** Records a voice message; `onDone` receives the local file uri and the duration. */
export function useVoiceRecording(onDone: (uri: string, durationMs: number) => void): Recording {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 200);
  const [recording, setRecording] = useState(false);
  const busy = useRef(false);

  async function start() {
    if (busy.current || recording) return;
    busy.current = true;
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Mikrofon nicht erlaubt', 'Erlaube Matchwerk den Zugriff aufs Mikrofon in den Einstellungen deines Handys, um Sprachnachrichten zu schicken.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (e) {
      Alert.alert('Aufnahme nicht möglich', (e as Error).message);
    } finally {
      busy.current = false;
    }
  }

  async function stop() {
    const duration = recorder.getStatus().durationMillis || state.durationMillis;
    await recorder.stop();
    setRecording(false);
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    return { uri: recorder.uri, duration };
  }

  async function cancel() {
    if (!recording) return;
    await stop().catch(() => setRecording(false));
  }

  async function finish() {
    if (!recording || busy.current) return;
    busy.current = true;
    try {
      const { uri, duration } = await stop();
      if (!uri) throw new Error('Die Aufnahme ist leer.');
      if (duration < 800) {
        Alert.alert('Zu kurz', 'Halte die Aufnahme etwas länger – mindestens eine Sekunde.');
        return;
      }
      onDone(uri, Math.min(duration, VOICE_MAX_SECONDS * 1000));
    } catch (e) {
      Alert.alert('Aufnahme fehlgeschlagen', (e as Error).message);
    } finally {
      busy.current = false;
    }
  }

  // stop automatically at the time limit
  const elapsedMs = recording ? state.durationMillis : 0;
  const finishRef = useRef(finish);
  useEffect(() => { finishRef.current = finish; });
  useEffect(() => {
    if (recording && elapsedMs >= VOICE_MAX_SECONDS * 1000) finishRef.current();
  }, [recording, elapsedMs]);

  return { recording, elapsedMs, start, cancel, finish };
}

/** The composer row while recording: pulsing dot, timer, discard and send. */
export function RecordingBar({ elapsedMs, onCancel, onSend, border, surface, text }: {
  elapsedMs: number; onCancel: () => void; onSend: () => void; border: string; surface: string; text: string;
}) {
  const left = VOICE_MAX_SECONDS * 1000 - elapsedMs;
  const blink = Math.floor(elapsedMs / 500) % 2 === 0;
  return (
    <>
      <Pressable onPress={onCancel} accessibilityLabel="Aufnahme verwerfen" hitSlop={8} style={[styles.round, { borderColor: border, borderWidth: 1 }]}>
        <Ionicons name="trash-outline" size={20} color="#E5484D" />
      </Pressable>
      <View style={[styles.recInfo, { backgroundColor: surface }]}>
        <View style={[styles.recDot, { opacity: blink ? 1 : 0.35 }]} />
        <T style={{ color: text, fontVariant: ['tabular-nums'], fontWeight: '600' }}>{formatSeconds(elapsedMs)}</T>
        <T variant="small" muted style={{ flex: 1 }} numberOfLines={1}>
          {left <= 10000 ? `noch ${Math.ceil(left / 1000)} s` : 'Aufnahme läuft …'}
        </T>
      </View>
      <Pressable onPress={onSend} accessibilityLabel="Sprachnachricht senden" style={[styles.round, { backgroundColor: Brand.primary }]}>
        <Ionicons name="arrow-up" size={22} color="#fff" />
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  bubble: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 8, paddingRight: 14, paddingVertical: 8, borderRadius: 22, width: 260, maxWidth: '85%' },
  mine: { alignSelf: 'flex-end', backgroundColor: Brand.primary, borderBottomRightRadius: 6 },
  theirs: { alignSelf: 'flex-start', borderBottomLeftRadius: 6 },
  play: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  wave: { flex: 1, height: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bar: { width: 3, borderRadius: 2 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  recInfo: { flex: 1, height: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5484D' },
});
