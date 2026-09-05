import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RealtimeChannel, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { configurePurchases, logOutPurchases, checkIsPro, onEntitlementChange } from '@/lib/purchases';
import { updateWidgetData, type WidgetStatus } from '@/lib/widget';
import { isPartnerJoined } from '@/lib/partner';
import { getCompanionState, lastCompletedDate } from '@/lib/companion';
import { isGoogleSignInConfigured } from '@/lib/googleSignIn';
import {
  computeStreakState,
  completedDates,
  todayKey,
  toDateKey,
  STREAK_MILESTONES,
  type StreakState,
} from '@/lib/streak';
import { KEEPSAKE_QUESTIONS } from '@/constants/keepsakeQuestions';
import type { VoiceSlot } from '@/lib/voiceNotes';
import { isGrowFollowUpResponse, type GrowFollowUpResponse } from '@/lib/growCheckBack';
import {
  NotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
  scheduleNightlyReminder,
  cancelNightlyReminder,
  refreshNightlyReminder,
  refreshStreakProtection,
  cancelStreakProtection,
  registerForPushNotificationsAsync,
} from '@/services/notifications';

/** What a signed-in account already has on the server. */
export interface RemoteAccountState {
  /** A profile row with a name — i.e. profile setup is already done. */
  hasProfile: boolean;
  /** Already a member of a couple — pairing is already done. */
  hasCouple: boolean;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

/**
 * Thrown when a write needs a signed-in user and there isn't one — an expired
 * refresh token, or a sign-out on another device.
 *
 * Before this existed, `updateTodayEntry` and `submitTodayEntry` both began
 * `if (!session || !couple) return;`. A signed-out user could fill in all three
 * cards, tap Submit, watch the button finish its animation, and be shown a
 * completed night that had been written precisely nowhere. Callers catch this
 * and route to sign-in.
 */
export class NotSignedInError extends Error {
  constructor() {
    super('Your session has expired. Sign in again to save tonight.');
    this.name = 'NotSignedInError';
  }
}

// ─── Nudge results ────────────────────────────────────────────────────────────

/** Structured result from the `send-nudge` edge function. */
interface NudgeResult {
  sent: boolean;
  reason?: string;
  message?: string;
}

/**
 * supabase-js turns a non-2xx into a `FunctionsHttpError` whose `context` is
 * the raw `Response`, so the structured reason the function returned is still
 * readable — but only once, and only if the body parses.
 */
async function readNudgeReason(error: unknown): Promise<string | undefined> {
  const context = (error as { context?: unknown })?.context;
  if (!(context instanceof Response)) return undefined;
  try {
    const body = (await context.json()) as { reason?: string; error?: string };
    // `send-nudge` explains itself under `reason`, `delete-account` under
    // `error`. Reading only `reason` meant every delete-account failure — an
    // expired session, a storage error, a refusal — was flattened into the
    // caller's generic fallback, so the one sentence telling the user what
    // actually went wrong never reached them.
    return body?.reason ?? body?.error;
  } catch {
    return undefined;
  }
}

/**
 * The sender did nothing wrong in any of these cases, so none of them get an
 * error voice — but none of them get to imply the ping landed either.
 */
function nudgeFailureMessage(reason?: string): string {
  if (reason === 'no_push_token' || reason === 'device_unregistered') {
    return 'They haven’t turned notifications on yet, so there’s nothing to ping. Your night is saved — they’ll see it the moment they open Lunara.';
  }
  return 'We couldn’t reach their phone just now. Your night is saved either way — they’ll see it when they open Lunara.';
}

// ─── Push token ───────────────────────────────────────────────────────────────

/**
 * Register this device for remote push and persist the token on the user's
 * profile row.
 *
 * The write has to be awaited. PostgREST query builders are thenables, not
 * promises — the HTTP request is only issued when the builder is awaited or
 * `.then()`d. This previously read
 * `supabase.from('profiles').update({...}).eq('id', userId);` with no await, so
 * the request was never sent, `profiles.expo_push_token` stayed null forever,
 * and every server-side push (entries-webhook, send-nudge) early-returned on
 * "no push token". Every remote notification in the app was dead because of
 * this one missing keyword.
 *
 * Never raises the OS permission dialog. This runs on every sign-in and every
 * cold start, so asking here meant the system prompt fired the instant someone
 * finished signing up — before Lunara had said a word about what it would send
 * or why. A denied prompt is permanent, so that one badly-timed dialog cost the
 * entire trigger half of the habit loop. Permission is asked for exactly where
 * it has been primed (the tutorial's reminder card, and the Notifications
 * toggle in Us); this only collects a token once someone has already said yes.
 *
 * Returns the token that is now stored server-side, or null if the device has
 * no token to give (simulator, web, permission not granted) or the write failed.
 */
async function syncPushToken(userId: string): Promise<string | null> {
  let token: string | null = null;
  try {
    token = await registerForPushNotificationsAsync({ requestPermission: false });
  } catch (err) {
    console.warn('[push] could not obtain an Expo push token', err);
    return null;
  }
  if (!token) return null;

  // `.select('id')` so we can tell "updated" from "matched nothing". An update
  // that hits zero rows is not an error to PostgREST, and a missing profile row
  // would otherwise look exactly like success.
  const { data, error } = await supabase
    .from('profiles')
    .update({ expo_push_token: token })
    .eq('id', userId)
    .select('id');

  if (error) {
    // Not fatal to the session — the app works without push — but it is the
    // difference between a partner being told and not, so it must be visible.
    console.warn('[push] failed to save expo_push_token', error.message);
    return null;
  }
  if (!data?.length) {
    console.warn('[push] no profile row for', userId, '— push token not saved');
    return null;
  }
  return token;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  birthday?: string;
  pronouns?: string;
}

export interface Couple {
  id: string;
  /**
   * The partner's display name. Empty until someone actually joins — never a
   * placeholder, so it is safe to interpolate via `partnerLabel()`.
   */
  partnerName: string;
  /** True once a second person has joined. Drives every "are we paired" branch. */
  partnerJoined: boolean;
  /**
   * The partner's auth user id. Needed to address them directly — the nudge
   * edge function takes a target, not "the other one". Undefined until someone
   * has actually joined, and always undefined in demo mode.
   */
  partnerId?: string;
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
  /**
   * Storage paths in the private `voice-notes` bucket (or a local file:// URI
   * in demo mode). Null/undefined means no recording for that card. Partner
   * paths only arrive once the reveal gate has opened, same as the text.
   */
  voiceGrateful?: string | null;
  voiceCute?: string | null;
  voiceGrow?: string | null;
  partnerVoiceGrateful?: string | null;
  partnerVoiceCute?: string | null;
  partnerVoiceGrow?: string | null;
  /** Reply to the next-day Grow check-back about this day's Grow note. */
  growFollowUp?: GrowFollowUpResponse | null;
  partnerGrowFollowUp?: GrowFollowUpResponse | null;
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
  voice_grateful: string | null;
  voice_cute: string | null;
  voice_grow: string | null;
  grow_followup: string | null;
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
  /**
   * The night the app is currently working on (YYYY-MM-DD), pinned for the
   * length of the writing session. Screens must prefer this over `todayKey()`
   * so nothing shifts underneath someone who started writing before midnight.
   */
  ritualDate: string;
  /**
   * Whether the Supabase realtime channel for this couple is actually joined.
   * False in demo mode, before the channel connects, and after it drops — the
   * only situations in which polling for changes earns its cost.
   */
  realtimeConnected: boolean;
  whoPays: 'me' | 'partner' | 'later' | null;
  user: User | null;
  couple: Couple | null;
  entries: DailyEntry[];
  todayEntry: DailyEntry | null;
  keepsakes: KeepsakeAnswer[];
  /**
   * The live streak, derived from entries rather than read off the server row.
   * Screens should prefer this over `couple.currentStreak` — see the note on
   * the deriving effect below for why the two can disagree.
   */
  streakState: StreakState;
  notificationSettings: NotificationSettings;
  /**
   * The account signed out on its own — an expired refresh token, or a
   * sign-out elsewhere. The root gate routes on this so a returning user meets
   * the sign-in screen instead of a fully-rendered app that cannot save
   * anything. Everything they had typed is still in place when they come back.
   */
  sessionExpired: boolean;

