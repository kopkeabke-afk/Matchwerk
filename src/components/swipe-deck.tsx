import * as Haptics from 'expo-haptics';
import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Brand } from '@/constants/theme';
import type { Profile, SwipeAction } from '@/lib/types';
import type { Compatibility } from '@/lib/utils';

import { ProfileCard } from './profile-card';

export interface SwipeDeckHandle {
  swipe(action: SwipeAction): void;
}

interface Props {
  profiles: Profile[];
  compat: (p: Profile) => Compatibility;
  sparkId?: string;
  onSwipe: (p: Profile, action: SwipeAction) => void;
  onInfo: (p: Profile) => void;
}

const haptic = (a: SwipeAction) => {
  if (Platform.OS === 'web') return;
  if (a === 'pass') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};

export const SwipeDeck = forwardRef<SwipeDeckHandle, Props>(function SwipeDeck({ profiles, compat, sparkId, onSwipe, onInfo }, ref) {
  const { width, height } = useWindowDimensions();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const threshold = width * 0.28;
  const top = profiles[0];
  const next = profiles[1];

  const finish = (action: SwipeAction) => {
    haptic(action);
    if (top) onSwipe(top, action);
  };

  // reset the shared position once the next card is on top (avoids a flash of the old card)
  useEffect(() => {
    x.value = 0;
    y.value = 0;
  }, [top?.id, x, y]);

  const fly = (action: SwipeAction) => {
    'worklet';
    const tx = action === 'like' ? width * 1.5 : action === 'pass' ? -width * 1.5 : 0;
    const ty = action === 'superlike' ? -height : y.value;
    x.value = withTiming(tx, { duration: 260 });
    y.value = withTiming(ty, { duration: 260 }, (done) => {
      if (done) scheduleOnRN(finish, action);
    });
  };

  useImperativeHandle(ref, () => ({ swipe: (a) => fly(a) }));

  const pan = usePanGesture({
    enabled: !!top,
    onUpdate: (e) => {
      'worklet';
      x.value = e.translationX;
      y.value = e.translationY;
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY < -height * 0.18 && Math.abs(e.translationX) < threshold) fly('superlike');
      else if (e.translationX > threshold || e.velocityX > 900) fly('like');
      else if (e.translationX < -threshold || e.velocityX < -900) fly('pass');
      else {
        x.value = withSpring(0);
        y.value = withSpring(0);
      }
    },
  });

  const topStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${interpolate(x.value, [-width, width], [-14, 14])}deg` },
    ],
  }));
  const nextStyle = useAnimatedStyle(() => {
    const p = Math.min(1, (Math.abs(x.value) + Math.abs(y.value)) / threshold);
    return { transform: [{ scale: 0.94 + 0.06 * p }], opacity: 0.6 + 0.4 * p };
  });
  const likeStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [0, threshold], [0, 1], Extrapolation.CLAMP) }));
  const nopeStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [-threshold, 0], [1, 0], Extrapolation.CLAMP) }));
  const superStyle = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [-height * 0.18, 0], [1, 0], Extrapolation.CLAMP) }));

  return (
    <View style={{ flex: 1 }}>
      {next && (
        <Animated.View key={next.id} style={[StyleSheet.absoluteFill, nextStyle]} pointerEvents="none">
          <ProfileCard profile={next} compat={compat(next)} spark={next.id === sparkId} />
        </Animated.View>
      )}
      {top && (
        <GestureDetector gesture={pan}>
          <Animated.View key={top.id} style={[StyleSheet.absoluteFill, topStyle]}>
            <ProfileCard profile={top} compat={compat(top)} spark={top.id === sparkId} onInfo={() => onInfo(top)} />
            <Animated.View style={[styles.stamp, styles.like, likeStyle]} pointerEvents="none">
              <Text style={[styles.stampText, { color: Brand.like }]}>LIKE</Text>
            </Animated.View>
            <Animated.View style={[styles.stamp, styles.nope, nopeStyle]} pointerEvents="none">
              <Text style={[styles.stampText, { color: Brand.pass }]}>NOPE</Text>
            </Animated.View>
            <Animated.View style={[styles.stamp, styles.super, superStyle]} pointerEvents="none">
              <Text style={[styles.stampText, { color: Brand.super }]}>SUPER</Text>
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  stamp: { position: 'absolute', top: 50, borderWidth: 4, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 },
  stampText: { fontSize: 36, fontWeight: '900', letterSpacing: 2 },
  like: { left: 24, borderColor: Brand.like, transform: [{ rotate: '-18deg' }] },
  nope: { right: 24, borderColor: Brand.pass, transform: [{ rotate: '18deg' }] },
  super: { alignSelf: 'center', bottom: 200, top: undefined, borderColor: Brand.super },
});
