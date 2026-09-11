import type { ImageSourcePropType } from 'react-native';
import type { CompanionState } from '@/lib/companion';

/**
 * The night fox, one image per state.
 *
 * ─── This file is the entire handoff ─────────────────────────────────────────
 *
 * It is empty on purpose when there's nothing to show. Until art lands for a
 * given state, `NightFoxArt` falls back to its vector placeholder and the app
 * is fully working — the state machine, the placements, the motion and the
 * copy are all already done and none of them read this file for anything but
 * a picture.
 *
 * `require` rather than a dynamic path because Metro resolves asset requires at
 * bundle time; a computed filename silently ships nothing.
 *
 * ─── Where this stands right now ─────────────────────────────────────────────
 *
 * Two dedicated poses exist — `waiting.png` and `sleeping.png` — matched to
 * the states their filenames and posture best fit. Every other state falls
 * back to the single generic `fox.png`.
 *
 * Known tradeoff on the fallback states: posture stops carrying state there.
 * `ready`/`glowing`/`streaklit`/`nesting`/`resting` will all show the same
 * generic pose rather than the one the design calls for. See README →
 * "Posture carries the state, not opacity". Fine as a first pass, not the end
 * state — replace a fallback line below with its own `require(...)` as each
 * pose lands, same as `waiting`/`sleeping` already did.
 *
 * `waiting.png` and `sleeping.png` were both delivered as opaque exports (solid
 * background, no alpha) with a "Made with AI" badge baked into a corner — not
 * usable as-is. Both were reprocessed (flood-filled to transparent, badge
 * region cleared, trimmed to content) before landing here; the raw originals
 * (`fox_patient.png`, `fox_sleeping.png`) are left alongside as source, unused
 * by any `require` so they cost nothing in the bundle.
 */

const FOX = require('./fox.png');

export const FOX_ART: Partial<Record<CompanionState, ImageSourcePropType>> = {
  // ─── Dedicated poses ──────────────────────────────────────────────────────
  waiting: require('./waiting.png'),
  sleeping: require('./sleeping.png'),

  // ─── Falling back to the generic single image ────────────────────────────
  nesting: FOX,
  ready: FOX,
  glowing: FOX,
  streaklit: FOX,
  resting: FOX,
};
