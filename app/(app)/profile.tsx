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
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StarField } from '@/components/StarField';
import { MoonPhaseIndicator } from '@/components/MoonPhaseIndicator';
import { useApp } from '@/context/AppContext';
import { KEEPSAKE_QUESTIONS } from '@/constants/keepsakeQuestions';
import {
  requestNotificationPermissions,
  getNotificationPermissionStatus,
  formatReminderTime,
} from '@/services/notifications';

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
    <Pressable
      style={styles.settingsRow}
      onPress={() => {
        if (onPress) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }
      }}
    >
      <Ionicons
          name={icon as any}
          size={18}
          color={destructive ? '#FF6B6B' : color || '#9B89C2'}
        />
      <Text style={[styles.settingsLabel, destructive && { color: '#FF6B6B' }]}>
        {label}
      </Text>
      {value && <Text style={styles.settingsValue}>{value}</Text>}
      {onPress && <Ionicons name="chevron-forward" size={16} color="#7A6D98" />}
    </Pressable>
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
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Reminder time</Text>
          <Text style={styles.modalSubtitle}>
            A notification fires at this time if you haven't shared your thoughts yet.
          </Text>
          {TIME_OPTIONS.map((opt) => {
            const selected = opt.hour === currentHour && opt.minute === currentMinute;
            return (
              <Pressable
                key={opt.label}
                style={[styles.timeOption, selected && styles.timeOptionSelected]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onSelect(opt.hour, opt.minute);
                }}
              >
                <Text style={[styles.timeOptionText, selected && styles.timeOptionTextSelected]}>
                  {opt.label}
                </Text>
                {selected && (
                  <Ionicons name="checkmark" size={18} color="#C3B1E1" />
                )}
              </Pressable>
            );
          })}
          <Pressable style={styles.modalDismiss} onPress={onClose}>
            <Text style={styles.modalDismissText}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, couple, entries, keepsakes, signOut, notificationSettings, setNotificationSettings } = useApp();
  const [timePickerVisible, setTimePickerVisible] = useState(false);

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);
  const bottomPad = insets.bottom + 90 + (Platform.OS === 'web' ? 34 : 0);

  const streak = couple?.currentStreak ?? 0;
  const longestStreak = couple?.longestStreak ?? 0;
  const daysTogetherCount = daysAgo(couple?.startDate);
  const totalEntries = entries.filter((e) => e.revealed).length;

  const notifEnabled = notificationSettings.enabled;
  const reminderLabel = formatReminderTime(
    notificationSettings.reminderHour,
    notificationSettings.reminderMinute,
  );

  // Toggle notifications on/off
  const handleNotificationsToggle = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not supported', 'Push notifications are not available on web.');
      return;
    }

    if (notifEnabled) {
      // Turn off
      await setNotificationSettings({ ...notificationSettings, enabled: false });
    } else {
      // Request permission then enable
      const status = await getNotificationPermissionStatus();
      if (status === 'denied') {
        Alert.alert(
          'Notifications blocked',
          'To enable reminders, please allow notifications for Lunara in your device Settings.',
        );
        return;
      }
      const granted = await requestNotificationPermissions();
      if (granted) {
        await setNotificationSettings({ ...notificationSettings, enabled: true });
      } else {
        Alert.alert(
          'Permission required',
          'Lunara needs notification permission to send you nightly reminders.',
        );
      }
    }
  };

  // Change the reminder time
  const handleTimeSelect = async (hour: number, minute: number) => {
    setTimePickerVisible(false);
    await setNotificationSettings({ ...notificationSettings, reminderHour: hour, reminderMinute: minute });
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
            await signOut();
            router.replace('/');
          },
        },
      ]
    );
  };

  return (
    <LinearGradient
      colors={['#0F0C29', '#1A1635', '#24243E', '#1A1635', '#0F0C29']}
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
              <View style={styles.demoBadge}>
                <Text style={styles.demoBadgeText}>Demo mode</Text>
              </View>
            )}
          </View>
          {couple && (
            <View style={styles.partnerBadge}>
              <Text style={styles.partnerLabel}>with</Text>
              <Text style={styles.partnerName}>{couple.partnerName}</Text>
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
            <Ionicons name="trophy-outline" size={14} color="#FFD6A5" />
            <Text style={styles.longestStreakText}>
              Longest streak: {longestStreak} {longestStreak === 1 ? 'night' : 'nights'}
            </Text>
          </View>
        )}

        {/* Keepsake card */}
        {couple && (
          <Animated.View style={styles.keepsakeCard}>
            <Pressable style={styles.keepsakeRow} onPress={() => router.push('/keepsakes')}>
              <View style={styles.keepsakeIcon}>
                <Ionicons name="heart-outline" size={20} color="#FF9A8B" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.keepsakeTitle}>Your Keepsake</Text>
                <Text style={styles.keepsakeSub}>
                  {keepsakes.filter((k) => k.mySubmitted).length} of {keepsakes.length || KEEPSAKE_QUESTIONS.length} answered
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#7A6D98" />
            </Pressable>
          </Animated.View>
        )}

        {/* Premium card */}
         <Animated.View style={styles.premiumCard}>
           <View style={styles.premiumGradient}>
            <View style={styles.premiumContent}>
              <Ionicons name="sparkles" size={22} color="#FF9A8B" />
              <View style={styles.premiumText}>
                <Text style={styles.premiumTitle}>
                  {couple?.isSubscribed ? 'Lunara Premium — Active' : 'Lunara Premium'}
                </Text>
                <Text style={styles.premiumBody}>
                  {couple?.isSubscribed
                    ? 'Unlimited history, photos, voice notes, and full widget customization are unlocked for both of you.'
                    : 'Unlimited history, photos, voice notes, and full widget customization. One subscription for both of you.'}
                </Text>
              </View>
            </View>
            {!couple?.isSubscribed && (
              <Pressable style={styles.premiumBtn} onPress={() => router.push('/paywall')}>
                <Text style={styles.premiumBtnText}>Upgrade — $4.99/mo</Text>
              </Pressable>
            )}
           </View>
        </Animated.View>

        {/* Settings */}
         <Animated.View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.settingsGroup}>
            <SettingsRow
              icon={notifEnabled ? 'notifications' : 'notifications-off-outline'}
              label="Notifications"
              value={notifEnabled ? 'On' : 'Off'}
              color="#C3B1E1"
              onPress={handleNotificationsToggle}
            />
            <SettingsRow
              icon="time-outline"
              label="Reminder time"
              value={reminderLabel}
              color="#C3B1E1"
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
              color="#A8D8A8"
              onPress={() => {}}
            />
            <SettingsRow
              icon="document-text-outline"
              label="Terms of Service"
              color="#A8D8A8"
              onPress={() => {}}
            />
            <SettingsRow
              icon="download-outline"
              label="Export my data"
              color="#A8D8A8"
              onPress={() => {}}
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
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    color: '#F8F5FF',
  },

  // User card
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#1E1B3A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    padding: 18,
    marginBottom: 12,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255,154,139,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,154,139,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#FF9A8B',
  },
  userInfo: { flex: 1, gap: 2 },
  userName: { fontSize: 17, fontFamily: 'Inter_600SemiBold', color: '#F8F5FF' },
  userPronouns: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#9B89C2' },
  demoBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(195,177,225,0.15)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(195,177,225,0.3)',
    marginTop: 2,
  },
  demoBadgeText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: '#C3B1E1' },
  partnerBadge: { alignItems: 'flex-end', gap: 1 },
  partnerLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#7A6D98' },
  partnerName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#C3B1E1' },

  // Stats
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#1E1B3A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    padding: 20,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statBlock: { alignItems: 'center', gap: 4, flex: 1 },
  statNumber: {
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
    color: '#F8F5FF',
    lineHeight: 40,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#7A6D98',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  longestStreakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  longestStreakText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#7A6D98',
  },

  // Keepsake
  keepsakeCard: { marginBottom: 12 },
  keepsakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#1E1B3A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,154,139,0.18)',
    padding: 16,
  },
  keepsakeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,154,139,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keepsakeTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#F8F5FF' },
  keepsakeSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#7A6D98' },

  // Premium
  premiumCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,154,139,0.2)',
  },
  premiumGradient: { padding: 20, gap: 16, backgroundColor: '#1E1B3A' },
  premiumContent: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  premiumText: { flex: 1, gap: 4 },
  premiumTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#F8F5FF' },
  premiumBody: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#9B89C2',
    lineHeight: 19,
  },
  premiumBtn: {
    backgroundColor: '#FF9A8B',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,154,139,0.35)',
  },
  premiumBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#1A0E18',
  },

  // Settings
  settingsSection: { marginBottom: 20, gap: 8 },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#7A6D98',
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
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  settingsLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#F8F5FF',
  },
  settingsValue: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#7A6D98',
  },
  versionText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#4A4166',
    textAlign: 'center',
    paddingTop: 8,
    paddingBottom: 16,
  },

  // Time picker modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#1A1635',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 22,
    paddingBottom: 40,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#F8F5FF',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: '#7A6D98',
    lineHeight: 19,
    marginBottom: 20,
  },
  timeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  timeOptionSelected: {
    backgroundColor: 'rgba(195,177,225,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(195,177,225,0.25)',
  },
  timeOptionText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#9B89C2',
  },
  timeOptionTextSelected: {
    fontFamily: 'Inter_600SemiBold',
    color: '#C3B1E1',
  },
  modalDismiss: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalDismissText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: '#F8F5FF',
  },
});
