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
 * Three drawings are in use — `nesting`, `waiting` and `sleeping`. All three
 * hold the established character (indigo-plum fur, cream markings, the same
 * flat cel-shaded style) and all three carry a real alpha channel. The seven
 * states map onto them by energy; see the note above the table.
 *
 * ─── Why `ready` and `streaklit` are no longer wired to their own art ────────
 *
 * `fox_ready.png` / `ready.png` and `fox_streaklit.png` / `streaklit.png` exist
 * and are wired to nothing. They were generated against a different prompt and
 * they are, quite plainly, a different animal: `ready` is a golden fire-fox in
 * a painterly style, `streaklit` is a leaner fox mid-leap with a different
 * muzzle and a motion-blur treatment. Neither is indigo-plum, neither is cel
 * shaded, and neither reads as the creature on the welcome screen.
 *
 * The previous version of this file wired them in anyway and left a note
 * saying they violated the "same fox, seven moods" rule and should be
 * regenerated. Seen on a real screen, the note undersells it. `streaklit` is
 * the state *most* couples see most often — a live streak with tonight still
 * open is simply what an evening looks like before anyone writes anything — so
 * the effect was that the app's single most frequent fox was the wrong fox,
 * and it looked like stock fantasy art rather than the product's own character.
 *
 * One consistent animal in four moods beats seven moods of three animals. When
 * on-character `ready` and `streaklit` art is generated against the
 * character-lock prompt in README → "Generation prompts", wire it back here and
 * nothing else has to change. The raw originals are left in place as source,
 * unused by any `require`, so they cost nothing in the bundle.
 *
 * ─── What is still worth fixing ──────────────────────────────────────────────
 *
 * `nesting` is close enough in posture to `sleeping` (curled, eyes closed) that
 * the two are hard to tell apart at 44pt, even though the brief calls for
 * `nesting` to read as awake and settled rather than asleep.
 */

/**
 * Three poses, mapped by *energy* rather than one pose for everything.
 *
 * The first attempt at this fallback pointed four states at a single image.
 * That put the curled, eyes-closed `nesting` fox on the reveal — the app's
 * happiest moment, the one screen where both people showed up and the creature
 * is supposed to be at its brightest — and a sleeping animal there is not a
 * neutral choice, it is the wrong emotion at the highest-stakes moment.
 *
 * So the seven states share three drawings, grouped by what the animal is
 * actually *doing*:
 *
 *   curled and settled   → `nesting`   (nesting, resting)
 *   awake, up, lit       → `waiting`   (waiting, ready, glowing, streaklit)
 *   asleep               → `sleeping`  (sleeping)
 *
 * States inside a group are never confusable, because the pose is not what
 * distinguishes them: `CoupleCompanion` gives each its own halo colour and
 * opacity, its own breath rate and its own line of copy. `waiting` is apricot
 * and says "Holding a light for them"; `glowing` is apricot at nearly twice the
 * opacity and says "Tonight is shared"; `streaklit` is gold. Same fox, four
 * different lights on it — which is the premise of the whole feature.
 *
 * ─── Why not `fox.png` ───────────────────────────────────────────────────────
 *
 * It is the file named for the job and it is the wrong shape: a 768×1152
 * portrait crop with the animal running off the bottom edge, so at hero size it
 * renders as a fox sliced horizontally through the chest. Correct character,
 * unusable framing. It is left in the folder, wired to nothing.
 */
const CURLED = require('./nesting.png');
const AWAKE = require('./waiting.png');
const ASLEEP = require('./sleeping.png');

export const FOX_ART: Partial<Record<CompanionState, ImageSourcePropType>> = {
  // Curled and settled — nothing has happened yet, or nothing lately.
  nesting: CURLED,
  resting: CURLED,

  // Up and lit. The four states where the evening is actually moving.
  waiting: AWAKE,
  ready: AWAKE,
  glowing: AWAKE,
  streaklit: AWAKE,

  // Properly asleep. A thing a healthy animal does.
  sleeping: ASLEEP,
};
