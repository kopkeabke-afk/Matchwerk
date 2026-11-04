import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Field, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { backend } from '@/lib';
import { useSession } from '@/lib/session';

export default function SignIn() {
  const { refresh } = useSession();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const demo = backend.mode === 'demo';
  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());

  async function send() {
    setBusy(true);
    try {
      await backend.sendLoginCode(email.trim().toLowerCase());
      setSent(true);
    } catch (e) {
      Alert.alert('Fehler', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    try {
      await backend.verifyLoginCode(email.trim().toLowerCase(), code.trim());
      await refresh();
    } catch (e) {
      Alert.alert('Code ungültig', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function passwordLogin() {
    setBusy(true);
    try {
      await backend.signInWithPassword(email.trim().toLowerCase(), password);
      await refresh();
    } catch (e) {
      Alert.alert('Anmeldung fehlgeschlagen', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: Space.xl, paddingTop: 60, gap: Space.lg }} keyboardShouldPersistTaps="handled">
          <T variant="title">{sent ? 'Code eingeben' : usePassword ? 'Anmelden' : 'Wie lautet deine E-Mail?'}</T>
          <T muted>
            {sent
              ? `Wir haben dir einen 6-stelligen Code an ${email} geschickt.`
              : 'Kein Passwort nötig – wir senden dir einen Anmeldecode.'}
          </T>
          {demo && (
            <Card>
              <T variant="small">🧪 Demo-Modus: Es ist kein Server verbunden. Gib eine beliebige E-Mail und einen beliebigen Code ein.</T>
            </Card>
          )}
          {!sent ? (
            <>
              <Field
                value={email} onChangeText={setEmail} placeholder="du@beispiel.de" autoFocus
                keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress"
                onSubmitEditing={validEmail ? send : undefined} returnKeyType="next"
              />
              {usePassword ? (
                <>
                  <Field value={password} onChangeText={setPassword} placeholder="Passwort" secureTextEntry textContentType="password" autoComplete="password" onSubmitEditing={passwordLogin} />
                  <Button title="Anmelden" onPress={passwordLogin} loading={busy} disabled={!validEmail || !password} />
                </>
              ) : (
                <Button title="Code senden" onPress={send} loading={busy} disabled={!validEmail} />
              )}
              <View style={{ alignItems: 'center' }}>
                <Button
                  title={usePassword ? 'Stattdessen Code per E-Mail' : 'Mit Passwort anmelden'}
                  variant="ghost"
                  onPress={() => setUsePassword(!usePassword)}
                />
              </View>
            </>
          ) : (
            <>
              <Field
                value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} placeholder="123456"
                keyboardType="number-pad" autoFocus textContentType="oneTimeCode" autoComplete="one-time-code"
                style={{ fontSize: 28, letterSpacing: 8, textAlign: 'center' }}
              />
              <Button title="Bestätigen" onPress={verify} loading={busy} disabled={!demo && code.length < 6} />
              <View style={{ alignItems: 'center' }}>
                <Button title="Andere E-Mail verwenden" variant="ghost" onPress={() => { setSent(false); setCode(''); }} />
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
