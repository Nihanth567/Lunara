import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
  Modal,
  Linking,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
// SDK 54 ships the new File/Paths API on expo-file-system; the legacy subpath is
// the supported route for the string helpers and is what this one export needs.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { StarField } from '@/components/StarField';
import { MoonPhaseIndicator } from '@/components/MoonPhaseIndicator';
import { DateNightSection } from '@/components/DateNightSection';
import { SpringPressable } from '@/components/SpringPressable';
import { useApp } from '@/context/AppContext';
import { isPro, premiumSummary } from '@/lib/entitlements';
import { isPartnerJoined } from '@/lib/partner';
import { haptic } from '@/lib/haptics';
import { askWithReason } from '@/lib/permissions';
import { KEEPSAKE_QUESTIONS } from '@/constants/keepsakeQuestions';
import { pressScale, radius, scrim, spring } from '@/constants/tokens';
import { palette, tint } from '@/constants/colors';

/**
 * Apple's Standard Licensed Application End User License Agreement.
 *
 * The Terms screen already *mentioned* the standard EULA in prose, but nothing
 * in the app ever linked to it. Guideline 3.1.2 requires a functional link to
 * the licence terms from anywhere a subscription is sold, and a sentence naming
 * a document the user cannot open does not satisfy it.
 */
const APPLE_EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
import { formatReminderTime } from '@/services/notifications';

// ─── Time presets shown in the picker ─────────────────────────────────────────

const TIME_OPTIONS = [
  { label: '7:00 PM', hour: 19, minute: 0 },
  { label: '7:30 PM', hour: 19, minute: 30 },
  { label: '8:00 PM', hour: 20, minute: 0 },
  { label: '8:30 PM', hour: 20, minute: 30 },
  { label: '9:00 PM', hour: 21, minute: 0 },
  { label: '9:30 PM', hour: 21, minute: 30 },
  { label: '10:00 PM', hour: 22, minute: 0 },
  { label: '10:30 PM', hour: 22, minute: 30 },
  { label: '11:00 PM', hour: 23, minute: 0 },
];

// ─── SettingsRow ──────────────────────────────────────────────────────────────

