import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '@/context/AppContext';
import { completedDates } from '@/lib/streak';
import { isPro } from '@/lib/entitlements';
import { shouldOfferPremium } from '@/lib/paywallMoment';

/**
 * The one time Lunara brings up Premium by itself.
 *
 * Follows the split `hooks/useGrowth.ts` established: the *rule* is a pure
 * function in `lib/paywallMoment.ts` and can be reasoned about without a
 * renderer; the *"have we asked"* flag is per-device, unimportant, and lives in
 * AsyncStorage under a versioned key.
 *
 * Works in demo mode for free — it reads `entries` and `couple`, both of which
 * `AppContext` already backs with AsyncStorage for demo couples.
 *
 * `ready` exists so the caller can render nothing until the stored flag has
 * actually loaded. Without it the first frame after launch would decide
 * "never asked" for everyone and could flash a paywall prompt at someone who
 * declined it weeks ago.
 */

const ASKED_KEY = 'lunara_premium_offered_v1';

export interface UsePaywallMomentResult {
  /** True only in the afterglow of a finished night, once, after day 3. */
  shouldOffer: boolean;
  /** Record that the offer was shown. Call when it goes on screen, not on tap. */
  markOffered: () => void;
  ready: boolean;
}

export function usePaywallMoment(): UsePaywallMomentResult {
  const { couple, entries, todayEntry } = useApp();
  const [asked, setAsked] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(ASKED_KEY);
        if (stored === '1') setAsked(true);
      } catch {
        // An unreadable flag means we may ask again. That is the safe side of
        // this particular failure: a duplicate prompt is a papercut, and
        // suppressing it forever on a storage hiccup silently kills the only
        // proactive place Premium is ever mentioned.
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const markOffered = useCallback(() => {
    setAsked(true);
    AsyncStorage.setItem(ASKED_KEY, '1').catch(() => {
      // Worst case it is offered once more on the next finished night.
    });
  }, []);

  const shouldOffer =
    ready &&
    shouldOfferPremium({
      isPro: isPro(couple),
      alreadyAsked: asked,
      tonightRevealed: todayEntry?.revealed ?? false,
      sharedNights: completedDates(entries).length,
    });

  return { shouldOffer, markOffered, ready };
}
