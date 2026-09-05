import type { Couple } from '@/context/AppContext';

/**
 * Placeholder that older builds (and cached AsyncStorage couples) stored in
 * `partnerName` before a partner had actually joined. It leaked straight into
 * user-facing copy — "Waiting for Waiting..." — so it is treated here as the
 * absence of a name rather than a name.
 */
const LEGACY_PLACEHOLDERS = new Set(['waiting...', 'waiting', 'partner', '']);

/** Has a second person actually joined this couple? */
export function isPartnerJoined(couple: Couple | null | undefined): boolean {
  if (!couple) return false;
  // `partnerJoined` is authoritative once present; fall back to sniffing the
  // name so couples cached by an older build still resolve correctly.
  if (typeof couple.partnerJoined === 'boolean') return couple.partnerJoined;
  return !LEGACY_PLACEHOLDERS.has((couple.partnerName ?? '').trim().toLowerCase());
}

/**
 * The name to use inside a sentence. Never returns a placeholder, so copy like
 * `Waiting for {partnerLabel(couple)}` is always readable — it degrades to
 * "your partner" rather than to a bug.
 *
 * Use `fallback: 'Partner'` where the label is a standalone byline rather than
 * part of a sentence.
 */
export function partnerLabel(
  couple: Couple | null | undefined,
  fallback = 'your partner',
): string {
  if (!isPartnerJoined(couple)) return fallback;
  const name = (couple?.partnerName ?? '').trim();
  return name.length > 0 ? name : fallback;
}
