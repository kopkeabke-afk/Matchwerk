import { Image } from 'expo-image';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, Space, useTheme } from '@/constants/theme';
import type { LikeNote, Mode, Profile } from '@/lib/types';

import { SERIF } from './profile-view';
import { Button, Field, T } from './ui';

type Item = NonNullable<LikeNote['item']>;

/** Bottom sheet to react to one photo or answer, optionally with a comment. */
export function LikeSheet({ profile, item, mode = 'dating', busy, onSend, onClose }: {
  profile: Profile; item: Item | null; mode?: Mode; busy?: boolean;
  onSend: (note: LikeNote) => void; onClose: () => void;
}) {
  const c = useTheme();
  const [comment, setComment] = useState('');
  const photo = item?.kind === 'photo' ? profile.photos[item.index] : undefined;
  const prompt = item?.kind === 'prompt' ? profile.prompts[item.index] : undefined;
  const close = () => { setComment(''); onClose(); };

  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.backdrop, { backgroundColor: c.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: c.background }]}>
          <View style={[styles.handle, { backgroundColor: c.border }]} />
          <T variant="h3" style={{ textAlign: 'center' }}>
            {mode === 'friends' ? `${profile.name} anfragen` : `${profile.name} ein Like schicken`}
          </T>
          {photo && <Image source={photo} style={styles.photo} contentFit="cover" />}
          {prompt && (
            <View style={[styles.prompt, { backgroundColor: c.surface }]}>
              <T variant="small" muted>{prompt.question}</T>
              <Text style={{ fontFamily: SERIF, fontSize: 19, lineHeight: 26, color: c.text }}>{prompt.answer}</Text>
            </View>
          )}
          <Field value={comment} onChangeText={setComment} placeholder="Schreib etwas dazu – erhöht deine Chancen" maxLength={200} autoFocus multiline />
          <Button
            title={comment.trim() ? 'Mit Kommentar senden' : mode === 'friends' ? 'Anfrage senden' : 'Like senden'}
            icon={mode === 'friends' ? 'hand-left' : 'heart'}
            loading={busy}
            onPress={() => { onSend({ item: item!, comment: comment.trim() || undefined }); setComment(''); }}
          />
          <Button title="Abbrechen" variant="ghost" onPress={close} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Space.xl, gap: Space.md, paddingBottom: 40 },
  handle: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: Space.xs },
  photo: { width: 132, height: 165, borderRadius: Radius.lg, alignSelf: 'center', borderWidth: 3, borderColor: Brand.text },
  prompt: { padding: Space.lg, borderRadius: Radius.lg, gap: 6 },
});
