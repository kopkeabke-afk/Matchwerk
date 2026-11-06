import { NativeTabs } from 'expo-router/native-tabs';
import { Platform } from 'react-native';

import { Brand, useTheme } from '@/constants/theme';

// web preview only: five tabs need tighter spacing to fit a phone-width top bar
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('mw-tabs')) {
  const st = document.createElement('style');
  st.id = 'mw-tabs';
  st.textContent = '[role="tablist"] [role="tab"]{padding:0 11px !important}';
  document.head.appendChild(st);
}

export default function TabsLayout() {
  const c = useTheme();
  // Keep the selected tab readable in both looks: on the web the label sits on the
  // indicator pill (so it is violet with white text); on Android only the icon sits on
  // the pill and the label stays on the bar background.
  const web = Platform.OS === 'web';
  const active = c.dark ? '#E4D2FA' : Brand.primary;
  // the web build shows the five tabs in one row at the top – a little smaller so they fit a phone
  const webSize = web ? { fontSize: '13px' as unknown as number } : {};
  return (
    <NativeTabs
      tintColor={web ? '#fff' : active}
      backgroundColor={c.background}
      indicatorColor={web ? Brand.primary : c.dark ? '#3B2754' : '#EDE3F7'}
      iconColor={{ default: c.textSecondary, selected: web ? '#fff' : active }}
      labelStyle={{ default: { color: c.textSecondary, ...webSize }, selected: { color: web ? '#fff' : active, ...webSize } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Entdecken</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'sparkles', selected: 'sparkles' }} md="auto_awesome" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="activities">
        <NativeTabs.Trigger.Label>Aktivitäten</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.3', selected: 'person.3.fill' }} md="groups" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="likes">
        <NativeTabs.Trigger.Label>Likes</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'heart', selected: 'heart.fill' }} md="favorite" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="matches">
        <NativeTabs.Trigger.Label>Chats</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }} md="chat" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Label>Profil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
