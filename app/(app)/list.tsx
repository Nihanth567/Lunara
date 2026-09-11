import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { StarField } from '@/components/StarField';
import { useApp } from '@/context/AppContext';
import { partnerLabel, isPartnerJoined } from '@/lib/partner';
import { listProgress, type ListItem } from '@/lib/list';
import { gradients, palette } from '@/constants/colors';
import { radius, space, hitSlopFor } from '@/constants/tokens';
import { type as text } from '@/constants/typography';

/**
 * The shared list — the one screen in Lunara that is not private-until-mutual.
 *
 * The nightly ritual is built on not seeing your partner's words until you have
 * written your own. This is the opposite surface on purpose: everything here is
 * visible to both of you the moment it happens, so the app has somewhere to be
 * practical without diluting the thing that makes the ritual work.
 */

/** Author and check marks are drawn in the person's own colour, never a generic tick. */
function personColor(mine: boolean): string {
  return mine ? palette.partners.a : palette.partners.b;
}

function Checkbox({
  checked,
  color,
  size = 26,
}: {
  checked: boolean;
  color: string;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.checkbox,
        {
          width: size,
          height: size,
          borderRadius: size / 3,
          borderColor: checked ? color : palette.ink[4],
          backgroundColor: checked ? color : 'transparent',
        },
      ]}
    >
      {checked && (
        <Ionicons name="checkmark" size={size * 0.62} color={palette.ink[0]} />
      )}
    </View>
  );
}