  completeOnboarding: () => Promise<void>;
  setWhoPays: (who: 'me' | 'partner' | 'later') => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendPhoneOtp: (phone: string) => Promise<void>;
  verifyPhoneOtp: (phone: string, code: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  updateProfile: (fields: { name: string; birthday?: string; pronouns?: string }) => Promise<void>;
  setCouple: (couple: Couple) => Promise<void>;
  createCouple: () => Promise<Couple>;
  joinCouple: (inviteCode: string) => Promise<Couple>;
  /**
   * Re-read profile + couple from the server. Returns what the account already
   * has, so a sign-in can route a returning user past onboarding instead of
   * asking them to set up a profile and "start a new couple" they already have.
   */
  refreshSharedState: () => Promise<RemoteAccountState | null>;
  /**
   * Re-read just this couple's entries. The targeted counterpart to
   * `refreshSharedState`, which also re-reads the profile, the couple row, both
   * members and every keepsake — five round trips to learn one thing.
   */
  refreshEntries: () => Promise<void>;
  /**
   * Re-read Pro from RevenueCat and unlock immediately. Returns the entitlement
   * so a caller (purchase, restore) can act on it without a second round trip.
   */
  refreshEntitlement: () => Promise<boolean>;
  /**
   * False in demo mode. A demo couple has no server-side couple to attach a
   * subscription to, so a purchase made there buys nothing deliverable.
   */
  canPurchase: boolean;
  updateTodayEntry: (updates: Partial<DailyEntry>) => Promise<void>;
  /**
   * Finish tonight. Pass the final answers rather than saving them first: the
   * screen used to call `updateTodayEntry` and then `submitTodayEntry`, which
   * was two upserts, two refetches, and — because both callbacks close over the
   * same render's `entries` — a second write that could overwrite the first
   * with the text it had captured before it. One write, one refetch, one truth.
   */
  submitTodayEntry: (updates?: Partial<DailyEntry>) => Promise<void>;
  revealTodayEntry: () => Promise<void>;
  setMyReaction: (reaction: string) => Promise<void>;
  setVoiceNote: (slot: VoiceSlot, path: string | null) => Promise<void>;
  setGrowFollowUp: (date: string, response: GrowFollowUpResponse) => Promise<void>;
  saveKeepsakeAnswer: (questionKey: string, answer: string) => Promise<void>;
  checkMilestone: () => Promise<number | null>;
  sendNudge: () => Promise<void>;
  /**
   * Store this device's push token, once the OS permission has just been
   * granted. Call it from wherever the grant happened — the token is what makes
   * "your partner shared tonight" and the gentle nudge deliverable at all, and
   * nothing else picks it up until the next cold start.
   */
  registerPushToken: () => Promise<void>;
  /**
   * Permanently delete the account and everything attached to it, then land
   * back at a signed-out app. Required by App Store guideline 5.1.1(v).
   *
   * Throws with a readable message on failure so the caller can say what went
   * wrong — a deletion that quietly does nothing is worse than one that fails
   * loudly, because the user believes their data is gone.
   */
  /**
   * Leave the demo and go back to pairing for real.
   *
   * Demo mode was a one-way door: tapping "Explore in demo mode" put you in a
   * local couple with a simulated partner and nothing anywhere offered a way
   * out, so the only escape was signing out entirely. Anyone who tried the
   * demo before inviting their actual partner was stuck writing nightly
   * entries to a fake one.
   */
  exitDemoMode: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  signOut: () => Promise<void>;
  setNotificationSettings: (settings: NotificationSettings) => Promise<void>;
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEYS = {
  ONBOARDING: 'lunara_onboarding_v2',
  WHO_PAYS: 'lunara_who_pays_v2',
  PRO_ENTITLEMENT: 'lunara_pro_entitlement_v1',
  DEMO_USER: 'lunara_demo_user_v2',
  DEMO_COUPLE: 'lunara_demo_couple_v2',
  DEMO_ENTRIES: 'lunara_demo_entries_v2',
  DEMO_KEEPSAKES: 'lunara_demo_keepsakes_v1',
  REVEALED_DATES: 'lunara_revealed_dates_v2',
  NOTIFICATION_SETTINGS: 'lunara_notification_settings_v2',
  CELEBRATED_MILESTONES: 'lunara_celebrated_milestones_v1',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Tonight's date key, on the *local* calendar.
 *
 * This used to be `toISOString()`, which is UTC — so anywhere west of Greenwich
 * the evening ritual was filed under tomorrow's date. A couple in California
 * writing at 9pm on the 4th had it stored as the 5th: Moments showed the wrong
 * day, and the next morning the app believed the 5th was already done. The
 * ritual is defined by the night the couple is actually having, so the date has
 * to be theirs.
 */
function getToday(): string {
  return todayKey();
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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
    voiceGrateful: null,
    voiceCute: null,
    voiceGrow: null,
    partnerVoiceGrateful: null,
    partnerVoiceCute: null,
    partnerVoiceGrow: null,
    growFollowUp: null,
    partnerGrowFollowUp: null,
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
      partnerGrow: "Let us be more curious about each other's day",
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
      date: toDateKey(date),
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
      voiceGrateful: mine?.voice_grateful ?? null,
      voiceCute: mine?.voice_cute ?? null,
      voiceGrow: mine?.voice_grow ?? null,
      partnerVoiceGrateful: partner?.voice_grateful ?? null,
      partnerVoiceCute: partner?.voice_cute ?? null,
      partnerVoiceGrow: partner?.voice_grow ?? null,
      growFollowUp: isGrowFollowUpResponse(mine?.grow_followup) ? mine.grow_followup : null,
      partnerGrowFollowUp: isGrowFollowUpResponse(partner?.grow_followup) ? partner.grow_followup : null,
    };
  });
}

/** The column set every entry read asks for — one list, three call sites. */
const ENTRY_COLUMNS =
  'couple_id, date, user_id, grateful, cute, grow, submitted, reaction, voice_grateful, voice_cute, voice_grow, grow_followup';

/**
 * The column set every entry write sends. Kept in one place so a new field
 * (voice notes, the Grow check-back) can't be persisted by one code path and
 * silently dropped by another — all three writers upsert the same shape.
 */
function entryUpsertPayload(coupleId: string, date: string, userId: string, entry: DailyEntry) {
  return {
    couple_id: coupleId,
    date,
    user_id: userId,
    grateful: entry.grateful,
    cute: entry.cute,
    grow: entry.grow,
    submitted: entry.submitted,
    reaction: entry.myReaction ?? null,
    voice_grateful: entry.voiceGrateful ?? null,
    voice_cute: entry.voiceCute ?? null,
    voice_grow: entry.voiceGrow ?? null,
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [whoPays, setWhoPaysState] = useState<'me' | 'partner' | 'later' | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  /**
   * The session went away without the user asking — an expired refresh token,
   * or a sign-out on another device.
   *
   * Distinct from `session === null`, which is also the normal state of a demo
   * user and of anyone who has genuinely signed out. Only this flag means "we
   * had an account a moment ago and no longer do", which is the one case where
   * the app is showing a signed-in interface it can no longer back with writes.
   */
  const [sessionExpired, setSessionExpired] = useState(false);
  /** Set while `signOut()` runs, so a deliberate sign-out isn't read as an expiry. */
  const signingOutRef = useRef(false);
  const [user, setUserState] = useState<User | null>(null);
  // Raw couple as stored/fetched. `couple` below folds in the derived streak.
  const [baseCouple, setCoupleState] = useState<Couple | null>(null);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [keepsakes, setKeepsakes] = useState<KeepsakeAnswer[]>([]);
  const [revealedDates, setRevealedDates] = useState<Set<string>>(new Set());
  const [notificationSettings, setNotificationSettingsState] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  /**
   * Pro as RevenueCat sees it on this device — the client-authoritative half of
   * the entitlement.
   *
   * Entitlement used to be read only from the server (`couples.is_subscribed`,
   * derived from `profiles.is_subscribed`, written asynchronously by the
   * RevenueCat webhook). That column is the right *cross-partner* mirror, but it
   * is the wrong single source of truth for the person who just paid: a fresh
   * purchase stayed locked until the webhook landed, and Restore Purchases emits
   * no webhook at all, so a restored subscription stayed locked forever. Folding
   * this into `couple.isSubscribed` below unlocks the payer immediately while the
   * server keeps unlocking their partner.
   */
  const [proEntitlement, setProEntitlement] = useState(false);
  /** True once `configurePurchases` has resolved — RevenueCat answers nothing before that. */
  const [purchasesReady, setPurchasesReady] = useState(false);
  /**
   * The night the app is working on, pinned when the session starts and rolled
   * forward only when Lunara comes back to the foreground.
   *
   * Every read and write used to call `getToday()` fresh. Someone who opened
   * the app at 11:58pm and tapped Submit at 12:01am had their answers saved by
   * `updateTodayEntry` under one date and their `submitted` flag written by
   * `submitTodayEntry` under the next — two half-rows, neither of them a
   * finished night, and a streak broken by a couple who actually showed up.
   * Pinning it means the whole screen and every write agree on which night this
   * is, for as long as the user is looking at it.
   */
  const [ritualDate, setRitualDate] = useState(getToday);

  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  // Read by callbacks that must not re-create themselves when the session
  // object changes identity (setNotificationSettings, purchase handlers).
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;
  const isDemo = baseCouple?.isDemoMode ?? false;

  // ─── Loading persisted local state ───────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const [onboarding, pays, notifJson, revealedJson, entitlement] = await Promise.all([
          AsyncStorage.getItem(KEYS.ONBOARDING),
          AsyncStorage.getItem(KEYS.WHO_PAYS),
          AsyncStorage.getItem(KEYS.NOTIFICATION_SETTINGS),
          AsyncStorage.getItem(KEYS.REVEALED_DATES),
          AsyncStorage.getItem(KEYS.PRO_ENTITLEMENT),
        ]);
        if (onboarding) setOnboardingComplete(true);
        if (pays) setWhoPaysState(pays as 'me' | 'partner' | 'later');
        if (notifJson) setNotificationSettingsState(JSON.parse(notifJson));
        if (revealedJson) setRevealedDates(new Set(JSON.parse(revealedJson)));
        // Optimistic only. RevenueCat re-answers a beat later and corrects it
        // either way, so a lapsed subscription can't stay unlocked.
        if (entitlement === '1') setProEntitlement(true);
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

