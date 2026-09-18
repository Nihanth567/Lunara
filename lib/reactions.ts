import { palette } from '@/constants/colors';

/**
 * The one-tap reaction you leave on a night after it opens.
 *
 * ─── Why this is its own file ────────────────────────────────────────────────
 *
 * The table used to live inside `app/reveal.tsx`, which is where reactions are
 * *written*. But `app/moment/[date].tsx` reads them back months later, and with
 * no shared definition it rendered the raw stored string into a sentence of its
 * own devising. That worked while every label happened to be an adjective and
 * broke the moment one wasn't — "Sam felt laughed" is what you get when the
 * writer and the reader of a value don't share a type.
 *
 * So: one table, imported by both. Anything that stores a reaction and anything
 * that displays one comes through here.
 *
 * ─── Three, and each one is a different feeling ──────────────────────────────
 *
 * The set was Love / Hug / Warm / Star — one emotion and three synonyms. Nobody
 * chooses between "warm" and "star", so the row read as decoration and got
 * tapped at random. Love, laughter and missing someone are genuinely different
 * responses to reading what your partner wrote, so picking one says something.
 * That is the whole difference between a reaction and a rating.
 *
 * Adding a fourth is a product decision, not a styling one: four options is the
 * point where a row stops being a feeling and starts being a menu.
 */
export interface Reaction {
  /** Ionicons name. */
  icon: string;
  /** The stored value, and what is shown back. First person, short. */
  label: string;
  color: string;
}

export const REACTIONS: Reaction[] = [
  { icon: 'heart', label: 'Love', color: palette.accent.heart },
  { icon: 'happy', label: 'Laughed', color: palette.accent.streak },
  { icon: 'moon', label: 'Missed you', color: palette.accent.moon },
];

/**
 * Reactions stored by earlier versions, so a night from before this change
 * still renders as something rather than as a bare unstyled string.
 *
 * Deliberately kept rather than migrated. These are a couple's own record of
 * how a night landed — rewriting them in the database to fit a newer set of
 * words would be editing their memory to suit our UI. They are read-only
 * history: displayable, no longer selectable.
 */
const LEGACY: Record<string, Reaction> = {
  Hug: { icon: 'hand-left', label: 'Hug', color: palette.accent.heart },
  Warm: { icon: 'sunny', label: 'Warm', color: palette.accent.streak },
  Star: { icon: 'star', label: 'Star', color: palette.accent.success },
};

/**
 * Resolve a stored reaction to something renderable. Never returns null for a
 * non-empty string — an unrecognised value (a future label, a hand-edited row)
 * falls back to its own text in the neutral ink rather than disappearing, so a
 * night can't silently lose the reaction it was given.
 */
export function resolveReaction(stored: string | null | undefined): Reaction | null {
  if (!stored) return null;
  return (
    REACTIONS.find((r) => r.label === stored) ??
    LEGACY[stored] ?? { icon: 'ellipse', label: stored, color: palette.content[1] }
  );
}
