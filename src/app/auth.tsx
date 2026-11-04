import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { Brand } from '@/constants/theme';

export default function Welcome() {
  return (
    <LinearGradient colors={[Brand.primary, Brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={styles.wrap}>
        <View style={styles.hero}>
          <Text style={styles.logo}>🔥</Text>
          <Text style={styles.brand}>matchwerk</Text>
          <Text style={styles.tagline}>Weniger swipen.{'\n'}Mehr echte Verbindungen.</Text>
        </View>
        <View style={{ gap: 14 }}>
          <View style={styles.usps}>
            {['Transparenter Match-Score – du siehst, warum ihr passt', 'Like ein Foto oder eine Antwort – mit Kommentar', 'Du entscheidest, wer zuerst schreibt', 'Verifizierte Profile & Sicherheits-Tools'].map((t) => (
              <Text key={t} style={styles.usp}>✓  {t}</Text>
            ))}
          </View>
          <Button
            title="Los geht's"
            variant="secondary"
            onPress={() => router.push('/sign-in')}
          />
          <Text style={styles.legal}>
            Mit dem Fortfahren akzeptierst du unsere{' '}
            <Link href="/legal/terms" style={styles.link}>Nutzungsbedingungen</Link> und die{' '}
            <Link href="/legal/privacy" style={styles.link}>Datenschutzerklärung</Link>. Mindestalter: 18 Jahre.
          </Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, justifyContent: 'space-between' },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  logo: { fontSize: 72 },
  brand: { color: '#fff', fontSize: 56, fontWeight: '900', letterSpacing: -2 },
  tagline: { color: '#fff', fontSize: 22, fontWeight: '600', textAlign: 'center', marginTop: 8, lineHeight: 30 },
  usps: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: 16, gap: 8 },
  usp: { color: '#fff', fontSize: 15, fontWeight: '500' },
  legal: { color: 'rgba(255,255,255,0.9)', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  link: { textDecorationLine: 'underline', fontWeight: '700', color: '#fff' },
});
