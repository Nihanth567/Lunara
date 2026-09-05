import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { VoiceNotePlayer } from '@/components/VoiceNotePlayer';
import { formatDuration, VOICE_NOTE_MAX_SECONDS } from '@/lib/voiceNotes';
import { radius } from '@/constants/tokens';

interface Props {
  /** Existing recording for this card, if any. */
  value: string | null;
  color: string;
  /** Fires with the finished local file URI; the parent uploads and persists. */
  onRecorded: (localUri: string) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  disabled?: boolean;
}

/**
 * Optional voice note attached to one ritual card: tap to record, tap to stop,
 * then a small player with a way to re-take.
 *
 * Recording is always optional and never gates the text — the ritual has to
 * stay a one-minute thing, so nothing here can block submitting.
 */
export function VoiceNoteRecorder({ value, color, onRecorded, onDelete, disabled }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const [busy, setBusy] = useState(false);
  const pulse = useSharedValue(0);
  const stoppingRef = useRef(false);

  const seconds = Math.floor(state.durationMillis / 1000);
  const recording = state.isRecording;

  useEffect(() => {
    pulse.value = recording
      ? withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true)
      : withTiming(0, { duration: 200 });
  }, [recording, pulse]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.65,
    transform: [{ scale: 0.85 + pulse.value * 0.25 }],
  }));

  const stop = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    setBusy(true);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      // Release the mic so playback isn't routed to the earpiece afterwards.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      if (uri) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await onRecorded(uri);
      }
    } catch {
      Alert.alert('Voice note', 'That recording didn’t save. Your written note is safe — feel free to try again.');
    } finally {
      stoppingRef.current = false;
      setBusy(false);
    }
  }, [onRecorded, recorder]);

  // Stop on our own at the cap rather than letting a note run indefinitely.
  useEffect(() => {
    if (recording && seconds >= VOICE_NOTE_MAX_SECONDS) void stop();
  }, [recording, seconds, stop]);

  const start = async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert(
          'Microphone access',
          'Lunara needs microphone access to record a voice note. You can turn it on in Settings — writing works either way.',
        );
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      Alert.alert('Voice note', 'Couldn’t start recording just now. Your written note is safe.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy(true);
    try {
      await onDelete();
    } finally {
      setBusy(false);
    }
  };

  if (value && !recording) {
    return (
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <VoiceNotePlayer source={value} color={color} compact />
        </View>
        {!disabled && (
          <Pressable onPress={remove} hitSlop={8} style={styles.iconBtn} disabled={busy}>
            <Ionicons name="trash-outline" size={15} color="#948BAC" />
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <Pressable
      onPress={recording ? stop : start}
      disabled={disabled || busy}
      style={[
        styles.recordBtn,
        { borderColor: recording ? color + '55' : 'rgba(255,255,255,0.10)' },
        recording && { backgroundColor: color + '12' },
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={color} />
      ) : recording ? (
        <Animated.View style={[styles.recDot, { backgroundColor: color }, dotStyle]} />
      ) : (
        <Ionicons name="mic-outline" size={15} color={disabled ? '#2E2A4C' : color} />
      )}
      <Text style={[styles.recordText, { color: disabled ? '#2E2A4C' : recording ? color : '#C0B8D4' }]}>
        {recording
          ? `${formatDuration(seconds)} · tap to stop`
          : busy
            ? 'One moment…'
            : 'Add a voice note'}
      </Text>
      {recording && (
        <Text style={styles.remaining}>{formatDuration(VOICE_NOTE_MAX_SECONDS - seconds)} left</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { padding: 6 },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  recDot: { width: 10, height: 10, borderRadius: radius.sm },
  recordText: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium' },
  remaining: {
    marginLeft: 'auto' as const,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#948BAC',
  },
});
