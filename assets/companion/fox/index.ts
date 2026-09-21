import type { ImageSourcePropType } from 'react-native';
import type { CompanionState } from '@/lib/companion';

/**
 * The night fox, one image per state.
 *
 * ─── This file is the entire handoff ─────────────────────────────────────────
 *
 * `NightFoxArt` reads this table and nothing else. Its vector placeholder is
 * still in place behind it, so a missing or unreadable asset degrades to a
 * working screen rather than a blank one — but every state now has its own
 * drawing, so that path is a safety net rather than a stage of the project.
 *
 * `require` rather than a dynamic path because Metro resolves asset requires at
 * bundle time; a computed filename silently ships nothing.
 *
 * ─── Where this stands right now ─────────────────────────────────────────────
 *
 * Seven drawings for seven states. One animal: indigo-violet fur with gold
 * star specks, cream ruff and inner ears, cream tail tip, amber eyes, flat
 * cel shading. Five were generated against `waiting` as an image reference so
 * the character carries; `waiting` and `sleeping` are the two originals that
 * established it and are unchanged apart from being re-squared.
 *
 * ─── What changed, and why it mattered ───────────────────────────────────────
 *
 * The previous version of this file pointed seven states at three drawings,
 * because the art that existed for `ready` and `streaklit` was, quite plainly,
 * a different animal — a golden fire-fox in a painterly style and a leaner fox
 * mid-leap. Neither was indigo-plum, neither was cel shaded. `streaklit` is the
 * state *most* couples see most often (a live streak with tonight still open is
 * simply what an evening looks like before anyone writes anything), so the
 * app's single most frequent fox was the wrong fox.
 *
 * Both are now regenerated on-character and wired to their own art, and so are
 * `glowing` and `resting`, which had never had any and were falling back with
 * everything else onto the awake pose.
 *
 * `nesting` was the other defect: on-character but curled with its eyes closed,
 * which made it near-indistinguishable from `sleeping` at 44pt even though the
 * brief calls for it to read as awake and settled. It is now a fox sitting low
 * inside a ring of its own tail, head up and ears pricked — settled, and
 * unmistakably awake. The difference from `sleeping` is carried by the
 * silhouette (a low ring with a head above it, against a closed ball with the
 * nose tucked in), not by eyelids, which is the only version of that
 * distinction that survives being shrunk.
 *
 * ─── The four upright states ─────────────────────────────────────────────────
 *
 * `waiting`, `ready`, `glowing` and `streaklit` are all a fox sitting up, and
 * at 44pt their silhouettes are close. That is deliberate and it is handled
 * elsewhere: `CoupleCompanion` gives each its own halo colour and opacity, its
 * own breath rate and its own line of copy. `waiting` is apricot and says
 * "Holding a light for them"; `glowing` is apricot at nearly twice the opacity
 * and says "Tonight is shared"; `streaklit` is gold. What the art now adds on
 * top of that is a real difference in head angle, ear set, eye state and tail —
 * `waiting` looks up and away, `ready` faces front with both ears forward,
 * `glowing` has its eyes closed into happy crescents, `streaklit` sits square
 * and steady. Same fox, four postures, four different lights on it.
 *
 * ─── Provenance ──────────────────────────────────────────────────────────────
 *
 * Generated with Runway `gen4_image`, each run passing `waiting.png` as an
 * image reference under a fixed character-lock prompt — see README →
 * "Generation prompts". Raw outputs arrive opaque on flat black with the
 * occasional stray glyph stamped in a corner, and are post-processed to
 * transparency; the README documents that pipeline. The raw originals stay
 * alongside as `fox_*.png`, unused by any `require`, so they cost nothing in
 * the bundle.
 */
const ART = {
  /** Sitting low in a ring of its own tail. Head up, ears pricked, awake. */
  nesting: require('./nesting.png'),
  /** Sitting up, looking off and slightly up — watching for someone. */
  waiting: require('./waiting.png'),
  /** Facing front, ears fully forward, eyes wide. About to move. */
  ready: require('./ready.png'),
  /** Eyes closed into happy crescents, chest full. The warmest of the seven. */
  glowing: require('./glowing.png'),
  /** Sitting square and steady. Yesterday's warmth, still on. */
  streaklit: require('./streaklit.png'),
  /** Lying down, front paws forward, chin up. Low energy, still watching. */
  resting: require('./resting.png'),
  /** Curled nose-to-tail, ears folded, asleep. A thing a healthy animal does. */
  sleeping: require('./sleeping.png'),
} satisfies Record<CompanionState, ImageSourcePropType>;

/**
 * Typed as a full `Record` rather than a `Partial`, so adding an eighth
 * `CompanionState` without drawing it is a compile error rather than a state
 * that silently falls back to a geometric placeholder in production.
 */
export const FOX_ART: Record<CompanionState, ImageSourcePropType> = ART;

/**
 * Idle motion loops, for the two states an evening actually pauses on.
 *
 * ─── Animated WebP, not video ────────────────────────────────────────────────
 *
 * The obvious format is MP4, and it is the wrong one here. MP4 carries no alpha
 * channel, so the fox would arrive as an opaque rectangle sitting on top of the
 * gradient, the `StarField` and — worst — the animated halo `CoupleCompanion`
 * draws *behind* the animal, turning a bloom into a donut. Playing it would
 * also mean adding `expo-video`, which is a native module and a prebuild.
 *
 * Animated WebP has an alpha channel and `expo-image` (already a dependency)
 * renders it with no new native code. So the loop drops into exactly the slot
 * the still occupied, the halo still reads, and nothing about the layering
 * changes.
 *
 * ─── Why only two ───────────────────────────────────────────────────────────
 *
 * `waiting` and `glowing` are the states a person sits and looks at: one is the
 * evening's held breath, the other its payoff. The other five are passed
 * through. Five more loops would be five more megabytes to animate screens
 * nobody is watching.
 *
 * ─── Rules these files follow ────────────────────────────────────────────────
 *
 * · **Framed to match the stills.** Both are scaled so the animal occupies
 *   0.898 of the frame height against the stills' 0.901, because a fox that
 *   changes size when its state changes reads as a bug, not as motion.
 * · **No baked glow.** The first `glowing` loop came back with a large yellow
 *   bloom painted around the animal, which is precisely what the README forbids
 *   — the app draws that halo itself and the two would double up. It was
 *   regenerated until its mean brightness drift against frame zero was 0.0.
 * · **Loop point is exact by construction.** The frames ping-pong (forward,
 *   then back) rather than relying on the model returning to where it started,
 *   which it does not: the raw `glowing` clip ended 14.1 mean levels away from
 *   its first frame and would have visibly jumped every five seconds.
 */
export const FOX_LOOPS: Partial<Record<CompanionState, ImageSourcePropType>> = {
  waiting: require('./waiting_idle.webp'),
  glowing: require('./glowing_idle.webp'),
};
