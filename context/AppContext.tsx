import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RealtimeChannel, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { configurePurchases, logOutPurchases } from '@/lib/purchases';
import { updateWidgetData } from '@/lib/widget';
import { KEEPSAKE_QUESTIONS } from '@/constants/keepsakeQuestions';
import {
  NotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
  scheduleNightlyReminder,
  cancelNightlyReminder,
  refreshNightlyReminder,
  registerForPushNotificationsAsync,
} from '@/services/notifications';

const STREAK_MILESTONES = [7, 14, 30, 60, 100];

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
  isSubscribed: boolean;
}

export interface DailyEntry {
  date: string; // YYYY-MM-DD
  grateful: string;
  cute: string;
  grow: string;
  submitted: boolean;
  partnerGrateful: string;
  partnerCute: string;
  partnerGrow: string;
  partnerSubmitted: boolean;
  revealed: boolean;
  myReaction?: string;
  partnerReaction?: string;
}

interface EntryRow {
  couple_id: string;
  date: string;
  user_id: string;
  grateful: string;
  cute: string;
  grow: string;
  submitted: boolean;
  reaction: string | null;
}

export interface KeepsakeAnswer {
  questionKey: string;
  myAnswer: string;
  partnerAnswer: string;
  mySubmitted: boolean;
  partnerSubmitted: boolean;
}

interface KeepsakeRow {
  couple_id: string;
  user_id: string;
  question_key: string;
  answer: string;
}

interface AppContextType {
  isLoading: boolean;
  onboardingComplete: boolean;
  whoPays: 'me' | 'partner' | 'later' | null;
  user: User | null;
  couple: Couple | null;
  entries: DailyEntry[];
  todayEntry: DailyEntry | null;
  keepsakes: KeepsakeAnswer[];
  notificationSettings: NotificationSettings;

  completeOnboarding: () => Promise<void>;
  setWhoPays: (who: 'me' | 'partner' | 'later') => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendPhoneOtp: (phone: string) => Promise<void>;
  verifyPhoneOtp: (phone: string, code: string) => Promise<void>;
  updateProfile: (fields: { name: string; birthday?: string; pronouns?: string }) => Promise<void>;
  setCouple: (couple: Couple) => Promise<void>;
  createCouple: () => Promise<Couple>;
  joinCouple: (inviteCode: string) => Promise<Couple>;
  refreshSharedState: () => Promise<void>;
  updateTodayEntry: (updates: Partial<DailyEntry>) => Promise<void>;
  submitTodayEntry: () => Promise<void>;
  revealTodayEntry: () => Promise<void>;
  setMyReaction: (reaction: string) => Promise<void>;
  saveKeepsakeAnswer: (questionKey: string, answer: string) => Promise<void>;
  checkMilestone: () => Promise<number | null>;
  sendNudge: () => Promise<void>;
  signOut: () => Promise<void>;
  setNotificationSettings: (settings: NotificationSettings) => Promise<void>;
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEYS = {
  ONBOARDING: 'lunara_onboarding_v2',
  WHO_PAYS: 'lunara_who_pays_v2',
  DEMO_USER: 'lunara_demo_user_v2',
  DEMO_COUPLE: 'lunara_demo_couple_v2',
  DEMO_ENTRIES: 'lunara_demo_entries_v2',
  DEMO_KEEPSAKES: 'lunara_demo_keepsakes_v1',
  REVEALED_DATES: 'lunara_revealed_dates_v2',
  NOTIFICATION_SETTINGS: 'lunara_notification_settings_v2',
  CELEBRATED_MILESTONES: 'lunara_celebrated_milestones_v1',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function addDays(date: string, delta: number): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return d.toISOString().split('T')[0];
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000,
  );
}

/**
 * A night only counts once both partners have completed it — the streak is
 * always derived fresh from entries rather than incremented in place, so a
 * missed night quietly resolves itself instead of needing special-case reset
 * logic. `longestStreak` is preserved as a couple's high-water mark even
 * after a gap breaks the current run.
 */
