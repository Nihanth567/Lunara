import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { formatDuration, getVoiceNoteUrl } from '@/lib/voiceNotes';
import { radius } from '@/constants/tokens';

interface Props {
  /** Storage path (or local file:// URI in demo mode). */
  source: string;
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
 * A note that can't be resolved renders nothing at all rather than an error
 * state — a missing recording should never be the loudest thing on a screen of
 * someone's words.
 */
export function VoiceNotePlayer({ source, color, label, compact = false }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

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
  }, [source]);

  const player = useAudioPlayer(url ?? null);
  const status = useAudioPlayerStatus(player);

  // Leave the listener at the start again rather than stranded at the end.
  useEffect(() => {
    if (status.didJustFinish) player.seekTo(0);
  }, [status.didJustFinish, player]);

  if (failed) return null;

  const loading = !url || !status.isLoaded;
  const elapsed = status.playing || status.currentTime > 0 ? status.currentTime : status.duration;

  const toggle = () => {
    if (loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (status.playing) player.pause();
    else player.play();
  };

  return (
    <Pressable
      onPress={toggle}
      style={[styles.pill, compact && styles.pillCompact, { borderColor: color + '38' }]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Ionicons name={status.playing ? 'pause' : 'play'} size={compact ? 13 : 15} color={color} />
      )}
      <Text style={[styles.text, { color }]} numberOfLines={1}>
        {label ? `${label} · ` : ''}
        {loading ? 'Voice note' : formatDuration(elapsed)}
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
    </Pressable>
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
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  pillCompact: { paddingVertical: 7, paddingHorizontal: 10 },
  text: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  track: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 1.5 },
});
