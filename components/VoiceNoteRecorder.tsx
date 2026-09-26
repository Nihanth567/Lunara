import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {
  RecordingPresets,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { VoiceNotePlayer } from '@/components/VoiceNotePlayer';
import { SpringPressable } from '@/components/SpringPressable';
import { formatDuration, VOICE_NOTE_MAX_SECONDS } from '@/lib/voiceNotes';
import { haptic } from '@/lib/haptics';
import { askWithReason } from '@/lib/permissions';
import { hitSlopFor, pressScale, radius } from '@/constants/tokens';
import { palette, tint } from '@/constants/colors';

interface Props {
  /** Existing recording for this card, if any. */
  value: string | null;
  /** Its length, if known — lets the player show a duration before it loads. */
  durationMs?: number | null;
  color: string;
  /**
   * Fires with the finished local file URI and its length; the parent uploads
   * and persists both. Throw to report a failed upload — the take is still on
   * disk, so this component keeps it and offers to try again.
   */
  onRecorded: (localUri: string, durationMs: number) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  /**
   * Turn the recording into text for the written line. Omit to hide the
   * affordance entirely — demo mode has no server to ask, so there is nothing
   * to offer there.
   *
   * The parent owns the whole effect (fetching the transcript, deciding what
   * to do with text the person has already written, and saying so if it comes
   * back empty). All this component contributes is the button and the spinner
   * while the promise is in flight.
   */
  onTranscribe?: () => Promise<void> | void;
  disabled?: boolean;
}

/**
 * Optional voice note attached to one ritual card: tap to record, tap to stop,
 * then a small player to preview it, with Re-record and remove.
 *
 * Recording is always optional and never gates the text — the ritual has to
 * stay a one-minute thing, so nothing here can block submitting.
 */
export function VoiceNoteRecorder({
  value,
  durationMs,
  color,
  onRecorded,
  onDelete,
  onTranscribe,
  disabled,
}: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const [busy, setBusy] = useState(false);
  const pulse = useSharedValue(0);
  const stoppingRef = useRef(false);
  const reduceMotion = useReducedMotion();

  const seconds = Math.floor(state.durationMillis / 1000);
  const recording = state.isRecording;

  useEffect(() => {
    // Under Reduce Motion the dot still says "recording" — lit and steady
    // rather than breathing, since the timer beside it already shows time
    // passing.
    if (reduceMotion) {
      pulse.value = recording ? 1 : 0;
      return;
    }
    pulse.value = recording
      ? withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true)
      : withTiming(0, { duration: 200 });
  }, [recording, pulse, reduceMotion]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.65,
    transform: [{ scale: 0.85 + pulse.value * 0.25 }],
  }));

  /**
   * Hand a finished take to the parent to upload and persist. If that fails,
   * the take is still on disk — so it is kept and offered again, rather than
   * asking someone to say the whole thing a second time. A previous take stays
   * in place until a new one has actually landed.
   */
  const save = useCallback(async (uri: string, recordedMs: number) => {
    setBusy(true);
    try {
      await onRecorded(uri, recordedMs);
      haptic.success();
    } catch {
      haptic.error();
      Alert.alert(
        'Voice note',
        'That recording didn’t upload — the connection may have dropped. Your written note is safe.',
        [
          { text: 'Discard', style: 'cancel' },
          { text: 'Try again', onPress: () => void save(uri, recordedMs) },
        ],
      );
    } finally {
      setBusy(false);
    }
  }, [onRecorded]);

  const stop = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    haptic.recordStop();
    setBusy(true);
    try {
      // Read the length *before* stopping — the recorder's own duration is
      // reset by `stop()`, and this is the only moment it is known without
      // loading the finished file back off disk.
      //
      // `useAudioRecorderState` polls at 250ms, so this can undercount by up
      // to a quarter of a second. That is invisible in a `m:ss` readout and
      // not worth a second source of truth to fix.
      const recordedMs = Math.round(state.durationMillis);
      await recorder.stop();
      const uri = recorder.uri;
      // Release the mic so playback isn't routed to the earpiece afterwards.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      // `save` handles its own failures; this catch is only the recorder's.
      if (uri) await save(uri, recordedMs);
    } catch {
      haptic.error();
      Alert.alert('Voice note', 'That recording didn’t save. Your written note is safe — feel free to try again.');
    } finally {
      stoppingRef.current = false;
      setBusy(false);
    }
  }, [recorder, save, state.durationMillis]);

  // Stop on our own at the cap rather than letting a note run indefinitely.
  useEffect(() => {
    if (recording && seconds >= VOICE_NOTE_MAX_SECONDS) void stop();
  }, [recording, seconds, stop]);

  const start = async () => {
    if (busy || disabled) return;
    /*
      Why, before the system asks. The first tap on the mic used to fire the
      iOS dialog cold, and a "Don't Allow" there is permanent — so the one
      sentence that makes the answer "yes" comes first, and "Not now" leaves
      the real prompt unspent. Once declined, Settings is the only way back,
      so that path offers the button rather than describing it.
    */
    const granted = await askWithReason({
      check: getRecordingPermissionsAsync,
      request: requestRecordingPermissionsAsync,
      title: 'Say it out loud?',
      reason: 'So your partner can hear your voice when you open tonight together.',
      allowLabel: 'Allow microphone',
      blocked: {
        title: 'Microphone is off',
        body: 'Turn on the microphone for Lunara in Settings to record. Writing works either way.',
      },
    });
    if (!granted) return;

    setBusy(true);
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      haptic.recordStart();
    } catch {
      haptic.error();
      Alert.alert('Voice note', 'Couldn’t start recording just now. Your written note is safe.');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Kept separate from `busy` so the row doesn't collapse into a spinner while
   * a transcript is being fetched — the player stays usable, and the person
   * can listen to the note while the words are on their way.
   */
  const [transcribing, setTranscribing] = useState(false);

  const transcribe = async () => {
    if (!onTranscribe || transcribing) return;
    setTranscribing(true);
    try {
      await onTranscribe();
    } finally {
      setTranscribing(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await onDelete();
    } catch {
      // Was a bare try/finally: a failed delete rejected into nothing and the
      // note just stayed, with no word as to why.
      haptic.error();
      Alert.alert('Voice note', 'That didn’t remove just now — the recording is still here. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  // `!busy` matters for re-records: on the server a new take overwrites the
  // same path, so a player left mounted through the upload would keep the old
  // audio it already loaded. Unmounting it until the save lands means the one
  // that comes back resolves a fresh URL for the new take.
  if (value && !recording && !busy) {
    return (
      <View style={styles.stack}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <VoiceNotePlayer source={value} durationMs={durationMs} color={color} compact />
          </View>
          {!disabled && (
            <SpringPressable
              onPress={remove}
              hitSlop={hitSlopFor(27)}
              scaleTo={pressScale.icon}
              style={styles.iconBtn}
              accessibilityLabel="Remove voice note"
            >
              <Ionicons name="trash-outline" size={15} color={palette.content[2]} />
            </SpringPressable>
          )}
        </View>

        {!disabled && (
          <View style={styles.actions}>
            {/* Records straight over the current take; it is replaced only once the new one saves. */}
            <SpringPressable onPress={start} style={styles.actionBtn} hitSlop={10} feedback="highlight">
              <Ionicons name="mic-outline" size={14} color={palette.content[2]} />
              <Text style={styles.actionText}>Re-record</Text>
            </SpringPressable>

            {/*
              Offered, never automatic. Transcribing on every stop would send a
              recording off the device for a feature most people won't want, and
              would spend someone's evening waiting on a network call they didn't
              ask for. It is one tap away for the people who do want to edit what
              they said.
            */}
            {onTranscribe && (
              <SpringPressable
                onPress={transcribe}
                disabled={transcribing}
                // Busy, not unavailable: it says "Listening back…" at full strength.
                dimWhenDisabled={false}
                style={styles.actionBtn}
                hitSlop={10}
                feedback="highlight"
                accessibilityState={{ busy: transcribing }}
              >
                {transcribing ? (
                  <ActivityIndicator size="small" color={palette.content[2]} />
                ) : (
                  <Ionicons name="text-outline" size={14} color={palette.content[2]} />
                )}
                <Text style={styles.actionText}>
                  {transcribing ? 'Listening back…' : 'Turn this into text'}
                </Text>
              </SpringPressable>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <SpringPressable
      onPress={recording ? stop : start}
      disabled={disabled || busy}
      // Busy shows its own "One moment…", and a disabled mic already greys
      // its icon and label below — neither wants the generic dim on top.
      dimWhenDisabled={false}
      // Start and stop fire their own, firmer haptics.
      haptic="none"
      accessibilityLabel={recording ? 'Stop recording' : 'Record a voice note'}
      accessibilityState={{ busy }}
      style={[
        styles.recordBtn,
        { borderColor: recording ? color + '55' : tint.cream(0.1) },
        recording && { backgroundColor: color + '12' },
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={color} />
      ) : recording ? (
        <Animated.View style={[styles.recDot, { backgroundColor: color }, dotStyle]} />
      ) : (
        <Ionicons name="mic" size={18} color={disabled ? palette.ink[4] : color} />
      )}
      <Text style={[styles.recordText, { color: disabled ? palette.ink[4] : recording ? color : palette.content[1] }]}>
        {recording
          ? `${formatDuration(seconds)} · tap to stop`
          : busy
            ? 'One moment…'
            : 'Or say it out loud'}
      </Text>
      {recording && (
        <Text style={styles.remaining}>{formatDuration(VOICE_NOTE_MAX_SECONDS - seconds)} left</Text>
      )}
    </SpringPressable>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 16, rowGap: 4 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 12,
    fontFamily: 'Nunito_600SemiBold',
    color: palette.content[2],
  },
  iconBtn: { padding: 6 },
  // A full-size control, not a footnote: speaking is as much a way to answer
  // as typing, so it gets a real 44pt target.
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    backgroundColor: tint.cream(0.03),
  },
  recDot: { width: 10, height: 10, borderRadius: radius.sm },
  recordText: { fontSize: 14, fontFamily: 'Nunito_700Bold' },
  remaining: {
    marginLeft: 'auto' as const,
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: palette.content[2],
  },
});
