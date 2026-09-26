import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { SpringPressable } from '@/components/SpringPressable';
import { formatDuration, getVoiceNoteUrl } from '@/lib/voiceNotes';
import { radius } from '@/constants/tokens';
import { palette, tint } from '@/constants/colors';

interface Props {
  /** Storage path (or local file:// URI in demo mode). */
  source: string;
  /**
   * The recording's length, if the entry knows it.
   *
   * Resolving a signed URL and loading the audio takes a round trip, and until
   * it lands the player has nothing to say but "Voice note". Given this it can
   * show the real duration immediately and let the audio arrive underneath.
   * Null for notes recorded before the column existed — those fall back to the
   * old behaviour rather than to "0:00", which would be a lie about the
   * recording rather than an absence of information.
   */
  durationMs?: number | null;
  /** Accent for the card this note belongs to. */
  color: string;
  /** Whose voice this is — shown next to the control. */
  label?: string;
  compact?: boolean;
}

/**
 * Playback-only pill for a stored voice note. Resolves its own signed URL, so
 * callers just hand it the path off the entry.
 *
 * A note that can't be resolved says so, quietly, with a retry. It used to
 * render nothing at all, on the reasoning that a missing recording shouldn't
 * be the loudest thing on a screen of someone's words — which is right about
 * volume and wrong about silence: on a flaky connection a partner's voice note
 * simply vanished, and nobody ever knew there had been one to hear. The
 * failure row is one small line in the tertiary colour; it is still never the
 * loudest thing on the screen.
 */
export function VoiceNotePlayer({ source, durationMs, color, label, compact = false }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  /** Bumped by "Try again" to re-run the resolve below. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setFailed(false);
    getVoiceNoteUrl(source)
      .then((resolved) => {
        if (cancelled) return;
        if (resolved) setUrl(resolved);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => { cancelled = true; };
  }, [source, attempt]);

  const player = useAudioPlayer(url ?? null);
  const status = useAudioPlayerStatus(player);

  // Leave the listener at the start again rather than stranded at the end.
  useEffect(() => {
    if (status.didJustFinish) player.seekTo(0);
  }, [status.didJustFinish, player]);

  if (failed) {
    return (
      <SpringPressable
        onPress={() => setAttempt((n) => n + 1)}
        feedback="highlight"
        style={[styles.pill, compact && styles.pillCompact, styles.failedPill]}
        accessibilityLabel="Voice note didn’t load. Try again."
      >
        <Ionicons name="refresh" size={compact ? 13 : 15} color={palette.content[2]} />
        <Text style={[styles.text, styles.failedText]} numberOfLines={1}>
          {label ? `${label} · ` : ''}Didn’t load — tap to try again
        </Text>
      </SpringPressable>
    );
  }

  const loading = !url || !status.isLoaded;
  const elapsed = status.playing || status.currentTime > 0 ? status.currentTime : status.duration;

  /**
   * What the readout says. Once the audio is loaded it is authoritative; before
   * that, the stored length is better than a placeholder and better than a
   * zero. `formatDuration` takes seconds.
   */
  const readout =
    !loading
      ? formatDuration(elapsed)
      : typeof durationMs === 'number' && durationMs > 0
        ? formatDuration(durationMs / 1000)
        : 'Voice note';

  const toggle = () => {
    if (loading) return;
    if (status.playing) player.pause();
    else player.play();
  };

  return (
    <SpringPressable
      onPress={toggle}
      // Loading shows its own spinner at full strength; it isn't unavailable.
      disabled={loading}
      dimWhenDisabled={false}
      accessibilityLabel={`${label ? `${label}, ` : ''}${status.playing ? 'Pause' : 'Play'} voice note`}
      accessibilityState={{ busy: loading }}
      style={[styles.pill, compact && styles.pillCompact, { borderColor: color + '38' }]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Ionicons name={status.playing ? 'pause' : 'play'} size={compact ? 13 : 15} color={color} />
      )}
      <Text style={[styles.text, { color }]} numberOfLines={1}>
        {label ? `${label} · ` : ''}
        {readout}
      </Text>
      {!loading && status.duration > 0 && (
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              {
                backgroundColor: color,
                width: `${Math.min(100, (status.currentTime / status.duration) * 100)}%`,
              },
            ]}
          />
        </View>
      )}
    </SpringPressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    backgroundColor: tint.cream(0.04),
  },
  failedPill: { borderColor: tint.cream(0.1) },
  failedText: { color: palette.content[2] },
  pillCompact: { paddingVertical: 7, paddingHorizontal: 10 },
  text: {
    fontSize: 12,
    fontFamily: 'Nunito_600SemiBold',
  },
  track: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: tint.cream(0.08),
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 1.5 },
});