  const loadRemoteProfileAndCouple = useCallback(async (userId: string): Promise<RemoteAccountState> => {
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
    const hasProfile = Boolean(profile?.name?.trim());

    const { data: coupleRow } = await supabase.rpc('get_my_couple').maybeSingle();
    const hasCouple = Boolean(coupleRow);
    if (coupleRow) {
      // `get_my_couple` returns the partner's *name* but not their id, and the
      // nudge has to address someone. couple_members is readable for your own
      // couple, so the id comes from there rather than from a schema change.
      const { data: memberRows } = await supabase
        .from('couple_members')
        .select('user_id, name')
        .eq('couple_id', coupleRow.id);
      const partnerRow = (memberRows ?? []).find((m) => m.user_id !== userId);

      setCoupleState({
        id: coupleRow.id,
        partnerName: partnerRow?.name ?? '',
        partnerJoined: Boolean(partnerRow),
        partnerId: partnerRow?.user_id,
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
          .select(ENTRY_COLUMNS)
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

    // Entitlement has to wait for `configurePurchases` — `checkIsPro()` returns
    // false while RevenueCat is unconfigured, which would read as "not Pro".
    void configurePurchases(userId)
      .then(async () => {
        setPurchasesReady(true);
        await refreshEntitlementRef.current?.();
      })
      .catch(() => {});
    void syncPushToken(userId);

    return { hasProfile, hasCouple };
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
      const hadSession = sessionRef.current !== null;
      setSession(nextSession);

      if (nextSession) {
        setSessionExpired(false);
        await loadRemoteProfileAndCouple(nextSession.user.id);
        return;
      }

      /**
       * The session is gone. This branch did not exist: only a truthy session
       * was handled, so a refresh token that failed to renew set `session` to
       * null and left `user`, `couple` and `entries` fully populated. The app
       * looked completely normal — the streak, the partner's name, tonight's
       * cards — while every write silently went nowhere.
       *
       * Two cases reach here and only one is a problem:
       *  - a deliberate `signOut()`, which clears everything itself
       *  - demo mode, which never had a session to lose
       * Both are excluded, so what is left is an involuntary expiry.
       *
       * The stale data is deliberately NOT cleared. What the user has typed
       * tonight is on screen, seeded from `entries`, and wiping it to prove a
       * point would cost them the thing they came here to write. The flag is
       * what the UI acts on; the writes already refuse loudly
       * (`NotSignedInError`), and re-signing in reloads everything anyway.
       */
      if (!hadSession || signingOutRef.current) return;
      setSessionExpired(true);
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
    setRealtimeConnected(false);
    if (!baseCouple || baseCouple.isDemoMode || !session) return;

    /**
     * Each table gets the narrowest refresh that can answer it. Every one of
     * these used to call `refreshSharedState()` — so a partner tapping a
     * reaction re-read the profile, the couple row, both member rows, every
     * entry and every keepsake. Entries change constantly and keepsakes almost
     * never; treating them the same is what made the app feel busy on cellular.
     */
    const channel = supabase
      .channel(`couple:${baseCouple.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entries', filter: `couple_id=eq.${baseCouple.id}` },
        () => { refreshEntriesRef.current?.().catch(() => {}); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'couple_members', filter: `couple_id=eq.${baseCouple.id}` },
        () => { refreshSharedStateRef.current?.(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'keepsakes', filter: `couple_id=eq.${baseCouple.id}` },
        () => { refreshKeepsakesRef.current?.().catch(() => {}); },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'couples', filter: `id=eq.${baseCouple.id}` },
        () => { refreshSharedStateRef.current?.(); },
      )
      .subscribe((status) => {
        // Screens poll only while this is false, so it has to be honest about
        // a channel that errored or timed out rather than optimistic.
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;
    return () => {
      setRealtimeConnected(false);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseCouple?.id, baseCouple?.isDemoMode, session]);

  // ─── Shared-state refresh (foreground / focus / realtime) ─────────────────

  const refreshSharedState = useCallback(async (): Promise<RemoteAccountState | null> => {
    if (!session || isDemo) return null;
    return loadRemoteProfileAndCouple(session.user.id);
  }, [session, isDemo, loadRemoteProfileAndCouple]);

  /**
   * Re-read only the entries table.
   *
   * Submitting a night used to fan out into five full-dataset reloads: the
   * write in `updateTodayEntry` called `refreshSharedState`, the write in
   * `submitTodayEntry` called it again, the screen's focus effect called it, the
   * realtime echo of our own insert called it, and the ten-second poll called it
   * — each one re-reading the profile, the couple, both members, every entry and
   * every keepsake. Nothing about a submitted entry can change a keepsake, so
   * this is the only query the common case actually needs.
   */
  const refreshEntries = useCallback(async (): Promise<void> => {
    const coupleId = baseCouple?.id;
    if (!session || isDemo || !coupleId) return;
    const { data, error } = await supabase
      .from('entries')
      .select(ENTRY_COLUMNS)
      .eq('couple_id', coupleId);
    if (error) throw new Error(error.message);
    setEntries(mergeEntryRows(data ?? [], session.user.id, revealedDates));
  }, [baseCouple?.id, isDemo, revealedDates, session]);

  const refreshKeepsakes = useCallback(async (): Promise<void> => {
    const coupleId = baseCouple?.id;
    if (!session || isDemo || !coupleId) return;
    const { data, error } = await supabase
      .from('keepsakes')
      .select('couple_id, user_id, question_key, answer')
      .eq('couple_id', coupleId);
    if (error) throw new Error(error.message);
    setKeepsakes(mergeKeepsakeRows(data ?? [], session.user.id));
  }, [baseCouple?.id, isDemo, session]);

  const refreshEntriesRef = useRef(refreshEntries);
  useEffect(() => { refreshEntriesRef.current = refreshEntries; }, [refreshEntries]);
  const refreshKeepsakesRef = useRef(refreshKeepsakes);
  useEffect(() => { refreshKeepsakesRef.current = refreshKeepsakes; }, [refreshKeepsakes]);

  /**
   * Re-read the entitlement from RevenueCat's CustomerInfo and unlock (or lock)
   * Pro straight away. Call it after a purchase, after a restore, and whenever
   * the app comes back to the foreground.
   *
   * The answer is cached to AsyncStorage so a Pro user opening the app cold
   * doesn't see their own paid features locked for the moment it takes
   * RevenueCat to configure and answer.
   */
  const refreshEntitlement = useCallback(async (): Promise<boolean> => {
    const entitled = await checkIsPro();
    setProEntitlement(entitled);
    await AsyncStorage.setItem(KEYS.PRO_ENTITLEMENT, entitled ? '1' : '0').catch(() => {});
    return entitled;
  }, []);

  const refreshEntitlementRef = useRef(refreshEntitlement);
  useEffect(() => { refreshEntitlementRef.current = refreshEntitlement; }, [refreshEntitlement]);

  // RevenueCat tells us about renewals, lapses, and purchases made on the
  // user's other device without anyone asking.
  useEffect(() => {
    // Waits on `purchasesReady`: `onEntitlementChange` is a no-op before
    // RevenueCat is configured, and configuring it is async.
    if (!session || !purchasesReady) return;
    return onEntitlementChange((entitled) => {
      setProEntitlement(entitled);
      void AsyncStorage.setItem(KEYS.PRO_ENTITLEMENT, entitled ? '1' : '0').catch(() => {});
    });
  }, [session, purchasesReady]);

  const refreshSharedStateRef = useRef(refreshSharedState);
  useEffect(() => { refreshSharedStateRef.current = refreshSharedState; }, [refreshSharedState]);

  /**
   * Keep the rolling nightly reminders in step with tonight's state.
   *
   * `entries` is a fresh array on every refresh, and while a couple waits for
   * their partner the app refreshed constantly — so this effect re-ran every
   * few seconds, and each run walked the OS's pending list and re-laid up to
   * thirty dated notifications. Somewhere around sixty native calls every ten
   * seconds, for a schedule that had not changed once.
   *
   * Only four things can actually change what should be scheduled, so the
   * effect works off a signature of exactly those and no-ops otherwise.
   */
  const reminderSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    if (isLoading) return;
    const submittedTonight = entries.some((e) => e.date === ritualDate && e.submitted);
    const signature = [
      notificationSettings.enabled ? '1' : '0',
      notificationSettings.reminderHour,
      notificationSettings.reminderMinute,
      ritualDate,
      submittedTonight ? '1' : '0',
    ].join('|');
    if (reminderSignatureRef.current === signature) return;
    reminderSignatureRef.current = signature;

    if (!notificationSettings.enabled) return;
    const promise = submittedTonight
      ? scheduleNightlyReminder(notificationSettings.reminderHour, notificationSettings.reminderMinute, { skipToday: true })
      : refreshNightlyReminder(notificationSettings.reminderHour, notificationSettings.reminderMinute);
    promise.catch(() => {});
  }, [entries, isLoading, notificationSettings, ritualDate]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        // A new foreground is a new session — this is where the night is
        // allowed to become tomorrow.
        setRitualDate(getToday());
        refreshSharedStateRef.current?.().catch(() => {});
        refreshEntitlementRef.current?.().catch(() => {});
      }
    });
    return () => subscription.remove();
  }, []);

  const todayEntry = entries.find((e) => e.date === ritualDate) ?? null;

  /**
   * The streak, derived on the client for *every* couple — demo and paired
   * alike — rather than read off `couples.current_streak`.
   *
   * Two reasons it can't just be the server value:
   *
   *  - The server recomputes from `current_date` in UTC and anchors the run to
   *    today, so a couple on 40 nights saw "0 nights" from midnight until they
   *    finished that evening. Loss aversion needs the streak to read as *at
   *    risk*, not as already gone.
   *  - The entries RLS returns a partner's row for exactly the dates both
   *    partners submitted, which is precisely the input the streak needs. So
   *    the client already has everything required to be right.
   *
   * The server value stays authoritative for anything server-side; the
   * migration alongside this change brings it in line with the same rules.
   */
  const streakState = React.useMemo(
    () => computeStreakState(completedDates(entries), ritualDate),
    [entries, ritualDate],
  );

  /**
   * `couple`, with the derived streak folded in — every screen that already
   * reads `couple.currentStreak` gets the corrected value without knowing about
   * `streakState`.
   *
   * Derived rather than synced back with an effect: `refreshSharedState` writes
   * the server's `current_streak` onto `couple` on every focus, foreground and
   * realtime event, so an effect would have to race it forever. A computed
   * value simply wins every time.
   */
  const couple = React.useMemo(() => {
    if (!baseCouple) return null;
    return {
      ...baseCouple,
      currentStreak: streakState.current,
      longestStreak: Math.max(streakState.longest, baseCouple.longestStreak),
      // Either half can unlock Pro: the server value covers the partner who
      // didn't pay, the RevenueCat value covers the one who did — immediately,
      // and without waiting for a webhook that a restore never sends.
      isSubscribed: baseCouple.isSubscribed || proEntitlement,
    };
  }, [baseCouple, proEntitlement, streakState.current, streakState.longest]);

  /**
   * Keep the iOS home screen widget in sync. The status mirrors exactly what
   * the Tonight screen would show, so a glance at the home screen and a tap
   * into the app never disagree about where the night stands.
   *
   * Guarded by a signature because `updateWidgetData` ends in
   * `reloadWidget()`, and WidgetKit gives an app a *daily budget* of reloads.
   * `couple` and `streakState` are both recomputed objects, so this effect
   * re-ran on every refresh and spent that budget within the first hour —
   * after which the widget froze on whatever it happened to be showing. The
   * irony was exact: reloading it constantly is what made it stale.
   */
  const widgetSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    const status: WidgetStatus = !isPartnerJoined(couple)
      ? 'unpaired'
      : todayEntry?.revealed
        ? 'complete'
        : todayEntry?.submitted
          ? (todayEntry.partnerSubmitted ? 'ready' : 'waiting')
          : 'open';
    const data = {
      streak: streakState.current,
      status,
      atRisk: streakState.atRisk,
      streakProtected: streakState.protectedDate !== null,
      // Same derivation the app uses, so the fox on the home screen and the
      // fox inside the app are never in two different moods.
      companion: getCompanionState({
        mySubmitted: todayEntry?.submitted ?? false,
        partnerSubmitted: todayEntry?.partnerSubmitted ?? false,
        bothRevealed: todayEntry?.revealed ?? false,
        streak: streakState.current,
        lastCompletedAt: lastCompletedDate(entries),
        now: ritualDate,
        partnerJoined: isPartnerJoined(couple),
      }),
    };
    const signature = JSON.stringify(data);
    if (widgetSignatureRef.current === signature) return;
    widgetSignatureRef.current = signature;
    updateWidgetData(data);
  }, [
    couple,
    entries,
    ritualDate,
    streakState,
    todayEntry?.revealed,
    todayEntry?.submitted,
    todayEntry?.partnerSubmitted,
  ]);

  /**
   * Tonight's streak-protection nudge, re-evaluated whenever the picture
   * changes. `refreshStreakProtection` cancels before it schedules, so this is
   * idempotent — and it clears itself the moment the night is complete.
   */
  useEffect(() => {
    if (isLoading) return;
    refreshStreakProtection({
      enabled: notificationSettings.enabled,
      streak: streakState.current,
      todayComplete: streakState.todayComplete,
      reminderHour: notificationSettings.reminderHour,
      reminderMinute: notificationSettings.reminderMinute,
    }).catch(() => {
      // The most optional notification in the app — never worth surfacing.
    });
  }, [isLoading, notificationSettings, streakState.current, streakState.todayComplete]);

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
    if (!isGoogleSignInConfigured()) {
      throw new Error('Google sign-in isn’t available in this build. Try Apple, phone, or email.');
    }
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

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) throw new Error(error.message);
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
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
      partnerName: '',
      partnerJoined: false,
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
      partnerName: '',
      partnerJoined: false,
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
    const today = ritualDate;

    if (isDemo) {
      const existing = entries.find((e) => e.date === today);
      const next = { ...(existing ?? emptyEntry(today, true)), ...updates };
      await persistDemoEntries(entries.some((e) => e.date === today)
        ? entries.map((e) => (e.date === today ? next : e))
        : [...entries, next]);
      return;
    }

    if (!session) throw new NotSignedInError();
    if (!couple) throw new Error('Connect with your partner before saving a night.');
    const existing = entries.find((e) => e.date === today);
    const merged = { ...(existing ?? emptyEntry(today)), ...updates };
    const { error } = await supabase
      .from('entries')
      .upsert(entryUpsertPayload(couple.id, today, session.user.id, merged), {
        onConflict: 'couple_id,date,user_id',
      });
    if (error) throw new Error(error.message);
    await refreshEntries();
  }, [ritualDate, couple, entries, isDemo, persistDemoEntries, refreshEntries, session]);

  const submitTodayEntry = useCallback(async (updates: Partial<DailyEntry> = {}) => {
    const today = ritualDate;

    if (isDemo) {
      const existing = entries.find((e) => e.date === today);
      const next = { ...(existing ?? emptyEntry(today, true)), ...updates, submitted: true };
      await persistDemoEntries(entries.some((e) => e.date === today)
        ? entries.map((e) => (e.date === today ? next : e))
        : [...entries, next]);
      // Streak is derived from entries by the effect below — no manual bump needed.
    } else {
      if (!session) throw new NotSignedInError();
      if (!couple) throw new Error('Connect with your partner before saving a night.');
      const existing = entries.find((e) => e.date === today);
      const merged = { ...(existing ?? emptyEntry(today)), ...updates, submitted: true };
      const { error } = await supabase
        .from('entries')
        .upsert(entryUpsertPayload(couple.id, today, session.user.id, merged), {
          onConflict: 'couple_id,date,user_id',
        });
      if (error) throw new Error(error.message);
      await refreshEntries();
    }

    if (notificationSettings.enabled) {
      await scheduleNightlyReminder(notificationSettings.reminderHour, notificationSettings.reminderMinute, { skipToday: true });
    } else {
      await cancelNightlyReminder();
    }
    // Your half is in — nothing about tonight should nag you again.
    await cancelStreakProtection();
  }, [ritualDate, couple, entries, isDemo, notificationSettings, persistDemoEntries, refreshEntries, session]);

  const revealTodayEntry = useCallback(async () => {
    const today = ritualDate;
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
  }, [ritualDate, entries, isDemo, persistDemoEntries]);

  const setMyReaction = useCallback(async (reaction: string) => {
    const today = ritualDate;
    const existing = entries.find((e) => e.date === today);
    if (!existing) return;

    if (isDemo) {
      await persistDemoEntries(entries.map((e) => (e.date === today ? { ...e, myReaction: reaction } : e)));
      return;
    }

    // Was `if (!session || !couple) return;` — the last silent no-op of the
    // three. The reveal screen highlights the reaction from local state, so a
    // signed-out user watched their choice light up and stay lit while nothing
    // was written. Same contract as the other two writes now: refuse out loud.
    if (!session) throw new NotSignedInError();
    if (!couple) throw new Error('Connect with your partner before saving a reaction.');
    const { error } = await supabase
      .from('entries')
      .upsert(entryUpsertPayload(couple.id, today, session.user.id, { ...existing, myReaction: reaction }), {
        onConflict: 'couple_id,date,user_id',
      });
    if (error) throw new Error(error.message);
    await refreshEntries();
  }, [ritualDate, couple, entries, isDemo, persistDemoEntries, refreshEntries, session]);

  /**
   * Attach or clear a voice note on one of tonight's cards. The upload itself
   * already happened (lib/voiceNotes.ts) — this only persists the resulting
   * path, so it rides the same write path and reveal gate as the text.
   */
  const setVoiceNote = useCallback(async (slot: VoiceSlot, path: string | null) => {
    const field = slot === 'grateful' ? 'voiceGrateful' : slot === 'cute' ? 'voiceCute' : 'voiceGrow';
    await updateTodayEntry({ [field]: path } as Partial<DailyEntry>);
  }, [updateTodayEntry]);

  /**
   * Save the next-day Grow check-back reply onto the day it's about, so it
   * shows up in Moments beside the Grow note that prompted it. Targets a past
   * date, so it updates an existing row rather than upserting a new one — if
   * that day was never submitted there is nothing to check back on.
   */
  const setGrowFollowUp = useCallback(async (date: string, response: GrowFollowUpResponse) => {
    if (isDemo) {
      if (!entries.some((e) => e.date === date)) return;
      await persistDemoEntries(
        entries.map((e) => (e.date === date ? { ...e, growFollowUp: response } : e)),
      );
      return;
    }

    if (!session || !couple) return;
    const { error } = await supabase
      .from('entries')
      .update({ grow_followup: response, grow_followup_at: new Date().toISOString() })
      .eq('couple_id', couple.id)
      .eq('date', date)
      .eq('user_id', session.user.id);
    if (error) throw new Error(error.message);
    await refreshEntries();
  }, [couple, entries, isDemo, persistDemoEntries, refreshEntries, session]);

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
    await refreshKeepsakes();
  }, [couple, isDemo, keepsakes, refreshKeepsakes, session]);

  const checkMilestone = useCallback(async (): Promise<number | null> => {
    const streak = streakState.current;
    if (!couple || !STREAK_MILESTONES.includes(streak)) return null;
    const marker = `${couple.id}:${streak}`;
    const raw = await AsyncStorage.getItem(KEYS.CELEBRATED_MILESTONES);
    const celebrated: string[] = raw ? JSON.parse(raw) : [];
    if (celebrated.includes(marker)) return null;
    await AsyncStorage.setItem(KEYS.CELEBRATED_MILESTONES, JSON.stringify([...celebrated, marker]));
    return streak;
  }, [couple, streakState.current]);

  /**
   * The "send a gentle nudge" button, which until now invoked the edge
   * function with an empty body — the function requires a target and a couple,
   * so every nudge 400'd and the UI cheerfully reported "Nudge sent!" anyway.
   *
   * Throws on failure so the caller can tell the truth about what happened.
   */
  const sendNudge = useCallback(async () => {
    if (isDemo) return;
    if (!couple?.partnerId) {
      throw new Error('Your partner hasn’t joined yet, so there’s no one to nudge.');
    }
    const { data, error } = await supabase.functions.invoke<NudgeResult>('send-nudge', {
      body: { target_user_id: couple.partnerId, couple_id: couple.id },
    });

    // Two ways this can fail without throwing: a non-2xx (supabase-js hands it
    // back as `error` with the raw Response on `error.context`), and a 200 body
    // that says `sent: false`. Both used to slip through as success, and the
    // waiting screen would promise a ping that never left. Treat anything that
    // is not an explicit `sent: true` as a failure.
    if (error) {
      throw new Error(nudgeFailureMessage(await readNudgeReason(error)));
    }
    if (!data?.sent) {
      throw new Error(nudgeFailureMessage(data?.reason));
    }
  }, [couple?.id, couple?.partnerId, isDemo]);

  // ─── Notifications / sign out ──────────────────────────────────────────────

  const registerPushToken = useCallback(async () => {
    const userId = sessionRef.current?.user.id;
    if (!userId) return;
    await syncPushToken(userId);
  }, []);

  const setNotificationSettings = useCallback(async (settings: NotificationSettings) => {
    await AsyncStorage.setItem(KEYS.NOTIFICATION_SETTINGS, JSON.stringify(settings));
    setNotificationSettingsState(settings);
    if (settings.enabled) {
      await scheduleNightlyReminder(settings.reminderHour, settings.reminderMinute);
      // Turning reminders on is the other moment the OS permission prompt can
      // be answered — someone who declined at sign-in and says yes here would
      // otherwise never get a token onto their profile row.
      const userId = sessionRef.current?.user.id;
      if (userId) await syncPushToken(userId);
    } else {
      await cancelNightlyReminder();
      await cancelStreakProtection();
    }
  }, []);

  const signOut = useCallback(async () => {
    // Tells the auth listener that the session about to disappear was asked to.
    signingOutRef.current = true;
    // Tolerate a session the server has already invalidated. `deleteAccount`
    // calls through here *after* the auth user is gone, and supabase-js raises
    // on a missing session — which would abort the teardown below and leave a
    // deleted account's data cached on the device.
    await supabase.auth.signOut().catch(() => {});
    setSessionExpired(false);
    await logOutPurchases();
    await AsyncStorage.multiRemove(Object.values(KEYS));
    await cancelNightlyReminder();
    await cancelStreakProtection();
    setOnboardingComplete(false);
    setWhoPaysState(null);
    setUserState(null);
    setCoupleState(null);
    setEntries([]);
    setKeepsakes([]);
    setRevealedDates(new Set());
    setNotificationSettingsState(DEFAULT_NOTIFICATION_SETTINGS);
    setProEntitlement(false);
    signingOutRef.current = false;
  }, []);

  const exitDemoMode = useCallback(async () => {
    // Only the demo keys — the signed-in session, onboarding flag and
    // notification preferences all survive, so leaving the demo drops the user
    // on the pairing screen rather than back at the very beginning.
    await AsyncStorage.multiRemove([
      KEYS.DEMO_USER,
      KEYS.DEMO_COUPLE,
      KEYS.DEMO_ENTRIES,
      KEYS.DEMO_KEEPSAKES,
    ]);
    setCoupleState(null);
    setEntries([]);
    setKeepsakes([]);
    setRevealedDates(new Set());
    // Re-read the real account if there is one behind the demo.
    if (sessionRef.current) {
      await refreshSharedState().catch(() => {});
    }
  }, [refreshSharedState]);

  const deleteAccount = useCallback(async () => {
    // Demo mode has no server-side account — clearing local storage IS the
    // deletion, and invoking the function would fail on a missing session.
    if (isDemo) {
      signingOutRef.current = true;
      await AsyncStorage.multiRemove(Object.values(KEYS));
      await cancelNightlyReminder();
      await cancelStreakProtection();
      setOnboardingComplete(false);
      setWhoPaysState(null);
      setUserState(null);
      setCoupleState(null);
      setEntries([]);
      setKeepsakes([]);
      setRevealedDates(new Set());
      setNotificationSettingsState(DEFAULT_NOTIFICATION_SETTINGS);
      setProEntitlement(false);
      signingOutRef.current = false;
      return;
    }

    if (!sessionRef.current) throw new NotSignedInError();

    const { data, error } = await supabase.functions.invoke<{ deleted?: boolean; error?: string }>(
      'delete-account',
      { body: {} },
    );

    // Same trap as the nudge: supabase-js only populates `error` on a non-2xx,
    // so a 200 body that doesn't say `deleted: true` has to be treated as a
    // failure too. Nothing here may report success it isn't sure of.
    if (error) {
      const reason = await readNudgeReason(error);
      throw new Error(reason ?? 'We could not delete your account just now. Please try again.');
    }
    if (!data?.deleted) {
      throw new Error(data?.error ?? 'We could not delete your account just now. Please try again.');
    }

    // The account is gone; tear the local session down the same way a
    // deliberate sign-out does, so nothing is left cached on the device.
    await signOut();
  }, [isDemo, signOut]);

  return (
    <AppContext.Provider
      value={{
        isLoading,
        onboardingComplete,
        ritualDate,
        realtimeConnected,
        whoPays,
        user,
        couple,
        entries,
        todayEntry,
        keepsakes,
        streakState,
        notificationSettings,
        sessionExpired,
        completeOnboarding,
        setWhoPays,
        signInWithApple,
        signInWithGoogle,
        sendPhoneOtp,
        verifyPhoneOtp,
        signUpWithEmail,
        signInWithEmail,
        updateProfile,
        setCouple,
        createCouple,
        joinCouple,
        refreshSharedState,
        refreshEntries,
        refreshEntitlement,
        canPurchase: !isDemo,
        updateTodayEntry,
        submitTodayEntry,
        revealTodayEntry,
        setMyReaction,
        setVoiceNote,
        setGrowFollowUp,
        saveKeepsakeAnswer,
        checkMilestone,
        sendNudge,
        registerPushToken,
        exitDemoMode,
        deleteAccount,
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
