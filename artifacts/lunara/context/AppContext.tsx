import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createCouple as createCoupleRequest,
  createSession,
  getCouple,
  getCoupleEntries,
  joinCouple as joinCoupleRequest,
  saveCoupleEntry,
  setAuthTokenGetter,
  type CoupleResponse,
  type SharedEntry,
} from '@workspace/api-client-react';
import {
  NotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
  scheduleNightlyReminder,
  cancelNightlyReminder,
  refreshNightlyReminder,
} from '@/services/notifications';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  birthday?: string;
  pronouns?: string;
}

export interface Couple {
  id: string;
  partnerName: string;
  startDate?: string;
  currentStreak: number;
  longestStreak: number;
  inviteCode: string;
  isDemoMode: boolean;
}

export interface DailyEntry {
  date: string; // YYYY-MM-DD
  // My answers
  grateful: string;
  cute: string;
  grow: string;
  submitted: boolean;
  // Partner answers
  partnerGrateful: string;
  partnerCute: string;
  partnerGrow: string;
  partnerSubmitted: boolean;
  // State
  revealed: boolean;
  myReaction?: string;
  partnerReaction?: string;
}

interface AppContextType {
  isLoading: boolean;
  onboardingComplete: boolean;
  whoPays: 'me' | 'partner' | 'later' | null;
  accountKey: string | null;
  user: User | null;
  couple: Couple | null;
  entries: DailyEntry[];
  todayEntry: DailyEntry | null;
  notificationSettings: NotificationSettings;

