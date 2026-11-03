import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { LEGAL } from '@/constants/legal';

export default function LegalDoc() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const d = LEGAL[doc] ?? LEGAL.terms;
  return (
    <ScrollView contentContainerStyle={{ padding: Space.lg, gap: Space.lg, paddingBottom: 60 }}>
      <Stack.Screen options={{ title: d.title }} />
      {d.sections.map(([h, body]) => (
        <View key={h} style={{ gap: 6 }}>
          <T variant="h3">{h}</T>
          <T muted>{body}</T>
        </View>
      ))}
    </ScrollView>
  );
}
