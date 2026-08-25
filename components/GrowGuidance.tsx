import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { getGrowGuidance } from '@/lib/growGuidance';

interface Props {
  growTexts: string[];
}

/** Soft, dismissible suggestions shown after both partners reveal their Grow notes — never critical, always optional. */
export function GrowGuidance({ growTexts }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const suggestions = getGrowGuidance(growTexts);

  if (dismissed || suggestions.length === 0) return null;

  return (
    <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(200)} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="leaf-outline" size={16} color="#A8D8A8" />
          <Text style={styles.title}>A gentle way forward</Text>
        </View>
        <Pressable onPress={() => setDismissed(true)} hitSlop={10} style={styles.dismissBtn}>
          <Ionicons name="close" size={16} color="#7A6D98" />
        </Pressable>
      </View>
      <Text style={styles.intro}>A few small, no-pressure ideas — take what’s useful, leave the rest.</Text>
      <View style={styles.list}>
        {suggestions.map((s) => (
          <View key={s.id} style={styles.row}>
            <View style={styles.dot} />
            <Text style={styles.rowText}>{s.text}</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E1B3A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,216,168,0.18)',
    padding: 18,
    gap: 12,
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#A8D8A8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dismissBtn: { padding: 2 },
  intro: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#7A6D98',
    lineHeight: 18,
  },
  list: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#A8D8A8',
    marginTop: 7,
  },
  rowText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#E8E0FF',
    lineHeight: 20,
  },
});