  completeOnboarding: () => Promise<void>;
  setWhoPays: (who: 'me' | 'partner' | 'later') => Promise<void>;
  setUser: (user: User, recoveryPhone?: string, backupCode?: string) => Promise<void>;
  signIn: (recoveryPhone: string, backupCode: string) => Promise<boolean>;
  setCouple: (couple: Couple) => Promise<void>;
  createCouple: () => Promise<Couple>;
  joinCouple: (inviteCode: string) => Promise<Couple>;
  refreshSharedState: () => Promise<void>;
  updateTodayEntry: (updates: Partial<DailyEntry>) => Promise<void>;
  submitTodayEntry: () => Promise<void>;
  revealTodayEntry: () => Promise<void>;
  setMyReaction: (reaction: string) => Promise<void>;
  resetOnboarding: () => Promise<void>;
  setNotificationSettings: (settings: NotificationSettings) => Promise<void>;
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEYS = {
  ONBOARDING: 'lunara_onboarding_v1',
  WHO_PAYS: 'lunara_who_pays_v1',
  USER: 'lunara_user_v1',
  ACCOUNT_KEY: 'lunara_account_key_v1',
  COUPLE: 'lunara_couple_v1',
  ENTRIES: 'lunara_entries_v1',
  SESSION_TOKEN: 'lunara_session_token_v1',
  NOTIFICATION_SETTINGS: 'lunara_notification_settings_v1',
};

setAuthTokenGetter(() => AsyncStorage.getItem(KEYS.SESSION_TOKEN));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function normalizeRecoveryPhone(value: string): string {
  return value.trim().replace(/\D/g, '');
}

function emptyEntry(date: string, isDemoMode = false): DailyEntry {
  return {
    date,
    grateful: '',
    cute: '',
    grow: '',
    submitted: false,
    partnerGrateful: isDemoMode ? DEMO_PARTNER_TODAY.partnerGrateful : '',
    partnerCute: isDemoMode ? DEMO_PARTNER_TODAY.partnerCute : '',
    partnerGrow: isDemoMode ? DEMO_PARTNER_TODAY.partnerGrow : '',
    partnerSubmitted: isDemoMode,
    revealed: false,
  };
}

function coupleFromResponse(response: CoupleResponse): Couple {
  return {
    id: response.id,
    partnerName: response.partnerName,
    startDate: response.startDate,
    currentStreak: response.currentStreak,
    longestStreak: response.longestStreak,
    inviteCode: response.inviteCode,
    isDemoMode: false,
  };
}

function isSameCouple(left: Couple | null, right: Couple): boolean {
  return left?.id === right.id
    && left.partnerName === right.partnerName
    && left.startDate === right.startDate
    && left.currentStreak === right.currentStreak
    && left.longestStreak === right.longestStreak
    && left.inviteCode === right.inviteCode
    && left.isDemoMode === right.isDemoMode;
}

function entryFromResponse(entry: SharedEntry, previous?: DailyEntry): DailyEntry {
  return {
    date: entry.date,
    grateful: entry.grateful,
    cute: entry.cute,
    grow: entry.grow,
    submitted: entry.submitted,
    partnerGrateful: entry.partnerGrateful,
    partnerCute: entry.partnerCute,
    partnerGrow: entry.partnerGrow,
    partnerSubmitted: entry.partnerSubmitted,
    revealed: previous?.revealed ?? entry.revealed,
    myReaction: entry.myReaction ?? previous?.myReaction,
    partnerReaction: entry.partnerReaction,
  };
}

// Demo partner responses for today
const DEMO_PARTNER_TODAY = {
  partnerGrateful: 'The way you light up when you talk about something you love',
  partnerCute: 'You got completely distracted by a dog you saw outside, and it was everything',
  partnerGrow: 'I would love for us to leave little handwritten notes for each other more often',
};

// 7 days of seed entries for demo mode
function generateDemoEntries(): DailyEntry[] {
  const content: Array<Omit<DailyEntry, 'date' | 'submitted' | 'partnerSubmitted' | 'revealed'>> = [
    {
      grateful: 'You made me laugh when I really needed it today',
      cute: 'The way you hummed while making coffee this morning',
      grow: 'I would love for us to put phones away during dinner',
      partnerGrateful: 'You always know when to give me space and when to pull me close',
      partnerCute: 'You fell asleep on the couch mid-sentence and looked so peaceful',
      partnerGrow: 'Let us try a short walk together every evening',
    },
    {
      grateful: 'How patient you were with me when I was stressed',
      cute: 'You saved me the last piece of chocolate without me asking',
      grow: 'I think we could communicate more openly about little frustrations',
      partnerGrateful: 'You remembered exactly how I take my tea without asking',
      partnerCute: 'You sent me that meme at exactly the right moment',
      partnerGrow: 'I would love if we planned one intentional date each week',
    },
    {
      grateful: 'Your encouragement helped me through a tough day',
      cute: 'You fixed my pillow without waking me up',
      grow: 'I feel most loved when we check in during busy days',
      partnerGrateful: 'You defended me in a conversation without me asking',
      partnerCute: 'You surprised me with my favorite song when I got home',
      partnerGrow: 'Let us be more curious about each other s day',
    },
    {
      grateful: 'You made me feel seen when I was feeling invisible',
      cute: 'The look you gave me across the room when nobody was watching',
      grow: 'I want us to learn something new together',
      partnerGrateful: 'You always make home feel like the softest place',
      partnerCute: 'You drew a tiny star on my hand when you thought I was asleep',
      partnerGrow: 'I would love for us to celebrate small wins more',
    },
    {
      grateful: 'How genuinely enthusiastic you are about my ideas',
      cute: 'You got so excited about something small today and it was beautiful',
      grow: 'I think we could be more gentle with each other in tense moments',
      partnerGrateful: 'You stayed up late just to keep me company',
      partnerCute: 'You made up a tiny song about our morning routine',
      partnerGrow: 'Let us speak up sooner when something feels off',
    },
    {
      grateful: 'You asked how I was feeling and actually waited for the answer',
      cute: 'The way you get excited when food arrives at a restaurant',
      grow: 'I feel closest to you when we have no agenda at all',
      partnerGrateful: 'You remember all my little preferences without me repeating them',
      partnerCute: 'You tried to teach me something you love and got so animated',
      partnerGrow: 'I want us to share more music with each other',
    },
    {
      grateful: 'You forgave me quickly today and that meant everything',
      cute: 'You waved at a dog through the window like it could see you',
      grow: 'I want to say I love you more often and mean it loudly',
      partnerGrateful: 'You are the first person I want to tell good news to',
      partnerCute: 'You organized something small just because you knew it would make me smile',
      partnerGrow: 'Let us plan our next little adventure together',
    },
  ];

  return content.map((c, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (i + 1));
    return {
      date: date.toISOString().split('T')[0],
      ...c,
      submitted: true,
      partnerSubmitted: true,
      revealed: true,
    };
  });
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [whoPays, setWhoPaysState] = useState<'me' | 'partner' | 'later' | null>(null);
  const [accountKey, setAccountKeyState] = useState<string | null>(null);
  const [recoveryPin, setRecoveryPin] = useState<string | null>(null);
  const [user, setUserState] = useState<User | null>(null);
  const [couple, setCoupleState] = useState<Couple | null>(null);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [notificationSettings, setNotificationSettingsState] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);

  const persistCouple = useCallback(async (next: Couple) => {
    await AsyncStorage.setItem(KEYS.COUPLE, JSON.stringify(next));
    setCoupleState((current) => (isSameCouple(current, next) ? current : next));
  }, []);

  const replaceEntry = useCallback(async (nextEntry: DailyEntry) => {
    setEntries((previous) => {
      const next = previous.some((entry) => entry.date === nextEntry.date)
        ? previous.map((entry) => (entry.date === nextEntry.date ? nextEntry : entry))
        : [...previous, nextEntry];
      AsyncStorage.setItem(KEYS.ENTRIES, JSON.stringify(next));
      return next;
    });
  }, []);

  const refreshSharedState = useCallback(async () => {
    if (!couple || !user || couple.isDemoMode) return;

    const [remoteCouple, remoteEntries] = await Promise.all([
      getCouple(couple.id),
      getCoupleEntries(couple.id),
    ]);
    const nextCouple = coupleFromResponse(remoteCouple);
    await persistCouple(nextCouple);
    setEntries((previous) => {
      const remoteByDate = new Map(remoteEntries.map((entry) => [entry.date, entry]));
      const synced = remoteEntries.map((entry) =>
        entryFromResponse(entry, previous.find((local) => local.date === entry.date)),
      );
      const unsyncedDrafts = previous.filter(
        (entry) => !entry.submitted && !remoteByDate.has(entry.date),
      );
      const next = [...synced, ...unsyncedDrafts];
      AsyncStorage.setItem(KEYS.ENTRIES, JSON.stringify(next));
      return next;
    });
  }, [couple, persistCouple, user]);

  const refreshReminderSchedule = useCallback(async () => {
    if (!notificationSettings.enabled) return;

    const entryForToday = entries.find((entry) => entry.date === getToday());
    if (entryForToday?.submitted) {
      await scheduleNightlyReminder(
        notificationSettings.reminderHour,
        notificationSettings.reminderMinute,
        { skipToday: true },
      );
      return;
    }

    await refreshNightlyReminder(
      notificationSettings.reminderHour,
      notificationSettings.reminderMinute,
    );
  }, [entries, notificationSettings]);

  // Load persisted state on mount
  useEffect(() => {
    (async () => {
      try {
        const [onboarding, pays, userJson, accountKeyJson, coupleJson, entriesJson, notifJson] = await Promise.all([
          AsyncStorage.getItem(KEYS.ONBOARDING),
          AsyncStorage.getItem(KEYS.WHO_PAYS),
          AsyncStorage.getItem(KEYS.USER),
          AsyncStorage.getItem(KEYS.ACCOUNT_KEY),
          AsyncStorage.getItem(KEYS.COUPLE),
          AsyncStorage.getItem(KEYS.ENTRIES),
          AsyncStorage.getItem(KEYS.NOTIFICATION_SETTINGS),
        ]);
        if (onboarding) setOnboardingComplete(true);
        if (pays) setWhoPaysState(pays as 'me' | 'partner' | 'later');
        if (userJson) setUserState(JSON.parse(userJson));
        if (accountKeyJson) setAccountKeyState(accountKeyJson);
        if (coupleJson) setCoupleState(JSON.parse(coupleJson));
        if (entriesJson) setEntries(JSON.parse(entriesJson));
        if (notifJson) setNotificationSettingsState(JSON.parse(notifJson));
      } catch (_) {
        // Ignore storage errors — app still works
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (isLoading || !couple || !user || couple.isDemoMode) return;
    refreshSharedState().catch(() => {
      // A cached entry is still usable if the network is temporarily unavailable.
    });
  }, [couple, isLoading, refreshSharedState, user]);

  useEffect(() => {
    if (isLoading) return;
    refreshReminderSchedule().catch(() => {
      // A previously scheduled reminder remains usable if the OS query fails.
    });
  }, [isLoading, refreshReminderSchedule]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshSharedState().catch(() => {
          // Keep the last synced view while offline.
        });
        refreshReminderSchedule().catch(() => {
          // Keep the existing scheduled reminders if the OS query fails.
        });
      }
    });
    return () => subscription.remove();
  }, [refreshReminderSchedule, refreshSharedState]);

  const todayEntry = entries.find((e) => e.date === getToday()) ?? null;

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(KEYS.ONBOARDING, 'true');
    setOnboardingComplete(true);
  }, []);

  const setWhoPays = useCallback(async (who: 'me' | 'partner' | 'later') => {
    await AsyncStorage.setItem(KEYS.WHO_PAYS, who);
    setWhoPaysState(who);
  }, []);

  const setUser = useCallback(async (u: User, recoveryPhone?: string, backupCode?: string) => {
    const nextAccountKey = normalizeRecoveryPhone(recoveryPhone ?? accountKey ?? '');
    if (nextAccountKey.length < 8) {
      throw new Error('Please enter a valid phone number so we can protect your memories.');
    }
    const nextRecoveryPin = backupCode ?? recoveryPin;
    if (!nextRecoveryPin || nextRecoveryPin.length < 6) {
      throw new Error('Create a backup code with at least 6 characters to protect your memories.');
    }

    const session = await createSession({
      accountKey: nextAccountKey,
      recoveryPin: nextRecoveryPin,
      userName: u.name,
      birthday: u.birthday,
      pronouns: u.pronouns,
    });
    const nextUser = {
      ...u,
      id: session.user.id,
      name: session.user.name,
      birthday: session.user.birthday,
      pronouns: session.user.pronouns,
    };
    await AsyncStorage.multiSet([
      [KEYS.ACCOUNT_KEY, nextAccountKey],
      [KEYS.SESSION_TOKEN, session.token],
      [KEYS.USER, JSON.stringify(nextUser)],
    ]);
    setAccountKeyState(nextAccountKey);
    setRecoveryPin(nextRecoveryPin);
    setUserState(nextUser);
  }, [accountKey, recoveryPin]);

  const signIn = useCallback(async (recoveryPhone: string, backupCode: string): Promise<boolean> => {
    const nextAccountKey = normalizeRecoveryPhone(recoveryPhone);
    if (nextAccountKey.length < 8) {
      throw new Error('Please enter a valid phone number.');
    }
    if (backupCode.length < 6) {
      throw new Error('Enter your backup code to restore your memories.');
    }

    const session = await createSession({ accountKey: nextAccountKey, recoveryPin: backupCode });
    const restoredUser: User = {
      id: session.user.id,
      name: session.user.name,
      birthday: session.user.birthday,
      pronouns: session.user.pronouns,
    };
    await AsyncStorage.multiSet([
      [KEYS.ACCOUNT_KEY, nextAccountKey],
      [KEYS.SESSION_TOKEN, session.token],
      [KEYS.USER, JSON.stringify(restoredUser)],
    ]);
    setAccountKeyState(nextAccountKey);
    setRecoveryPin(backupCode);
    setUserState(restoredUser);

    if (!session.couple) return false;

    const restoredCouple = coupleFromResponse(session.couple);
    const restoredEntries = await getCoupleEntries(restoredCouple.id);
    await AsyncStorage.multiSet([
      [KEYS.COUPLE, JSON.stringify(restoredCouple)],
      [KEYS.ENTRIES, JSON.stringify(restoredEntries)],
      [KEYS.ONBOARDING, 'true'],
    ]);
    setCoupleState(restoredCouple);
    setEntries(restoredEntries.map((entry) => entryFromResponse(entry)));
    setOnboardingComplete(true);
    return true;
  }, []);

  const ensureServerIdentity = useCallback(async (): Promise<User> => {
    if (!user) throw new Error('Set up your profile before connecting with a partner.');

    const token = await AsyncStorage.getItem(KEYS.SESSION_TOKEN);
    if (token) return user;

    const identity = normalizeRecoveryPhone(accountKey ?? '');
    if (identity.length < 8) {
      throw new Error('Add a phone number to protect your memories before pairing.');
    }
    const session = await createSession({
      accountKey: identity,
      recoveryPin: recoveryPin ?? '',
      userName: user.name,
      birthday: user.birthday,
      pronouns: user.pronouns,
    });
    const serverUser = { ...user, id: session.userId };
    await AsyncStorage.multiSet([
      [KEYS.SESSION_TOKEN, session.token],
      [KEYS.USER, JSON.stringify(serverUser)],
    ]);
    setUserState(serverUser);
    return serverUser;
  }, [accountKey, recoveryPin, user]);

  const setCouple = useCallback(
    async (c: Couple) => {
      await persistCouple(c);

      // Seed demo history when in demo mode
      if (c.isDemoMode) {
        const demo = generateDemoEntries();
        await AsyncStorage.setItem(KEYS.ENTRIES, JSON.stringify(demo));
        setEntries(demo);
      }
    },
    [persistCouple]
  );

  const createCouple = useCallback(async (): Promise<Couple> => {
    const serverUser = await ensureServerIdentity();
    const response = await createCoupleRequest({ userName: serverUser.name });
    const next = coupleFromResponse(response);
    await persistCouple(next);
    return next;
  }, [ensureServerIdentity, persistCouple]);

  const joinCouple = useCallback(async (inviteCode: string): Promise<Couple> => {
    const serverUser = await ensureServerIdentity();
    const response = await joinCoupleRequest({
      inviteCode: inviteCode.trim().toUpperCase(),
      userName: serverUser.name,
    });
    const next = coupleFromResponse(response);
    await persistCouple(next);
    return next;
  }, [ensureServerIdentity, persistCouple]);

  const updateTodayEntry = useCallback(
    async (updates: Partial<DailyEntry>) => {
      const today = getToday();
      const existing = entries.find((entry) => entry.date === today);
      const nextEntry = { ...(existing ?? emptyEntry(today, couple?.isDemoMode)), ...updates };
      await replaceEntry(nextEntry);

      if (couple && user && !couple.isDemoMode) {
        const remote = await saveCoupleEntry(couple.id, today, {
          grateful: nextEntry.grateful,
          cute: nextEntry.cute,
          grow: nextEntry.grow,
          submitted: nextEntry.submitted,
          reaction: nextEntry.myReaction,
        });
        await replaceEntry(entryFromResponse(remote, nextEntry));
      }
    },
    [couple, entries, replaceEntry, user]
  );

  const submitTodayEntry = useCallback(async () => {
    const today = getToday();
    const existing = entries.find((entry) => entry.date === today);
    const localEntry = { ...(existing ?? emptyEntry(today, couple?.isDemoMode)), submitted: true };
    await replaceEntry(localEntry);

    if (couple && user && !couple.isDemoMode) {
      const remote = await saveCoupleEntry(couple.id, today, {
        grateful: localEntry.grateful,
        cute: localEntry.cute,
        grow: localEntry.grow,
        submitted: true,
        reaction: localEntry.myReaction,
      });
      await replaceEntry(entryFromResponse(remote, localEntry));

      // The entry is saved, so clear tonight's reminder before refreshing
      // ancillary couple details that should not block this behavior.
      if (notificationSettings.enabled) {
        await scheduleNightlyReminder(
          notificationSettings.reminderHour,
          notificationSettings.reminderMinute,
          { skipToday: true },
        );
      } else {
        await cancelNightlyReminder();
      }

      try {
        const remoteCouple = await getCouple(couple.id);
        await persistCouple(coupleFromResponse(remoteCouple));
      } catch {
        // Saving the ritual and suppressing its reminder already succeeded.
      }
      return;
    }

    // Demo mode is intentionally local-only.
    if (couple && !existing?.submitted) {
      const newStreak = couple.currentStreak + 1;
      const updated = {
        ...couple,
        currentStreak: newStreak,
        longestStreak: Math.max(couple.longestStreak, newStreak),
      };
      await persistCouple(updated);
    }

    // Replacing the reminder window after a successful submission starts at
    // tomorrow, so the reminder cannot fire later tonight.
    if (notificationSettings.enabled) {
      await scheduleNightlyReminder(
        notificationSettings.reminderHour,
        notificationSettings.reminderMinute,
        { skipToday: true },
      );
    } else {
      await cancelNightlyReminder();
    }
  }, [couple, entries, notificationSettings, persistCouple, replaceEntry, user]);

  const revealTodayEntry = useCallback(async () => {
    const today = getToday();
    setEntries((prev) => {
      const next = prev.map((e) => (e.date === today ? { ...e, revealed: true } : e));
      AsyncStorage.setItem(KEYS.ENTRIES, JSON.stringify(next));
      return next;
    });
  }, []);

  const setMyReaction = useCallback(async (reaction: string) => {
    const today = getToday();
    const existing = entries.find((entry) => entry.date === today);
    if (!existing) return;
    const localEntry = { ...existing, myReaction: reaction };
    await replaceEntry(localEntry);

    if (couple && user && !couple.isDemoMode) {
      const remote = await saveCoupleEntry(couple.id, today, {
        grateful: localEntry.grateful,
        cute: localEntry.cute,
        grow: localEntry.grow,
        submitted: localEntry.submitted,
        reaction,
      });
      await replaceEntry({ ...entryFromResponse(remote, localEntry), myReaction: reaction });
    }
  }, [couple, entries, replaceEntry, user]);

  const setNotificationSettings = useCallback(async (settings: NotificationSettings) => {
    await AsyncStorage.setItem(KEYS.NOTIFICATION_SETTINGS, JSON.stringify(settings));
    setNotificationSettingsState(settings);
    if (settings.enabled) {
      await scheduleNightlyReminder(settings.reminderHour, settings.reminderMinute);
    } else {
      await cancelNightlyReminder();
    }
  }, []);

  const resetOnboarding = useCallback(async () => {
    await AsyncStorage.multiRemove(Object.values(KEYS));
    setOnboardingComplete(false);
    setWhoPaysState(null);
    setAccountKeyState(null);
    setRecoveryPin(null);
    setUserState(null);
    setCoupleState(null);
    setEntries([]);
    setNotificationSettingsState(DEFAULT_NOTIFICATION_SETTINGS);
    await cancelNightlyReminder();
  }, []);

  return (
    <AppContext.Provider
      value={{
        isLoading,
        onboardingComplete,
        whoPays,
        accountKey,
        user,
        couple,
        entries,
        todayEntry,
        notificationSettings,
        completeOnboarding,
        setWhoPays,
        setUser,
        signIn,
        setCouple,
        createCouple,
        joinCouple,
        refreshSharedState,
        updateTodayEntry,
        submitTodayEntry,
        revealTodayEntry,
        setMyReaction,
        resetOnboarding,
        setNotificationSettings,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
