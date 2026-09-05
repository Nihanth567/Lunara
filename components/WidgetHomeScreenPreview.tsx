import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { radius, elevation } from '@/constants/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * A home screen with the Lunara widget on it, drawn rather than screenshotted.
 *
 * A JPEG would go stale the first time the widget's copy or palette moves, and
 * it can't be rendered at the right density for every device. This mirrors
 * `targets/widget/index.swift` in RN primitives instead — same gradient, same
 * "LUNARA" header, same streak-then-status hierarchy — so the two drift only if
 * someone edits one and not the other.
 *
 * Everything around the widget is deliberately anonymous: dimmed rounded
 * squares and blank label bars, never a recognisable third-party icon.
 */

const PHONE_WIDTH = Math.min(SCREEN_WIDTH - 96, 250);
// A cropped home screen, not a whole handset — the bottom is faded out, which
// buys the widget ~30% more size than a full phone at the same on-screen height.
const PHONE_HEIGHT = PHONE_WIDTH * 1.58;
const PAD = 14;
const GAP = 10;
const ICON = (PHONE_WIDTH - PAD * 2 - GAP * 3) / 4;
const WIDGET_SIZE = ICON * 2 + GAP;

/** The muted wallpaper icons. Hue only — no marks, no letters. */
const ICON_TINTS = [
  'rgba(195,177,225,0.16)',
  'rgba(255,154,139,0.14)',
  'rgba(168,216,168,0.13)',
  'rgba(255,214,165,0.13)',
  'rgba(255,255,255,0.10)',
  'rgba(195,177,225,0.11)',
  'rgba(255,154,139,0.10)',
  'rgba(255,255,255,0.13)',
];

function AppIcon({ tint }: { tint: string }) {
  return (
    <View style={styles.iconCell}>
      <View style={[styles.icon, { backgroundColor: tint }]} />
      <View style={styles.iconLabel} />
    </View>
  );
}

/** The widget itself — kept 1:1 with the SwiftUI view it advertises. */
function LunaraWidget() {
  return (
    <LinearGradient
      colors={['#0F0D29', '#29174D']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.widget}
    >
      <View style={styles.widgetHeader}>
        <Ionicons name="moon" size={13} color="#C3B1E1" />
        <Text style={styles.widgetBrand}>LUNARA</Text>
      </View>

      <View style={styles.widgetStreak}>
        <Text style={styles.widgetNumber}>12</Text>
        <Text style={styles.widgetCaption}>nights together</Text>
      </View>

      <Text style={styles.widgetStatus}>Ready to reveal 🌙</Text>
    </LinearGradient>
  );
}

export function WidgetHomeScreenPreview() {
  const float = useSharedValue(0);
  const glow = useSharedValue(0.3);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    float.value = withRepeat(
      withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    glow.value = withDelay(
      300,
      withRepeat(
        withTiming(0.6, { duration: 3600, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [float, glow, reduceMotion]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -4 + float.value * 8 }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <Animated.View
      style={[styles.wrap, floatStyle]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="A phone home screen with the Lunara widget on it, showing a twelve night streak and “Ready to reveal”."
    >
      <View style={styles.frame}>
        <LinearGradient
          colors={['#241B4D', '#3A2A6B', '#141127']}
          style={StyleSheet.absoluteFill}
        />

        {/* Status bar */}
        <View style={styles.statusBar}>
          <Text style={styles.statusTime}>9:41</Text>
          <View style={styles.statusIcons}>
            <Ionicons name="cellular" size={9} color="rgba(255,255,255,0.75)" />
            <Ionicons name="wifi" size={9} color="rgba(255,255,255,0.75)" />
            <Ionicons name="battery-full" size={11} color="rgba(255,255,255,0.75)" />
          </View>
        </View>

        {/* Widget + the icons it sits beside */}
        <View style={styles.topRow}>
          <Animated.View entering={FadeIn.delay(350).duration(700)}>
            <Animated.View style={[styles.widgetGlow, glowStyle]} />
            <LunaraWidget />
          </Animated.View>
          <View style={styles.topRowIcons}>
            {ICON_TINTS.slice(0, 4).map((tint, i) => (
              <AppIcon key={i} tint={tint} />
            ))}
          </View>
        </View>

        <View style={styles.iconRow}>
          {ICON_TINTS.slice(4, 8).map((tint, i) => (
            <AppIcon key={i} tint={tint} />
          ))}
        </View>

        {/* The home screen carries on past the crop */}
        <LinearGradient
          colors={['transparent', 'rgba(15,12,41,0.85)', '#0A0817']}
          style={styles.fade}
          pointerEvents="none"
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  frame: {
    width: PHONE_WIDTH,
    height: PHONE_HEIGHT,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    borderWidth: 3,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
    paddingHorizontal: PAD,
    backgroundColor: '#141127',
    ...elevation.overlay,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 18,
    paddingHorizontal: 4,
  },
  statusTime: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: 'rgba(255,255,255,0.85)',
  },
  statusIcons: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  topRow: { flexDirection: 'row', gap: GAP },
  topRowIcons: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    alignContent: 'space-between',
  },
  iconRow: { flexDirection: 'row', gap: GAP, marginTop: GAP + 6 },

  iconCell: { width: ICON, alignItems: 'center', gap: 5 },
  icon: {
    width: ICON,
    height: ICON,
    borderRadius: ICON * 0.28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  iconLabel: {
    width: ICON * 0.66,
    height: 3,
    borderRadius: radius.xs,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },

  widgetGlow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    backgroundColor: '#FF9A8B',
    shadowColor: '#FF9A8B',
    shadowOpacity: 1,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
    opacity: 0.3,
  },
  widget: {
    width: WIDGET_SIZE,
    height: WIDGET_SIZE,
    borderRadius: WIDGET_SIZE * 0.22,
    padding: 11,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  widgetHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  widgetBrand: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    letterSpacing: 1.1,
    color: '#C3B1E1',
  },
  widgetStreak: { gap: 1 },
  widgetNumber: {
    fontSize: 30,
    lineHeight: 34,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  widgetCaption: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#948BAC',
  },
  widgetStatus: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#F0C07A',
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: PHONE_HEIGHT * 0.22,
  },
});
