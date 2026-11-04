import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Field, T, type IconName } from '@/components/ui';
import { Radius, Space, useTheme } from '@/constants/theme';
import { backend } from '@/lib';
import { useSession } from '@/lib/session';
import { appleSignInAvailable, toE164 } from '@/lib/social-auth';

/** SMS costs money per message – off unless explicitly enabled. Apple sign-in only matters for an iOS release. */
const PHONE_LOGIN = process.env.EXPO_PUBLIC_ENABLE_PHONE_LOGIN === 'true';

type Stage = 'choose' | 'phone' | 'phone-code' | 'email' | 'email-code' | 'password';

function Provider({ icon, label, onPress, dark, busy }: { icon: IconName; label: string; onPress: () => void; dark?: boolean; busy?: boolean }) {
  const c = useTheme();
  const bg = dark ? (c.dark ? '#fff' : '#000') : c.surface;
  const fg = dark ? (c.dark ? '#000' : '#fff') : c.text;
  return (
    <Pressable
      onPress={busy ? undefined : onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.provider, { backgroundColor: bg, borderColor: c.border, opacity: busy ? 0.6 : pressed ? 0.85 : 1 }]}>
      <Ionicons name={icon} size={20} color={fg} />
      <Text style={[styles.providerText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export default function SignIn() {
  const { refresh } = useSession();
  const [stage, setStage] = useState<Stage>('choose');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [apple, setApple] = useState(false);
  const demo = backend.mode === 'demo';
  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());
  const e164 = toE164(phone);

  useEffect(() => {
    appleSignInAvailable().then(setApple);
  }, []);

  async function run(key: string, fn: () => Promise<unknown>, title = 'Anmeldung fehlgeschlagen') {
    setBusy(key);
    try {
      const res = await fn();
      if (res !== null && res !== undefined && key !== 'send') await refresh();
    } catch (e) {
      Alert.alert(title, (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const titles: Record<Stage, string> = {
    choose: 'Willkommen bei matchwerk',
    phone: 'Deine Handynummer',
    'phone-code': 'Code eingeben',
    email: 'Deine E-Mail',
    'email-code': 'Code eingeben',
    password: 'Mit Passwort anmelden',
  };
  const subtitles: Record<Stage, string> = {
    choose: 'Wähle, wie du dich anmelden möchtest. Neu hier? Dann wird dein Konto automatisch erstellt.',
    phone: 'Wir schicken dir einen Code per SMS. Deine Nummer ist für andere nie sichtbar.',
    'phone-code': `Wir haben dir einen 6-stelligen Code an ${e164 ?? phone} geschickt.`,
    email: 'Kein Passwort nötig – wir senden dir einen Anmeldecode.',
    'email-code': `Wir haben dir einen 6-stelligen Code an ${email} geschickt.`,
    password: 'Für Test-Konten (z. B. App-Prüfung).',
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: Space.xl, paddingTop: 60, gap: Space.lg }} keyboardShouldPersistTaps="handled">
          {stage !== 'choose' && (
            <Pressable onPress={() => { setStage('choose'); setCode(''); }} hitSlop={10} accessibilityLabel="Zurück zur Auswahl">
              <T muted>← Andere Anmeldemethode</T>
            </Pressable>
          )}
          <T variant="title">{titles[stage]}</T>
          <T muted>{subtitles[stage]}</T>
          {demo && (
            <Card>
              <T variant="small">🧪 Demo-Modus: Es ist kein Server verbunden. Jede Methode meldet dich sofort an, Codes sind beliebig.</T>
            </Card>
          )}

          {stage === 'choose' && (
            <View style={{ gap: Space.md }}>
              {apple && Platform.OS === 'ios' && (
                <Provider icon="logo-apple" label="Mit Apple anmelden" dark busy={busy === 'apple'}
                  onPress={() => run('apple', () => backend.signInWithApple())} />
              )}
              <Provider icon="logo-google" label="Mit Google fortfahren" busy={busy === 'google'}
                onPress={() => run('google', () => backend.signInWithGoogle())} />
              {PHONE_LOGIN && <Provider icon="call-outline" label="Mit Telefonnummer" onPress={() => setStage('phone')} />}
              <Provider icon="mail-outline" label="Mit E-Mail" onPress={() => setStage('email')} />
            </View>
          )}

          {stage === 'phone' && (
            <>
              <Field value={phone} onChangeText={setPhone} placeholder="0151 23456789" autoFocus
                keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" />
              <T variant="small" muted>{e164 ? `Wird gesendet an ${e164}` : 'Ohne Ländervorwahl nehmen wir +49 (Deutschland) an.'}</T>
              <Button title="Code per SMS senden" disabled={!e164} loading={busy === 'send'}
                onPress={() => run('send', async () => { await backend.sendPhoneCode(e164!); setStage('phone-code'); }, 'SMS konnte nicht gesendet werden')} />
            </>
          )}

          {(stage === 'phone-code' || stage === 'email-code') && (
            <>
              <Field value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} placeholder="123456"
                keyboardType="number-pad" autoFocus textContentType="oneTimeCode" autoComplete="one-time-code"
                style={{ fontSize: 28, letterSpacing: 8, textAlign: 'center' }} />
              <Button title="Bestätigen" disabled={!demo && code.length < 6} loading={busy === 'verify'}
                onPress={() => run('verify', () => stage === 'phone-code'
                  ? backend.verifyPhoneCode(e164!, code)
                  : backend.verifyLoginCode(email.trim().toLowerCase(), code), 'Code ungültig')} />
              <Button title="Code erneut senden" variant="ghost"
                onPress={() => run('send', () => stage === 'phone-code' ? backend.sendPhoneCode(e164!) : backend.sendLoginCode(email.trim().toLowerCase()))} />
            </>
          )}

          {stage === 'email' && (
            <>
              <Field value={email} onChangeText={setEmail} placeholder="du@beispiel.de" autoFocus
                keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
              <Button title="Code senden" disabled={!validEmail} loading={busy === 'send'}
                onPress={() => run('send', async () => { await backend.sendLoginCode(email.trim().toLowerCase()); setStage('email-code'); }, 'E-Mail konnte nicht gesendet werden')} />
              <Button title="Mit Passwort anmelden" variant="ghost" onPress={() => setStage('password')} />
            </>
          )}

          {stage === 'password' && (
            <>
              <Field value={email} onChangeText={setEmail} placeholder="du@beispiel.de" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
              <Field value={password} onChangeText={setPassword} placeholder="Passwort" secureTextEntry textContentType="password" autoComplete="password" />
              <Button title="Anmelden" disabled={!validEmail || !password} loading={busy === 'pw'}
                onPress={() => run('pw', () => backend.signInWithPassword(email.trim().toLowerCase(), password))} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  provider: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 15, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth },
  providerText: { fontSize: 16, fontWeight: '700' },
});
