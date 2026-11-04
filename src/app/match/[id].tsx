import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { Button } from '@/components/ui';
import { backend } from '@/lib';
import { useSession } from '@/lib/session';
import type { Match } from '@/lib/types';

export default function MatchCelebration() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile: me } = useSession();
  const [m, setM] = useState<Match | null>(null);

  useEffect(() => {
    backend.getMatch(id).then(setM).catch(() => {});
  }, [id]);

  return (
    <LinearGradient colors={['rgba(255,77,109,0.97)', 'rgba(255,138,61,0.97)']} style={styles.wrap}>
      <Animated.Text entering={ZoomIn.springify()} style={styles.title}>{m?.mode === 'friends' ? 'Neue Verbindung!' : 'Es ist ein Match!'}</Animated.Text>
      <Animated.Text entering={FadeInDown.delay(150)} style={styles.sub}>
        {m?.mode === 'friends'
          ? `Du und ${m.profile.name} wollt euch kennenlernen. Schlagt doch gleich etwas vor!`
          : `Du und ${m?.profile.name ?? '…'} mögt euch gegenseitig.`}
      </Animated.Text>
      <View style={styles.pics}>
        <Animated.View entering={FadeInDown.delay(200).springify()} style={[styles.pic, { transform: [{ rotate: '-8deg' }] }]}>
          <Image source={me?.photos[0]} style={StyleSheet.absoluteFill} contentFit="cover" />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(300).springify()} style={[styles.pic, { transform: [{ rotate: '8deg' }], marginLeft: -30 }]}>
          <Image source={m?.profile.photos[0]} style={StyleSheet.absoluteFill} contentFit="cover" />
        </Animated.View>
      </View>
      {m?.opener === 'them' && (
        <Text style={styles.hint}>{m.profile.name} macht den ersten Schritt – wir sagen dir Bescheid.</Text>
      )}
      <View style={{ gap: 12, alignSelf: 'stretch' }}>
        <Button
          title={m?.opener === 'them' ? 'Zum Chat' : 'Nachricht schreiben'}
          variant="secondary"
          icon="chatbubble-ellipses"
          onPress={() => { router.back(); router.push(`/chat/${id}`); }}
        />
        <Button title="Weiter entdecken" variant="ghost" onPress={() => router.back()} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  title: { color: '#fff', fontSize: 44, fontWeight: '900', textAlign: 'center', fontStyle: 'italic' },
  sub: { color: '#fff', fontSize: 17, textAlign: 'center' },
  pics: { flexDirection: 'row', marginVertical: 32 },
  pic: { width: 140, height: 190, borderRadius: 20, overflow: 'hidden', borderWidth: 4, borderColor: '#fff', backgroundColor: '#333' },
  hint: { color: '#fff', textAlign: 'center', fontWeight: '600' },
});