function SettingsRow({
  icon,
  label,
  value,
  color,
  onPress,
  destructive,
}: {
  icon: string;
  label: string;
  value?: string;
  color?: string;
  onPress?: () => void;
  destructive?: boolean;
}) {
  return (
    // Highlight, not scale: a grouped row shrinking away from its neighbours
    // reads as the list coming apart. A row with nothing to do is inert.
    <SpringPressable
      style={styles.settingsRow}
      onPress={onPress}
      disabled={!onPress}
      dimWhenDisabled={false}
      feedback="highlight"
      accessibilityLabel={value ? `${label}, ${value}` : label}
    >
      <Ionicons
          name={icon as any}
          size={20}
          color={destructive ? palette.accent.danger : color || palette.content[1]}
          style={{ opacity: 0.7 }}
        />
      <Text style={[styles.settingsLabel, destructive && { color: palette.accent.danger }]}>
        {label}
      </Text>
      {value && <Text style={styles.settingsValue}>{value}</Text>}
      {onPress && <Ionicons name="chevron-forward" size={16} color={palette.content[2]} style={{ opacity: 0.7 }} />}
    </SpringPressable>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function daysAgo(dateStr?: string): number {
  if (!dateStr) return 0;
  const start = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── TimePicker modal ─────────────────────────────────────────────────────────

function TimePickerModal({
  visible,
  currentHour,
  currentMinute,
  onSelect,
  onClose,
}: {
  visible: boolean;
  currentHour: number;
  currentMinute: number;
  onSelect: (hour: number, minute: number) => void;
  onClose: () => void;
}) {
  return (
    /*
      The scrim fades and the sheet rises on a spring. `animationType="slide"`
      slid the whole modal up — dimmed backdrop included — so a grey slab rose
      from the bottom of the screen behind the sheet, which no native sheet
      does.
    */
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Neither the scrim nor the sheet is itself an accessibility element:
          as Pressables they defaulted to `accessible`, which folded every
          time option into one unreadable VoiceOver stop. */}
      <Pressable style={styles.modalBackdrop} onPress={onClose} accessible={false}>
        <Animated.View
          entering={SlideInDown.springify()
            .damping(spring.settle.damping)
            .stiffness(spring.settle.stiffness)}
        >
          <Pressable
            style={styles.modalSheet}
            onPress={(e) => e.stopPropagation()}
            accessible={false}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Reminder time</Text>
            <Text style={styles.modalSubtitle}>
              A notification fires at this time if you haven't shared your thoughts yet.
            </Text>
            {TIME_OPTIONS.map((opt) => {
              const selected = opt.hour === currentHour && opt.minute === currentMinute;
              return (
                <SpringPressable
                  key={opt.label}
                  style={[styles.timeOption, selected && styles.timeOptionSelected]}
                  feedback="highlight"
                  haptic="selection"
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => onSelect(opt.hour, opt.minute)}
                >
                  <Text style={[styles.timeOptionText, selected && styles.timeOptionTextSelected]}>
                    {opt.label}
                  </Text>
                  {selected && (
                    <Ionicons name="checkmark" size={18} color={palette.content[1]} />
                  )}
                </SpringPressable>
              );
            })}
            <SpringPressable style={styles.modalDismiss} onPress={onClose}>
              <Text style={styles.modalDismissText}>Done</Text>
            </SpringPressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, couple, entries, keepsakes, ritualDate, signOut, deleteAccount, exitDemoMode, notificationSettings, setNotificationSettings } = useApp();
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const proUser = isPro(couple);

  const goToPaywall = () => router.push('/(modals)/paywall');

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const bottomPad = insets.bottom + 90 + (Platform.OS === 'web' ? 34 : 0);

  const streak = couple?.currentStreak ?? 0;
  const longestStreak = couple?.longestStreak ?? 0;
  const daysTogetherCount = daysAgo(couple?.startDate);
  /**
   * Nights the two of you finished.
   *
   * This was `entries.filter((e) => e.revealed).length`, which counts a
   * different thing than its label claims. `revealed` is per-device on purpose
   * — opening the reveal is a thing you do, not a thing that happens to you —
   * so "nights shared" fell to zero on a reinstall, differed between the two
   * partners looking at the same history, and read 0 for a couple who had
   * submitted every night but never tapped through to the reveal screen.
   *
   * `togetherPoints` is the same number the fox's chip shows, derived from the
   * nights both partners actually submitted. One definition, and it is the
   * couple's rather than the phone's.
   */
  const totalEntries = couple?.togetherPoints ?? 0;

  const notifEnabled = notificationSettings.enabled;
  const reminderLabel = formatReminderTime(
    notificationSettings.reminderHour,
    notificationSettings.reminderMinute,
  );

  /**
   * Reminders on or off.
   *
   * Turning them on goes through `askWithReason`: one sentence of what will
   * actually be sent before the system dialog, and — if they were declined
   * before — a button straight to Settings. It used to say "please allow
   * notifications in your device Settings" and leave the person to find them.
   */
  const handleNotificationsToggle = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not supported', 'Push notifications are not available on web.');
      return;
    }

    try {
      if (notifEnabled) {
        await setNotificationSettings({ ...notificationSettings, enabled: false });
        return;
      }
      const granted = await askWithReason({
        check: Notifications.getPermissionsAsync,
        request: Notifications.requestPermissionsAsync,
        title: 'Turn on your reminder?',
        reason: `One gentle nudge around ${reminderLabel} if the night is slipping by and you haven’t written yet — never more than that.`,
        allowLabel: 'Turn it on',
        blocked: {
          title: 'Notifications are off for Lunara',
          body: 'Turn them on in Settings and your nightly reminder will start from tonight.',
        },
      });
      if (!granted) return;
      await setNotificationSettings({ ...notificationSettings, enabled: true });
      haptic.success();
    } catch {
      haptic.error();
      Alert.alert('That didn’t change', 'Your reminder setting didn’t save just now. Try again in a moment.');
    }
  };

  const handleTimeSelect = async (hour: number, minute: number) => {
    setTimePickerVisible(false);
    try {
      await setNotificationSettings({ ...notificationSettings, reminderHour: hour, reminderMinute: minute });
    } catch {
      haptic.error();
      Alert.alert('That didn’t change', 'Your reminder time didn’t save just now. Try again in a moment.');
    }
  };

  /**
   * Hand the couple their own words back, as a file they keep.
   *
   * This row existed with `onPress={() => {}}` — a dead control sitting in the
   * Privacy section promising an export that had never been built. A button
   * that does nothing is worse than an absent one: it reads as broken, and
   * here it also reads as a data-rights promise the app doesn't keep.
   */
  const handleExport = async () => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        profile: { name: user?.name ?? '', birthday: user?.birthday, pronouns: user?.pronouns },
        couple: couple
          ? { startDate: couple.startDate, currentStreak: couple.currentStreak, longestStreak: couple.longestStreak }
          : null,
        nights: entries.map((e) => ({
          date: e.date,
          grateful: e.grateful,
          cute: e.cute,
          grow: e.grow,
          submitted: e.submitted,
          myReaction: e.myReaction ?? null,
        })),
        keepsakes: keepsakes.map((k) => ({ question: k.questionKey, answer: k.myAnswer })),
      };
      const path = `${FileSystem.cacheDirectory}lunara-export.json`;
      await FileSystem.writeAsStringAsync(path, JSON.stringify(payload, null, 2));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'application/json', UTI: 'public.json' });
      } else {
        Alert.alert('Export ready', `Saved to ${path}`);
      }
    } catch {
      haptic.error();
      Alert.alert('Could not export', 'Something went wrong building your file. Please try again.');
    }
  };

  /**
   * Account deletion, in two deliberate steps.
   *
   * App Store guideline 5.1.1(v) requires this to exist and to be reachable
   * from inside the app; it does not require it to be a single careless tap.
   * The first alert states the consequence that people do not expect — that
   * their nights leave their partner's Moments too — and the second is the
   * point of no return.
   */
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete your account?',
      `This erases your profile, every night you’ve written, your voice notes and your keepsakes. Because your nights are shared, they also disappear from your partner’s Moments. This cannot be undone.${
        isPro(couple)
          ? '\n\nYour Lunara+ subscription is billed by Apple and is not cancelled by deleting your account. Cancel it in Settings → your name → Subscriptions, or you will keep being charged.'
          : ''
      }`,
      [
        { text: 'Keep my account', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'This is permanent',
              'There is no way to recover any of it afterwards. Delete your account?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete forever',
                  style: 'destructive',
                  onPress: async () => {
                    setDeleting(true);
                    try {
                      await deleteAccount();
                      router.replace('/(onboarding)/welcome');
                    } catch (error) {
                      haptic.error();
                      Alert.alert(
                        'Could not delete your account',
                        error instanceof Error && error.message
                          ? error.message
                          : 'Please try again in a moment.',
                      );
                    } finally {
                      setDeleting(false);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  /**
   * The demo's exit. Worth a confirmation because the practice nights are
   * genuinely discarded — but the copy has to make clear that what is being
   * thrown away is fake, so nobody reads this as losing real memories.
   */
  const handleExitDemo = () => {
    Alert.alert(
      'Leave demo mode?',
      'You’ve been trying Lunara with Luna, a simulated partner. Leaving discards those practice nights and takes you to pairing, where you can invite your real partner. Your account stays exactly as it is.',
      [
        { text: 'Stay in demo', style: 'cancel' },
        {
          text: 'Pair for real',
          onPress: async () => {
            try {
              await exitDemoMode();
              router.replace('/(onboarding)/pairing');
            } catch {
              haptic.error();
              Alert.alert('Still in the demo', 'Leaving didn’t work just now. Try again in a moment.');
            }
          },
        },
      ],
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign out',
      'Your memories are saved to your account and will be here when you sign back in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              router.replace('/(onboarding)/welcome');
            } catch {
              haptic.error();
              Alert.alert(
                'Couldn’t sign out',
                'Something got in the way just now. Check your connection and try once more.',
              );
            }
          },
        },
      ]
    );
  };

  return (
    <LinearGradient
      colors={[palette.ink[0], palette.ink[1], palette.ink[3], palette.ink[1], palette.ink[0]]}
      locations={[0, 0.3, 0.55, 0.8, 1]}
      style={styles.container}
    >
      <StarField />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 16, paddingBottom: bottomPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Us</Text>
        </View>

        {/* User card */}
           <Animated.View style={styles.userCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>
              {user?.name ? getInitials(user.name) : '?'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name ?? 'You'}</Text>
            {user?.pronouns && (
              <Text style={styles.userPronouns}>{user.pronouns}</Text>
            )}
            {couple?.isDemoMode && (
              <SpringPressable
                style={styles.demoBadge}
                onPress={handleExitDemo}
                accessibilityLabel="You are in demo mode. Leave the demo and pair with your real partner."
              >
                <Ionicons name="flask-outline" size={13} color={palette.content[1]} />
                <Text style={styles.demoBadgeText}>Demo · tap to pair for real</Text>
              </SpringPressable>
            )}
          </View>
          {couple && (
            <View style={styles.partnerBadge}>
              <Text style={styles.partnerLabel}>
                {isPartnerJoined(couple) ? 'with' : 'waiting for'}
              </Text>
              <Text style={styles.partnerName}>
                {isPartnerJoined(couple) ? couple.partnerName : 'your partner to join'}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Stats card */}
         <Animated.View style={styles.statsCard}>
          <View style={styles.statBlock}>
            <MoonPhaseIndicator streak={streak} size="large" />
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={styles.statNumber}>{totalEntries}</Text>
            <Text style={styles.statLabel}>nights shared</Text>
          </View>
          {daysTogetherCount > 0 && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statBlock}>
                <Text style={styles.statNumber}>{daysTogetherCount}</Text>
                <Text style={styles.statLabel}>days together</Text>
              </View>
            </>
          )}
        </Animated.View>

        {longestStreak > 0 && (
          <View style={styles.longestStreakRow}>
            <Ionicons name="trophy-outline" size={14} color={palette.accent.streak} />
            <Text style={styles.longestStreakText}>
              Longest streak: {longestStreak} {longestStreak === 1 ? 'night' : 'nights'}
            </Text>
          </View>
        )}

        {/* The weekly recap lives in Moments now ("Your week"), next to the
            nights it reads back, and shows the couple's words rather than
            counts of tips seen. */}

        {/* Keepsake card */}
        {couple && (
          <Animated.View style={styles.keepsakeCard}>
            <SpringPressable
              style={styles.keepsakeRow}
              scaleTo={pressScale.card}
              onPress={() => router.push('/keepsakes')}
            >
              <View style={styles.keepsakeIcon}>
                <Ionicons name="heart-outline" size={20} color={palette.accent.glow} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.keepsakeTitle}>Your Keepsake</Text>
                <Text style={styles.keepsakeSub}>
                  {keepsakes.filter((k) => k.mySubmitted).length} of {keepsakes.length || KEEPSAKE_QUESTIONS.length} answered
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={palette.content[2]} />
            </SpringPressable>
          </Animated.View>
        )}

        {/* Lunara+ card */}
         <Animated.View style={styles.premiumCard}>
           <View style={styles.premiumGradient}>
            <View style={styles.premiumContent}>
              <Ionicons name="sparkles" size={22} color={palette.accent.glow} />
              <View style={styles.premiumText}>
                <Text style={styles.premiumTitle}>
                  {couple?.isSubscribed ? 'Lunara+ — Active' : 'Lunara+'}
                </Text>
                {/* Named from lib/entitlements.ts, so this can't outlive a feature. */}
                <Text style={styles.premiumBody}>
                  {couple?.isSubscribed
                    ? `${premiumSummary().replace(/\.$/, '')} — all unlocked for both of you.`
                    : `${premiumSummary()} One subscription for both of you.`}
                </Text>
              </View>
            </View>
            {!couple?.isSubscribed && (
              <SpringPressable
                style={styles.premiumBtn}
                onPress={() => router.push('/(modals)/paywall')}
              >
                <Text style={styles.premiumBtnText}>Get Lunara+</Text>
              </SpringPressable>
            )}
           </View>
        </Animated.View>

        {/* Growth & Date Night Ideas */}
        {couple && (
          <DateNightSection isPro={proUser} onUnlock={goToPaywall} />
        )}

        {/* Settings */}
         <Animated.View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.settingsGroup}>
            <SettingsRow
              icon={notifEnabled ? 'notifications' : 'notifications-off-outline'}
              label="Notifications"
              value={notifEnabled ? 'On' : 'Off'}
              color={palette.content[1]}
              onPress={handleNotificationsToggle}
            />
            <SettingsRow
              icon="time-outline"
              label="Reminder time"
              value={reminderLabel}
              color={palette.content[1]}
              onPress={() => setTimePickerVisible(true)}
            />
          </View>
        </Animated.View>

         <Animated.View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <View style={styles.settingsGroup}>
            <SettingsRow
              icon="lock-closed-outline"
              label="Privacy Policy"
              color={palette.accent.success}
              onPress={() => router.push('/(modals)/privacy')}
            />
            <SettingsRow
              icon="document-text-outline"
              label="Terms of Service"
              color={palette.accent.success}
              onPress={() => router.push('/(modals)/terms')}
            />
            <SettingsRow
              icon="download-outline"
              label="Export my data"
              color={palette.accent.success}
              onPress={handleExport}
            />
            <SettingsRow
              icon="reader-outline"
              label="License Agreement (EULA)"
              color={palette.accent.success}
              onPress={() => void Linking.openURL(APPLE_EULA_URL).catch(() => {})}
            />
          </View>
        </Animated.View>

         <Animated.View style={styles.settingsSection}>
          <View style={styles.settingsGroup}>
            <SettingsRow
              icon="log-out-outline"
              label="Sign out"
              destructive
              onPress={handleSignOut}
            />
            <SettingsRow
              icon="trash-outline"
              label={deleting ? 'Deleting…' : 'Delete my account'}
              destructive
              onPress={deleting ? undefined : handleDeleteAccount}
            />
          </View>
        </Animated.View>

        <Text style={styles.versionText}>Lunara · v1.0.0</Text>
      </ScrollView>

      {/* Time picker modal */}
      <TimePickerModal
        visible={timePickerVisible}
        currentHour={notificationSettings.reminderHour}
        currentMinute={notificationSettings.reminderMinute}
        onSelect={handleTimeSelect}
        onClose={() => setTimePickerVisible(false)}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 22 },
  pageHeader: { marginBottom: 20 },
  pageTitle: {
    fontSize: 26,
    fontFamily: 'Nunito_800ExtraBold',
    color: palette.content[0],
  },

  // User card
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: palette.ink[2],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(247, 241, 232,0.08)',
    padding: 18,
    marginBottom: 12,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 184, 107,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 184, 107,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 22,
    fontFamily: 'Nunito_800ExtraBold',
    color: palette.accent.glow,
  },
  userInfo: { flex: 1, gap: 2 },
  userName: { fontSize: 16, fontFamily: 'Nunito_700Bold', color: palette.content[0] },
  userPronouns: { fontSize: 12, fontFamily: 'Nunito_400Regular', color: palette.content[1] },
  // Now a control rather than a label, so it carries an icon, real padding and
  // a tap target instead of being a 2pt-tall chip nobody would think to press.
  demoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(247, 241, 232,0.15)',
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    minHeight: 34,
    borderWidth: 1,
    borderColor: 'rgba(247, 241, 232,0.3)',
    marginTop: 8,
  },
  demoBadgeText: { fontSize: 12, fontFamily: 'Nunito_700Bold', color: palette.content[1] },
  partnerBadge: { alignItems: 'flex-end', gap: 1 },
  partnerLabel: { fontSize: 12, fontFamily: 'Nunito_400Regular', color: palette.content[2] },
  partnerName: { fontSize: 14, fontFamily: 'Nunito_700Bold', color: palette.content[1] },

  // Stats
  statsCard: {
    flexDirection: 'row',
    backgroundColor: palette.ink[2],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(247, 241, 232,0.08)',
    padding: 20,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statBlock: { alignItems: 'center', gap: 4, flex: 1 },
  statNumber: {
    fontSize: 34,
    fontFamily: 'Nunito_800ExtraBold',
    color: palette.content[0],
    lineHeight: 40,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: palette.content[2],
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 44,
    backgroundColor: 'rgba(247, 241, 232,0.08)',
  },
  longestStreakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  longestStreakText: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: palette.content[2],
  },

  // Keepsake
  keepsakeCard: { marginBottom: 12 },
  keepsakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: palette.ink[2],
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(247, 241, 232,0.08)',
    padding: 16,
  },
  keepsakeIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 184, 107,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keepsakeTitle: { fontSize: 14, fontFamily: 'Nunito_700Bold', color: palette.content[0] },
  keepsakeSub: { fontSize: 12, fontFamily: 'Nunito_400Regular', color: palette.content[2] },

  // Premium
  premiumCard: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(247, 241, 232,0.08)',
  },
  premiumGradient: { padding: 20, gap: 16, backgroundColor: palette.ink[2] },
  premiumContent: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  premiumText: { flex: 1, gap: 4 },
  premiumTitle: { fontSize: 16, fontFamily: 'Nunito_800ExtraBold', color: palette.content[0] },
  premiumBody: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: palette.content[1],
    lineHeight: 19,
  },
  premiumBtn: {
    backgroundColor: palette.accent.glow,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 107,0.35)',
  },
  premiumBtnText: {
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    color: palette.ink[0],
  },

  // Settings
  settingsSection: { marginBottom: 20, gap: 8 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Nunito_600SemiBold',
    color: palette.content[2],
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingLeft: 4,
  },
  settingsGroup: {
    backgroundColor: 'transparent',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: tint.cream(0.05),
  },
  settingsLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Nunito_600SemiBold',
    color: palette.content[0],
    letterSpacing: 0.1,
  },
  settingsValue: {
    fontSize: 14,
    fontFamily: 'Nunito_400Regular',
    color: palette.content[2],
  },
  versionText: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: palette.ink[4],
    textAlign: 'center',
    paddingTop: 8,
    paddingBottom: 16,
  },

  // Time picker modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: scrim,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: palette.ink[1],
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderCurve: 'continuous',
    paddingHorizontal: 22,
    paddingBottom: 40,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(247, 241, 232,0.08)',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(247, 241, 232,0.2)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: 'Nunito_800ExtraBold',
    color: palette.content[0],
    marginBottom: 6,
    letterSpacing: -0.4,
  },
  modalSubtitle: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: palette.content[2],
    lineHeight: 19,
    marginBottom: 20,
  },
  timeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    marginBottom: 4,
  },
  timeOptionSelected: {
    backgroundColor: 'rgba(247, 241, 232,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(247, 241, 232,0.25)',
  },
  timeOptionText: {
    fontSize: 16,
    fontFamily: 'Nunito_400Regular',
    color: palette.content[1],
  },
  timeOptionTextSelected: {
    fontFamily: 'Nunito_700Bold',
    color: palette.content[1],
  },
  modalDismiss: {
    marginTop: 12,
    backgroundColor: 'rgba(247, 241, 232,0.07)',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalDismissText: {
    fontSize: 16,
    fontFamily: 'Nunito_600SemiBold',
    color: palette.content[0],
  },
});
