import React from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Redirect, Tabs } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';
import * as Haptics from 'expo-haptics';
import { palette } from '@/constants/colors';
import { useApp } from '@/context/AppContext';
import { isPro } from '@/lib/entitlements';
import { hasStoreKey } from '@/lib/purchases';
import { resolveGate } from '@/lib/accessGate';

/**
 * iOS 26 renders this as the system Liquid Glass tab bar, which brings its own
 * selection capsule. Left unconfigured it used the system font and a default
 * grey-lavender pill — so the one piece of chrome on every screen was the one
 * piece that didn't belong to the product. Everything below is the tab bar
 * adopting Lunara's type and accent rather than the OS's.
 */
function NativeTabLayout() {
  return (
    <NativeTabs
      // Rose is the app's action colour everywhere else; the tab bar was the
      // only surface still selecting in blue.
      tintColor={palette.accent.glow}
      iconColor={{ default: 'rgba(247, 241, 232,0.45)', selected: palette.accent.glow }}
      indicatorColor="rgba(255, 184, 107,0.14)"
      labelStyle={{
        default: {
          fontFamily: 'PlusJakartaSans_500Medium',
          fontSize: 11,
          color: 'rgba(247, 241, 232,0.45)',
        },
        selected: {
          fontFamily: 'PlusJakartaSans_600SemiBold',
          fontSize: 11,
          color: palette.accent.glow,
        },
      }}
      // Lets the ritual breathe: the bar tucks away as you read down a screen
      // and comes back the moment you scroll up.
      minimizeBehavior="onScrollDown"
    >
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: 'moon.stars', selected: 'moon.stars.fill' }} />
        <Label>Tonight</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="list">
        <Icon sf={{ default: 'checklist', selected: 'checklist.checked' }} />
        <Label>List</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <Icon sf={{ default: 'heart.text.square', selected: 'heart.text.square.fill' }} />
        <Label>Moments</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} />
        <Label>Us</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenListeners={{
        tabPress: () => {
          Haptics.selectionAsync();
        },
      }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.accent.glow,
        tabBarInactiveTintColor: 'rgba(247, 241, 232,0.45)',
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : 'rgba(14, 11, 20,0.97)',
          borderTopWidth: 1,
          borderTopColor: 'rgba(247, 241, 232,0.08)',
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={60}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: 'rgba(14, 11, 20,0.97)' },
              ]}
            />
          ) : null,
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'PlusJakartaSans_600SemiBold',
          letterSpacing: 0.2,
          marginBottom: isIOS ? 0 : 4,
        },
        tabBarItemStyle: { paddingTop: 6 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tonight',
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView
                name={focused ? 'moon.stars.fill' : 'moon.stars'}
                tintColor={color}
                size={24}
              />
            ) : (
              <Feather name="moon" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="list"
        options={{
          title: 'List',
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView
                name={focused ? 'checklist.checked' : 'checklist'}
                tintColor={color}
                size={24}
              />
            ) : (
              <Feather name="check-square" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Moments',
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView
                name={focused ? 'heart.text.square.fill' : 'heart.text.square'}
                tintColor={color}
                size={24}
              />
            ) : (
              <Feather name="clock" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Us',
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView
                name={focused ? 'person.2.fill' : 'person.2'}
                tintColor={color}
                size={24}
              />
            ) : (
              <Feather name="heart" size={22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

/**
 * The entitlement guard, at the only chokepoint that catches everything.
 *
 * `app/index.tsx` routes people correctly on a cold start, but it is not the
 * only way into this group: `pairing` and `join/[code]` both `router.replace`
 * straight to `/(app)/` when they finish, and a deep link or a restored
 * navigation state can land here without passing through the index at all.
 * Guarding each of those call sites means the next one added is unguarded, so
 * the check lives here instead — this layout is the one thing every route in
 * the group has to render through.
 *
 * It returns `null` rather than a spinner while the answer is still unknown.
 * This layout is the tab bar; rendering it and then redirecting would flash the
 * chrome of a product the person has not unlocked. `app/index.tsx` owns the
 * loading state, and it is the screen they came from.
 */
function EntitlementGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, onboardingComplete, sessionExpired, couple, purchasesReady } = useApp();

  const destination = resolveGate({
    isLoading,
    sessionExpired,
    onboardingComplete,
    coupleEntitled: isPro(couple),
    purchasesReady,
    purchasesConfigurable: hasStoreKey(),
    isDev: __DEV__,
    isDemo: couple?.isDemoMode ?? false,
  });

  if (destination === 'loading') return null;
  if (destination === 'auth') return <Redirect href="/(onboarding)/auth" />;
  if (destination === 'onboarding') return <Redirect href="/(onboarding)/welcome" />;
  if (destination === 'paywall') return <Redirect href={'/(modals)/paywall?gate=1' as never} />;
  return <>{children}</>;
}

export default function AppLayout() {
  return (
    <EntitlementGuard>
      {isLiquidGlassAvailable() ? <NativeTabLayout /> : <ClassicTabLayout />}
    </EntitlementGuard>
  );
}
