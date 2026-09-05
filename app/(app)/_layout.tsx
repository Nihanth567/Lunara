import React from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';
import * as Haptics from 'expo-haptics';

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
      // Coral is the app's action colour everywhere else; the tab bar was the
      // only surface still selecting in blue.
      tintColor="#FF9A8B"
      iconColor={{ default: 'rgba(248,245,255,0.45)', selected: '#FF9A8B' }}
      indicatorColor="rgba(255,154,139,0.14)"
      labelStyle={{
        default: {
          fontFamily: 'PlusJakartaSans_500Medium',
          fontSize: 11,
          color: 'rgba(248,245,255,0.45)',
        },
        selected: {
          fontFamily: 'PlusJakartaSans_600SemiBold',
          fontSize: 11,
          color: '#FF9A8B',
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
        tabBarActiveTintColor: '#FF9A8B',
        tabBarInactiveTintColor: 'rgba(248,245,255,0.45)',
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : 'rgba(15,12,41,0.97)',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.08)',
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
                { backgroundColor: 'rgba(15,12,41,0.97)' },
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

export default function AppLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