function Row({
  item,
  partnerName,
  partnerPaired,
  onToggle,
  onDelete,
  onToggleShared,
}: {
  item: ListItem;
  partnerName: string;
  partnerPaired: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onToggleShared: () => void;
}) {
  // The "little hit of satisfaction": the row gives under the tap and springs
  // back. Small enough to feel like the surface responding rather than an
  // animation playing at you.
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handleToggle = () => {
    scale.value = withSequence(
      withTiming(0.97, { duration: 90 }),
      withTiming(1, { duration: 140 }),
    );
    // A completed item is worth more than a selection tick; a half-done shared
    // item is genuinely only half-done, so it stays at the lighter feedback.
    const willComplete = item.needsBoth && partnerPaired
      ? !item.checkedByMe && item.checkedByPartner
      : !item.checkedByMe;
    if (willComplete) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onToggle();
  };

  const waitingOnPartner = item.needsBoth && partnerPaired && item.checkedByMe && !item.checkedByPartner;
  const partnerWentFirst = item.needsBoth && partnerPaired && !item.checkedByMe && item.checkedByPartner;

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        style={[styles.row, item.done && styles.rowDone]}
        onPress={handleToggle}
        onLongPress={onDelete}
        delayLongPress={400}
      >
        <Checkbox checked={item.checkedByMe} color={personColor(true)} />

        <View style={styles.rowMain}>
          <Text
            style={[styles.rowTitle, item.done && styles.rowTitleDone]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {item.note.length > 0 && (
            <Text style={styles.rowNote} numberOfLines={2}>{item.note}</Text>
          )}

          <View style={styles.rowMeta}>
            {/* Who added it — the dot is the whole label. */}
            <View style={[styles.authorDot, { backgroundColor: personColor(item.createdByMe) }]} />
            <Text style={styles.rowMetaText}>
              {item.createdByMe ? 'You added this' : `${partnerName} added this`}
            </Text>

            {item.needsBoth && (
              <View style={styles.sharedTag}>
                <Ionicons name="people" size={11} color={palette.content[2]} />
                <Text style={styles.sharedTagText}>Both</Text>
              </View>
            )}
          </View>

          {/* "See in real time who did what." */}
          {waitingOnPartner && (
            <Text style={[styles.rowStatus, { color: palette.content[2] }]}>
              Done on your side — waiting for {partnerName}
            </Text>
          )}
          {partnerWentFirst && (
            <Text style={[styles.rowStatus, { color: palette.partners.b }]}>
              {partnerName} got this one — your turn
            </Text>
          )}
          {!item.needsBoth && item.checkedByPartner && !item.checkedByMe && (
            <Text style={[styles.rowStatus, { color: palette.partners.b }]}>
              {partnerName} did this
            </Text>
          )}
        </View>

        <Pressable
          onPress={onToggleShared}
          hitSlop={hitSlopFor(28)}
          style={styles.sharedToggle}
        >
          <Ionicons
            name={item.needsBoth ? 'people' : 'person-outline'}
            size={16}
            color={item.needsBoth ? palette.accent.rose : palette.ink[4]}
          />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

export default function ListScreen() {
  const insets = useSafeAreaInsets();
  const {
    listItems,
    addListItem,
    toggleListItem,
    updateListItem,
    deleteListItem,
    couple,
  } = useApp();

  const [draft, setDraft] = useState('');
  const [draftShared, setDraftShared] = useState(false);

  const partnerPaired = isPartnerJoined(couple);
  const partnerName = partnerLabel(couple, 'Your partner');
  const { done, total } = listProgress(listItems);

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const bottomPad = insets.bottom + 90 + (Platform.OS === 'web' ? 34 : 0);

  const submit = async () => {
    const value = draft.trim();
    if (!value) return;
    // Cleared before the await so a slow network can't eat a fast second entry.
    setDraft('');
    setDraftShared(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await addListItem(value, { needsBoth: draftShared });
  };

  const confirmDelete = (item: ListItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(item.title, 'Remove this from your list?', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { void deleteListItem(item.id); } },
    ]);
  };

  return (
    <LinearGradient
      colors={gradients.screen}
      locations={gradients.screenLocations}
      style={styles.container}
    >
      <StarField />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: topPad + 16, paddingBottom: bottomPad },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Our list</Text>
            <Text style={styles.subtitle}>
              {total === 0
                ? 'The everyday things, somewhere you can both see them'
                : `${done} of ${total} done${partnerPaired ? ` · with ${partnerName}` : ''}`}
            </Text>
          </View>

          {/* Composer sits at the top: adding is the most common action here,
              and burying it behind a floating button costs a tap every time. */}
          <View style={styles.composer}>
            <TextInput
              style={styles.composerInput}
              value={draft}
              onChangeText={setDraft}
              placeholder="Add something…"
              placeholderTextColor={palette.content[2]}
              returnKeyType="done"
              onSubmitEditing={submit}
              maxLength={140}
            />
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setDraftShared((v) => !v);
              }}
              hitSlop={hitSlopFor(32)}
              style={[styles.composerShared, draftShared && styles.composerSharedOn]}
            >
              <Ionicons
                name={draftShared ? 'people' : 'person-outline'}
                size={16}
                color={draftShared ? palette.ink[0] : palette.content[2]}
              />
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={draft.trim().length === 0}
              hitSlop={hitSlopFor(32)}
              style={[styles.composerAdd, draft.trim().length === 0 && styles.composerAddOff]}
            >
              <Ionicons name="arrow-up" size={18} color={palette.ink[0]} />
            </Pressable>
          </View>
          <Text style={styles.composerHint}>
            {draftShared
              ? 'Only done once you both tick it'
              : 'Either of you can check this off'}
          </Text>

          {listItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.emptyBody}>
                Groceries, the thing you keep forgetting to book, the trip you
                keep talking about. Add one and {partnerPaired ? partnerName : 'your partner'} sees
                it straight away.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {listItems.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  partnerName={partnerName}
                  partnerPaired={partnerPaired}
                  onToggle={() => { void toggleListItem(item.id); }}
                  onDelete={() => confirmDelete(item)}
                  onToggleShared={() => {
                    Haptics.selectionAsync();
                    void updateListItem(item.id, { needsBoth: !item.needsBoth });
                  }}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 22 },

  header: { marginBottom: space.xl, gap: space.xs },
  title: { ...text.title, color: palette.content[0] },
  subtitle: { ...text.callout, color: palette.content[2] },

  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: palette.ink[2],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(248, 241, 246, 0.08)',
    paddingLeft: space.lg,
    paddingRight: space.sm,
    paddingVertical: space.sm,
  },
  composerInput: {
    flex: 1,
    ...text.body,
    color: palette.content[0],
    paddingVertical: space.sm,
  },
  composerShared: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.ink[1],
  },
  composerSharedOn: { backgroundColor: palette.accent.rose },
  composerAdd: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accent.rose,
  },
  composerAddOff: { backgroundColor: palette.ink[3] },
  composerHint: {
    ...text.caption,
    color: palette.content[2],
    marginTop: space.sm,
    marginLeft: space.xs,
    marginBottom: space.xl,
  },

  list: { gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    backgroundColor: palette.ink[2],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(248, 241, 246, 0.08)',
    padding: space.lg,
  },
  // Completed items recede rather than disappear — the list is also a record
  // of what the two of you got through.
  rowDone: { opacity: 0.5 },
  rowMain: { flex: 1, gap: space.xs },
  rowTitle: { ...text.body, color: palette.content[0] },
  rowTitleDone: { textDecorationLine: 'line-through', color: palette.content[1] },
  rowNote: { ...text.callout, color: palette.content[1] },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xxs },
  rowMetaText: { ...text.caption, color: palette.content[2] },
  rowStatus: { ...text.caption, marginTop: space.xxs },
  authorDot: { width: 7, height: 7, borderRadius: radius.full },

  sharedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: palette.ink[1],
    borderRadius: radius.sm,
    borderCurve: 'continuous',
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  sharedTagText: { ...text.caption, color: palette.content[2] },
  sharedToggle: { paddingTop: 2 },

  checkbox: {
    borderWidth: 2,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyState: { alignItems: 'center', paddingTop: 48, gap: space.md },
  emptyTitle: { ...text.heading, color: palette.content[0] },
  emptyBody: {
    ...text.callout,
    color: palette.content[2],
    textAlign: 'center',
    lineHeight: 22,
  },
});
