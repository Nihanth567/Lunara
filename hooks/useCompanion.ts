import { useApp } from '@/context/AppContext';
import { isPartnerJoined } from '@/lib/partner';
import {
  companionLabel,
  companionSubtitle,
  companionTier,
  getCompanionState,
  lastCompletedDate,
  type CompanionState,
  type CompanionTier,
} from '@/lib/companion';

export interface CompanionSnapshot {
  state: CompanionState;
  /** The shared streak, straight from `streakState` — never a second counter. */
  streak: number;
  tier: CompanionTier;
  /** Short label, already correct about which partner a night is waiting on. */
  label: string;
  subtitle: string;
}

/**
 * The companion, wired to the app's existing truth.
 *
 * The only place that knows how to get from `AppContext` to a `CompanionState`,
 * so every surface renders the same creature and none of them can drift. Works
 * in demo mode for free: it reads `entries`, `todayEntry` and `streakState`,
 * all of which `AppContext` already backs with AsyncStorage for demo couples.
 *
 * Deliberately does no fetching, no storage and no scheduling. If this hook ever
 * needs a network call, the state machine has stopped being derived.
 */
export function useCompanion(): CompanionSnapshot {
  const { couple, entries, todayEntry, streakState, ritualDate } = useApp();

  const mySubmitted = todayEntry?.submitted ?? false;
  const partnerSubmitted = todayEntry?.partnerSubmitted ?? false;
  const streak = streakState.current;

  const state = getCompanionState({
    mySubmitted,
    partnerSubmitted,
    bothRevealed: todayEntry?.revealed ?? false,
    streak,
    lastCompletedAt: lastCompletedDate(entries),
    // `ritualDate`, not `todayKey()` — the night being written, so an 11:58pm
    // submit doesn't put the companion on a different day from the ritual.
    now: ritualDate,
    partnerJoined: isPartnerJoined(couple),
  });

  const waitingOn = mySubmitted && !partnerSubmitted ? 'partner' : 'you';

  return {
    state,
    streak,
    tier: companionTier(streak),
    label: companionLabel(state, { streak, waitingOn }),
    subtitle: companionSubtitle(state, { streak }),
  };
}