function computeStreaks(entries: DailyEntry[]): { current: number; longest: number } {
  const doneDates = entries
    .filter((e) => e.submitted && e.partnerSubmitted)
    .map((e) => e.date)
    .sort();
  if (doneDates.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < doneDates.length; i++) {
    run = daysBetween(doneDates[i - 1], doneDates[i]) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const doneSet = new Set(doneDates);
  const today = getToday();
  let cursor = doneSet.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (doneSet.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  return { current, longest };
}

// Demo partner responses for today
const DEMO_PARTNER_TODAY = {
  partnerGrateful: 'The way you light up when you talk about something you love',
  partnerCute: 'You got completely distracted by a dog you saw outside, and it was everything',
  partnerGrow: 'I would love for us to leave little handwritten notes for each other more often',
};

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

// Demo partner's pre-filled keepsake answers, so the feature is visible immediately.
const DEMO_KEEPSAKE_PARTNER_ANSWERS: Record<string, string> = {
  love_most: 'The way you make even ordinary days feel a little bit magic.',
  how_met: 'A rainy afternoon, the wrong bus, and somehow the right conversation.',
  small_thing: 'You always save me the last bite of whatever you’re eating.',
  favorite_memory: 'Falling asleep on the phone with you the night before I moved here.',
  feel_closest: 'Quiet mornings, half-awake, not saying anything at all — just you being near.',
};

function mergeKeepsakeRows(rows: KeepsakeRow[], userId: string): KeepsakeAnswer[] {
  const byQuestion = new Map<string, KeepsakeRow[]>();
  for (const row of rows) {
    byQuestion.set(row.question_key, [...(byQuestion.get(row.question_key) ?? []), row]);
  }
  return KEEPSAKE_QUESTIONS.map((q) => {
    const rowsForQuestion = byQuestion.get(q.key) ?? [];
    const mine = rowsForQuestion.find((r) => r.user_id === userId);
    const partner = rowsForQuestion.find((r) => r.user_id !== userId);
    return {
      questionKey: q.key,
      myAnswer: mine?.answer ?? '',
      partnerAnswer: partner?.answer ?? '',
      mySubmitted: Boolean(mine),
      partnerSubmitted: Boolean(partner),
    };
  });
}

function mergeEntryRows(rows: EntryRow[], userId: string, revealedDates: Set<string>): DailyEntry[] {
  const byDate = new Map<string, EntryRow[]>();
  for (const row of rows) {
    byDate.set(row.date, [...(byDate.get(row.date) ?? []), row]);
  }
  return Array.from(byDate.entries()).map(([date, dateRows]) => {
    const mine = dateRows.find((r) => r.user_id === userId);
    const partner = dateRows.find((r) => r.user_id !== userId);
    return {
      date,
      grateful: mine?.grateful ?? '',
      cute: mine?.cute ?? '',
      grow: mine?.grow ?? '',
      submitted: mine?.submitted ?? false,
      partnerGrateful: partner?.grateful ?? '',
      partnerCute: partner?.cute ?? '',
      partnerGrow: partner?.grow ?? '',
      partnerSubmitted: partner?.submitted ?? false,
      revealed: revealedDates.has(date),
      myReaction: mine?.reaction ?? undefined,
      partnerReaction: partner?.reaction ?? undefined,
    };
  });
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [whoPays, setWhoPaysState] = useState<'me' | 'partner' | 'later' | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUserState] = useState<User | null>(null);
  const [couple, setCoupleState] = useState<Couple | null>(null);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [keepsakes, setKeepsakes] = useState<KeepsakeAnswer[]>([]);
  const [revealedDates, setRevealedDates] = useState<Set<string>>(new Set());
  const [notificationSettings, setNotificationSettingsState] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const isDemo = couple?.isDemoMode ?? false;

  // ─── Loading persisted local state ───────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const [onboarding, pays, notifJson, revealedJson] = await Promise.all([
          AsyncStorage.getItem(KEYS.ONBOARDING),
          AsyncStorage.getItem(KEYS.WHO_PAYS),
          AsyncStorage.getItem(KEYS.NOTIFICATION_SETTINGS),
          AsyncStorage.getItem(KEYS.REVEALED_DATES),
        ]);
        if (onboarding) setOnboardingComplete(true);
        if (pays) setWhoPaysState(pays as 'me' | 'partner' | 'later');
        if (notifJson) setNotificationSettingsState(JSON.parse(notifJson));
        if (revealedJson) setRevealedDates(new Set(JSON.parse(revealedJson)));
      } catch {
        // Ignore storage errors — app still works
      }
    })();
  }, []);

  // ─── Auth bootstrap ───────────────────────────────────────────────────────

  const loadDemoState = useCallback(async () => {
    const [userJson, coupleJson, entriesJson, keepsakesJson] = await Promise.all([
      AsyncStorage.getItem(KEYS.DEMO_USER),
      AsyncStorage.getItem(KEYS.DEMO_COUPLE),
      AsyncStorage.getItem(KEYS.DEMO_ENTRIES),
      AsyncStorage.getItem(KEYS.DEMO_KEEPSAKES),
    ]);
    if (userJson) setUserState(JSON.parse(userJson));
    if (coupleJson) setCoupleState(JSON.parse(coupleJson));
    if (entriesJson) setEntries(JSON.parse(entriesJson));
    if (keepsakesJson) setKeepsakes(JSON.parse(keepsakesJson));
  }, []);

  const loadRemoteProfileAndCouple = useCallback(async (userId: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, birthday, pronouns')
      .eq('id', userId)
      .maybeSingle();

    setUserState({
      id: userId,
      name: profile?.name ?? '',
      birthday: profile?.birthday ?? undefined,
      pronouns: profile?.pronouns ?? undefined,
    });

    const { data: coupleRow } = await supabase.rpc('get_my_couple').maybeSingle();
    if (coupleRow) {
      setCoupleState({
        id: coupleRow.id,
        partnerName: coupleRow.partner_name,
        startDate: coupleRow.start_date ?? undefined,
        currentStreak: coupleRow.current_streak,
        longestStreak: coupleRow.longest_streak,
        inviteCode: coupleRow.invite_code,
        isDemoMode: false,
        isSubscribed: coupleRow.is_subscribed,
      });

      const [{ data: entryRows }, { data: keepsakeRows }] = await Promise.all([
        supabase
          .from('entries')
          .select('couple_id, date, user_id, grateful, cute, grow, submitted, reaction')
          .eq('couple_id', coupleRow.id),
        supabase
          .from('keepsakes')
          .select('couple_id, user_id, question_key, answer')
          .eq('couple_id', coupleRow.id),
      ]);
      setEntries(mergeEntryRows(entryRows ?? [], userId, revealedDates));
      setKeepsakes(mergeKeepsakeRows(keepsakeRows ?? [], userId));
    } else {
      setCoupleState(null);
      setEntries([]);
      setKeepsakes([]);
    }

    void configurePurchases(userId);
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        supabase.from('profiles').update({ expo_push_token: token }).eq('id', userId);
      }
    });
  }, [revealedDates]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) {
        await loadRemoteProfileAndCouple(data.session.user.id);
      } else {
        await loadDemoState();
      }
      setIsLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        await loadRemoteProfileAndCouple(nextSession.user.id);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Realtime subscription ────────────────────────────────────────────────

  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (!couple || couple.isDemoMode || !session) return;

    const channel = supabase
      .channel(`couple:${couple.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entries', filter: `couple_id=eq.${couple.id}` },
        () => { refreshSharedStateRef.current?.(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'couple_members', filter: `couple_id=eq.${couple.id}` },
        () => { refreshSharedStateRef.current?.(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'keepsakes', filter: `couple_id=eq.${couple.id}` },
        () => { refreshSharedStateRef.current?.(); },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'couples', filter: `id=eq.${couple.id}` },
        () => { refreshSharedStateRef.current?.(); },
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id, couple?.isDemoMode, session]);

  // ─── Shared-state refresh (foreground / focus / realtime) ─────────────────

  const refreshSharedState = useCallback(async () => {
    if (!session || isDemo) return;
    await loadRemoteProfileAndCouple(session.user.id);
  }, [session, isDemo, loadRemoteProfileAndCouple]);

  const refreshSharedStateRef = useRef(refreshSharedState);
  useEffect(() => { refreshSharedStateRef.current = refreshSharedState; }, [refreshSharedState]);

  useEffect(() => {
    if (isLoading) return;
    if (!notificationSettings.enabled) return;
    const entryForToday = entries.find((e) => e.date === getToday());
    const promise = entryForToday?.submitted
      ? scheduleNightlyReminder(notificationSettings.reminderHour, notificationSettings.reminderMinute, { skipToday: true })
      : refreshNightlyReminder(notificationSettings.reminderHour, notificationSettings.reminderMinute);
    promise.catch(() => {});
  }, [entries, isLoading, notificationSettings]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshSharedStateRef.current?.().catch(() => {});
      }
    });
    return () => subscription.remove();
  }, []);

  const todayEntry = entries.find((e) => e.date === getToday()) ?? null;

  // Demo couples have no server to compute the streak for them, so it's derived
  // fresh from entries here — this is also what makes a missed night resolve
  // gracefully instead of requiring an explicit "reset" code path. Paired couples
  // get current_streak / longest_streak from the server via refreshSharedState.
  useEffect(() => {
    if (!isDemo || !couple) return;
    const { current, longest } = computeStreaks(entries);
    const longestStreak = Math.max(longest, couple.longestStreak);
    if (current === couple.currentStreak && longestStreak === couple.longestStreak) return;
    const updated = { ...couple, currentStreak: current, longestStreak };
    setCoupleState(updated);
    AsyncStorage.setItem(KEYS.DEMO_COUPLE, JSON.stringify(updated)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, isDemo]);

  // Keep the iOS home screen widget in sync with the latest streak/ritual state.
  useEffect(() => {
    updateWidgetData({
      streak: couple?.currentStreak ?? 0,
      ritualComplete: Boolean(todayEntry?.submitted),
      isPaired: Boolean(couple),
    });
  }, [couple, todayEntry?.submitted]);

  // ─── Onboarding / prefs ────────────────────────────────────────────────────

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(KEYS.ONBOARDING, 'true');
    setOnboardingComplete(true);
  }, []);

  const setWhoPays = useCallback(async (who: 'me' | 'partner' | 'later') => {
    await AsyncStorage.setItem(KEYS.WHO_PAYS, who);
    setWhoPaysState(who);
  }, []);

  // ─── Auth ─────────────────────────────────────────────────────────────────

  const signInWithApple = useCallback(async () => {
    const AppleAuthentication = await import('expo-apple-authentication');
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) {
      throw new Error('Apple sign-in did not return a credential. Please try again.');
    }
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) throw new Error(error.message);

    if (credential.fullName?.givenName) {
      const name = [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(' ');
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        await supabase.from('profiles').update({ name }).eq('id', userData.user.id).eq('name', '');
      }
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
    GoogleSignin.configure({
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    });
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    const idToken = (response as any)?.data?.idToken ?? (response as any)?.idToken;
    if (!idToken) {
      throw new Error('Google sign-in did not return a credential. Please try again.');
    }
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) throw new Error(error.message);
  }, []);

  const sendPhoneOtp = useCallback(async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw new Error(error.message);
  }, []);

  const verifyPhoneOtp = useCallback(async (phone: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
    if (error) throw new Error(error.message);
  }, []);

  const updateProfile = useCallback(async (fields: { name: string; birthday?: string; pronouns?: string }) => {
    if (!session) throw new Error('You need to be signed in to update your profile.');
    const { error } = await supabase
      .from('profiles')
      .update({
        name: fields.name.trim(),
        birthday: fields.birthday || null,
        pronouns: fields.pronouns || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.user.id);
    if (error) throw new Error(error.message);
    setUserState((prev) => (prev ? { ...prev, ...fields } : prev));
  }, [session]);

  // ─── Pairing ──────────────────────────────────────────────────────────────

  const setCouple = useCallback(async (c: Couple) => {
    await AsyncStorage.setItem(KEYS.DEMO_COUPLE, JSON.stringify(c));
    setCoupleState(c);

    if (c.isDemoMode) {
      const demo = generateDemoEntries();
      await AsyncStorage.setItem(KEYS.DEMO_ENTRIES, JSON.stringify(demo));
      setEntries(demo);
      if (!user) {
        const demoUser: User = { id: generateId(), name: 'You' };
        await AsyncStorage.setItem(KEYS.DEMO_USER, JSON.stringify(demoUser));
        setUserState(demoUser);
      }
    }
  }, [user]);

  const createCouple = useCallback(async (): Promise<Couple> => {
    if (!session || !user) throw new Error('Set up your profile before connecting with a partner.');
    const { data, error } = await supabase.rpc('create_couple', { p_user_name: user.name });
    if (error || !data) throw new Error(error?.message ?? 'Could not create your invite.');
    await refreshSharedState();
    return {
      id: data.id,
      partnerName: 'Waiting...',
      startDate: data.start_date,
      currentStreak: data.current_streak,
      longestStreak: data.longest_streak,
      inviteCode: data.invite_code,
      isDemoMode: false,
      isSubscribed: false,
    };
  }, [session, user, refreshSharedState]);

  const joinCouple = useCallback(async (inviteCode: string): Promise<Couple> => {
    if (!session || !user) throw new Error('Set up your profile before connecting with a partner.');
    const { data, error } = await supabase
      .rpc('join_couple', { p_invite_code: inviteCode.trim().toUpperCase(), p_user_name: user.name });
    if (error || !data) throw new Error(error?.message ?? 'Could not join this couple.');
    await refreshSharedState();
    return {
      id: data.id,
      partnerName: 'Waiting...',
      startDate: data.start_date,
      currentStreak: data.current_streak,
      longestStreak: data.longest_streak,
      inviteCode: data.invite_code,
      isDemoMode: false,
      isSubscribed: false,
    };
  }, [session, user, refreshSharedState]);

  // ─── Ritual entries ───────────────────────────────────────────────────────

  const persistDemoEntries = useCallback(async (next: DailyEntry[]) => {
    setEntries(next);
    await AsyncStorage.setItem(KEYS.DEMO_ENTRIES, JSON.stringify(next));
  }, []);

  const updateTodayEntry = useCallback(async (updates: Partial<DailyEntry>) => {
    const today = getToday();

    if (isDemo) {
      const existing = entries.find((e) => e.date === today);
      const next = { ...(existing ?? emptyEntry(today, true)), ...updates };
      await persistDemoEntries(entries.some((e) => e.date === today)
        ? entries.map((e) => (e.date === today ? next : e))
        : [...entries, next]);
      return;
    }

    if (!session || !couple) return;
    const existing = entries.find((e) => e.date === today);
    const merged = { ...(existing ?? emptyEntry(today)), ...updates };
    const { error } = await supabase.from('entries').upsert({
      couple_id: couple.id,
      date: today,
      user_id: session.user.id,
      grateful: merged.grateful,
      cute: merged.cute,
      grow: merged.grow,
      submitted: merged.submitted,
      reaction: merged.myReaction ?? null,
    }, { onConflict: 'couple_id,date,user_id' });
    if (error) throw new Error(error.message);
    await refreshSharedState();
  }, [couple, entries, isDemo, persistDemoEntries, refreshSharedState, session]);

  const submitTodayEntry = useCallback(async () => {
    const today = getToday();

    if (isDemo) {
      const existing = entries.find((e) => e.date === today);
      const next = { ...(existing ?? emptyEntry(today, true)), submitted: true };
      await persistDemoEntries(entries.some((e) => e.date === today)
        ? entries.map((e) => (e.date === today ? next : e))
        : [...entries, next]);
      // Streak is derived from entries by the effect below — no manual bump needed.
    } else if (session && couple) {
      const existing = entries.find((e) => e.date === today);
      const merged = { ...(existing ?? emptyEntry(today)), submitted: true };
      const { error } = await supabase.from('entries').upsert({
        couple_id: couple.id,
        date: today,
        user_id: session.user.id,
        grateful: merged.grateful,
        cute: merged.cute,
        grow: merged.grow,
        submitted: true,
        reaction: merged.myReaction ?? null,
      }, { onConflict: 'couple_id,date,user_id' });
      if (error) throw new Error(error.message);
      await refreshSharedState();
    }

    if (notificationSettings.enabled) {
      await scheduleNightlyReminder(notificationSettings.reminderHour, notificationSettings.reminderMinute, { skipToday: true });
    } else {
      await cancelNightlyReminder();
    }
  }, [couple, entries, isDemo, notificationSettings, persistDemoEntries, refreshSharedState, session]);

  const revealTodayEntry = useCallback(async () => {
    const today = getToday();
    setRevealedDates((prev) => {
      const next = new Set(prev).add(today);
      AsyncStorage.setItem(KEYS.REVEALED_DATES, JSON.stringify([...next]));
      return next;
    });
    setEntries((prev) => prev.map((e) => (e.date === today ? { ...e, revealed: true } : e)));
    if (isDemo) {
      const existing = entries.find((e) => e.date === today);
      if (existing) await persistDemoEntries(entries.map((e) => (e.date === today ? { ...e, revealed: true } : e)));
    }
  }, [entries, isDemo, persistDemoEntries]);

  const setMyReaction = useCallback(async (reaction: string) => {
    const today = getToday();
    const existing = entries.find((e) => e.date === today);
    if (!existing) return;

    if (isDemo) {
      await persistDemoEntries(entries.map((e) => (e.date === today ? { ...e, myReaction: reaction } : e)));
      return;
    }

    if (!session || !couple) return;
    const { error } = await supabase.from('entries').upsert({
      couple_id: couple.id,
      date: today,
      user_id: session.user.id,
      grateful: existing.grateful,
      cute: existing.cute,
      grow: existing.grow,
      submitted: existing.submitted,
      reaction,
    }, { onConflict: 'couple_id,date,user_id' });
    if (error) throw new Error(error.message);
    await refreshSharedState();
  }, [couple, entries, isDemo, persistDemoEntries, refreshSharedState, session]);

  const saveKeepsakeAnswer = useCallback(async (questionKey: string, answer: string) => {
    const trimmed = answer.trim();

    if (isDemo) {
      const next = keepsakes.some((k) => k.questionKey === questionKey)
        ? keepsakes.map((k) => (k.questionKey === questionKey ? { ...k, myAnswer: trimmed, mySubmitted: trimmed.length > 0 } : k))
        : [
            ...keepsakes,
            {
              questionKey,
              myAnswer: trimmed,
              partnerAnswer: DEMO_KEEPSAKE_PARTNER_ANSWERS[questionKey] ?? '',
              mySubmitted: trimmed.length > 0,
              partnerSubmitted: Boolean(DEMO_KEEPSAKE_PARTNER_ANSWERS[questionKey]),
            },
          ];
      setKeepsakes(next);
      await AsyncStorage.setItem(KEYS.DEMO_KEEPSAKES, JSON.stringify(next));
      return;
    }

    if (!session || !couple || !trimmed) return;
    const { error } = await supabase.from('keepsakes').upsert({
      couple_id: couple.id,
      user_id: session.user.id,
      question_key: questionKey,
      answer: trimmed,
    }, { onConflict: 'couple_id,user_id,question_key' });
    if (error) throw new Error(error.message);
    await refreshSharedState();
  }, [couple, isDemo, keepsakes, refreshSharedState, session]);

  const checkMilestone = useCallback(async (): Promise<number | null> => {
    if (!couple || !STREAK_MILESTONES.includes(couple.currentStreak)) return null;
    const marker = `${couple.id}:${couple.currentStreak}`;
    const raw = await AsyncStorage.getItem(KEYS.CELEBRATED_MILESTONES);
    const celebrated: string[] = raw ? JSON.parse(raw) : [];
    if (celebrated.includes(marker)) return null;
    await AsyncStorage.setItem(KEYS.CELEBRATED_MILESTONES, JSON.stringify([...celebrated, marker]));
    return couple.currentStreak;
  }, [couple]);

  const sendNudge = useCallback(async () => {
    if (isDemo) return;
    await supabase.functions.invoke('send-nudge');
  }, [isDemo]);

  // ─── Notifications / sign out ──────────────────────────────────────────────

  const setNotificationSettings = useCallback(async (settings: NotificationSettings) => {
    await AsyncStorage.setItem(KEYS.NOTIFICATION_SETTINGS, JSON.stringify(settings));
    setNotificationSettingsState(settings);
    if (settings.enabled) {
      await scheduleNightlyReminder(settings.reminderHour, settings.reminderMinute);
    } else {
      await cancelNightlyReminder();
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    await logOutPurchases();
    await AsyncStorage.multiRemove(Object.values(KEYS));
    await cancelNightlyReminder();
    setOnboardingComplete(false);
    setWhoPaysState(null);
    setUserState(null);
    setCoupleState(null);
    setEntries([]);
    setKeepsakes([]);
    setRevealedDates(new Set());
    setNotificationSettingsState(DEFAULT_NOTIFICATION_SETTINGS);
  }, []);

  return (
    <AppContext.Provider
      value={{
        isLoading,
        onboardingComplete,
        whoPays,
        user,
        couple,
        entries,
        todayEntry,
        keepsakes,
        notificationSettings,
        completeOnboarding,
        setWhoPays,
        signInWithApple,
        signInWithGoogle,
        sendPhoneOtp,
        verifyPhoneOtp,
        updateProfile,
        setCouple,
        createCouple,
        joinCouple,
        refreshSharedState,
        updateTodayEntry,
        submitTodayEntry,
        revealTodayEntry,
        setMyReaction,
        saveKeepsakeAnswer,
        checkMilestone,
        sendNudge,
        signOut,
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
