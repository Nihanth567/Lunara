/**
 * The arithmetic behind the paywall's plan copy: the trial phrase on the CTA
 * and the yearly saving.
 *
 * Every input is a number the store reported through RevenueCat (`price`,
 * `introPrice`), never a price written into the app. Prices and trials are set
 * in App Store Connect and Play Console; this file only describes what they
 * say, so the copy stays true in every storefront and currency. Kept pure so
 * it can be tested — see lib/pricing.test.ts.
 */

/** RevenueCat's `introPrice.periodUnit`. */
export type TrialUnit = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | (string & {});

/** Weeks in a billing year, for comparing a weekly price against a yearly one. */
export const WEEKS_PER_YEAR = 52;

/**
 * A free trial's length in days, for the lede ("Free for 21 days") and for
 * analytics. Days and weeks are exact; months and years are the usual
 * approximations. `null` for anything the store reports that isn't a length.
 */
export function trialDays(unit: TrialUnit, units: number): number | null {
  if (!Number.isFinite(units) || units <= 0) return null;
  switch (unit) {
    case 'DAY':
      return units;
    case 'WEEK':
      return units * 7;
    case 'MONTH':
      return units * 30;
    case 'YEAR':
      return units * 365;
    default:
      return null;
  }
}

/**
 * The trial as a compound adjective: "21-day", "1-month".
 *
 * Days and weeks are both said in days, because a store can report a 21-day
 * trial as 21 DAY or as 3 WEEK depending on how it was set up, and the button
 * should read "Start 21-day free trial" either way. The unit stays singular
 * inside the compound: the previous label pluralised it, so the CTA read
 * "Start 21-Days Free Trial".
 */
export function trialLength(unit: TrialUnit, units: number): string | null {
  if (!Number.isFinite(units) || units <= 0) return null;
  if (unit === 'DAY' || unit === 'WEEK') return `${trialDays(unit, units)}-day`;
  if (unit === 'MONTH') return `${units}-month`;
  if (unit === 'YEAR') return `${units}-year`;
  return null;
}

/**
 * What the yearly plan saves against paying weekly for a year, as a whole
 * percentage: $2.99 × 52 = $155.48 against $48 is a 69.1% saving, so 69.
 *
 * Rounded down, so the badge never claims a point more than the two prices
 * give. The tiny epsilon keeps binary floating point from turning an exact
 * 29% into 28.999… and flooring it to 28. `null` when there is no real saving
 * to state, so the paywall never shows "Save 0%".
 */
export function yearlySavingsPercent(weeklyPrice: number, yearlyPrice: number): number | null {
  if (!(weeklyPrice > 0) || !(yearlyPrice > 0)) return null;
  const saving = (1 - yearlyPrice / (weeklyPrice * WEEKS_PER_YEAR)) * 100;
  const whole = Math.floor(saving + 1e-9);
  return whole >= 1 ? whole : null;
}
