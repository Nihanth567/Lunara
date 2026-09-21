# Night fox — companion art

Seven PNGs live here, one per companion state, and all seven are wired in
`index.ts`. `components/NightFoxArt.tsx` still carries a geometric vector
placeholder behind them, so an unreadable asset degrades to a working screen —
but it is a safety net now, not a stage of the project.

## Art policy

**AI-generated art is accepted here.** This file used to carry a hard
constraint against it and describe the seven poses as a commission for a human
illustrator. That was overridden deliberately, so the rule is removed rather
than left sitting in the repo being quietly ignored.

Two things it does *not* reverse:

- **The placeholder stays geometric.** `NightFoxArt`'s vector fallback is
  primitives rather than a character, so a missing PNG can still never be
  mistaken for finished art.
- **Consistency is still the bar.** One character across seven poses is
  precisely what generation is worst at. Judge a generated set on whether it
  reads as the *same animal* at 44pt — not on whether each image is
  individually pretty. The character lock in "Generation prompts" is the whole
  game, and passing a previous pose back in as an **image reference** is what
  actually enforces it.

## Files

All seven are 768×768 RGBA, trimmed to the animal and re-centred on a square
with a 5.5% margin, so every state lands at the same optical scale in a
fixed-size slot.

| File | State | The moment | Source |
|---|---|---|---|
| `nesting.png` | Nesting | Just paired, no shared night yet. Settled in a ring of its own tail, awake. | Runway, ref `waiting` |
| `waiting.png` | Waiting | One has shared, the other hasn't. Sitting up, looking off and slightly up. | Original — established the character |
| `ready.png` | Ready | Both shared, nothing opened. Facing front, ears forward, eyes wide. | Runway, ref `waiting` |
| `glowing.png` | Glowing | Tonight is open and done. Eyes closed into happy crescents. | Runway, ref `waiting` |
| `streaklit.png` | Streak-lit | Tonight still open, a live run carries it. Sitting square and steady. | Runway, ref `waiting` |
| `resting.png` | Resting | A night or few missed. Lying down, chin up, still watching. | Runway, ref `waiting` |
| `sleeping.png` | Sleeping | A longer quiet stretch. Curled nose-to-tail, asleep. | Original |

The raw generator outputs stay alongside as `fox_*.png` and `fox.png`. Nothing
`require`s them, so they cost nothing in the shipped bundle.

### The four upright states

`waiting`, `ready`, `glowing` and `streaklit` are all a fox sitting up, and at
44pt their silhouettes are close. That is handled in `CoupleCompanion`, which
gives each its own halo colour and opacity, breath rate and line of copy. What
the art contributes is head angle, ear set, eye state and tail position. Do not
try to make these four read apart by silhouette alone; that is not the axis
they differ on.

### Why `nesting` is not just "curled with its eyes open"

An earlier `nesting` was curled with its eyes closed and was therefore
indistinguishable from `sleeping` at the size it is actually seen. The current
one sits low inside a ring of its own tail with its head up and ears pricked.
The distinction from `sleeping` is carried by the **silhouette** — a low ring
with a head above it, against a closed ball with the nose tucked in — because
an eyelid is not a difference that survives being shrunk to 44 pixels.

## Idle loops

Two animated WebPs, wired in `index.ts` as `FOX_LOOPS` and rendered by
`NightFoxArt` via `expo-image`.

| File | State | Motion |
|---|---|---|
| `waiting_idle.webp` | Waiting | slow breath, one blink |
| `glowing_idle.webp` | Glowing | slow breath, one blink |

**Animated WebP, not MP4.** MP4 has no alpha channel, so the fox would arrive as
an opaque rectangle over the gradient, the `StarField` and — worst — the halo
the app draws *behind* the animal, turning a bloom into a donut. Playing one
would also mean adding `expo-video`: a native module and a prebuild. WebP has
alpha, `expo-image` is already a dependency, and the loop drops into exactly the
slot the still occupied with the layering unchanged.

Only two, because `waiting` and `glowing` are the states a person sits and looks
at. Five more would be megabytes spent animating screens nobody is watching.

`CoupleCompanion` plays them only at `lg`/`hero` **and** only when the OS
"Reduce Motion" switch is off — an animated file does not honour that setting on
its own, so the decision is made in the component rather than in the art.

### Rules for regenerating one

- **Framed to match the stills.** Both are scaled so the animal occupies 0.898
  of the frame height against the stills' 0.901. A fox that changes size when
  its state changes reads as a bug, not as motion. The transform is derived from
  frame zero and applied to every frame, so the breathing does not become a
  wobble.
- **No baked glow — check, do not assume.** The first `glowing` loop came back
  with a large yellow bloom painted around the animal, which is exactly what the
  Specification below forbids. Verify by comparing mean frame brightness against
  frame zero; the shipped file drifts 0.0.
- **Ping-pong the frames.** Play forward then back so the loop point is exact by
  construction. Models do not return to where they started: the raw `glowing`
  clip ended 14.1 mean levels from its first frame and visibly jumped every five
  seconds. Ping-ponging took that to 1.1, and it suits a breath anyway.
- Generated with Runway `gen4_turbo` (image-to-video, 5 credits/sec) seeded with
  the matching still composited onto `#0E0B14`, then keyed back to alpha by
  distance from that known colour.

## Specification

- **Square, 768×768**, transparent background. The largest on-screen size is
  `hero` at 188pt, which is 564px at @3x, so 768 is the smallest size with
  headroom. Render sizes are `sm` 44 / `md` 88 / `lg` 140 / `hero` 188 — see
  `ART_SIZE` in `components/CoupleCompanion.tsx`.
- **The silhouette must read at 44pt.** That is the header instance — the one
  people see every night, and the smallest.
- **Same fox, seven moods.** Not seven drawings of a fox. Head shape, ear
  shape, tail mass and proportions stay fixed; posture, ear angle, eye state
  and warmth are what change.
- **Posture carries the state, not opacity.** `sleeping` is *curled*; a dimmed
  awake fox reads as a rendering bug. This is the single most important note
  here.
- **Palette**: the app's current tokens — page `#0E0B14`, card `#221C30`,
  apricot `#FFB86B`, coral `#FF7A9A`, violet `#A78BFA`, gold `#F0C75E`, cream
  `#F7F1E8`. See `constants/colors.ts`; do not paste values from memory, this
  bullet has been stale twice. The fox is a *night* fox: indigo-violet fur
  rather than daylight orange, warm apricot only where something is lit.
- **Glow lives outside the file.** The app renders a soft animated halo behind
  the fox and a slow breathing scale over it. Do not bake either in, or they
  double up. Reject any output with a ring, aura or bloom — a generated
  "glowing" pose will try to give the animal a literal halo, which reads as an
  angel rather than a lit fox.
- **Star specks** are baked into the fur here and the app does **not** overlay
  its own on top of commissioned art — `SPARKS` in `NightFoxArt` is in the
  placeholder's coordinate space and lands wherever those numbers happen to
  fall on a PNG. The streak tier is carried by the halo colour, the chip and
  the copy instead.

## Tone

Soft loyalty. This is an animal that waits up for someone. It is never sad,
never scolding, never pleading, and never sick — a couple who missed four
nights opens the app to a fox *asleep*, not a fox suffering. Every state has to
look recoverable in one shared night, because it is.

## Generation prompts

Each prompt is **character lock + state**. Keep the lock byte-identical across
runs and vary only the state sentence.

**Use the mechanics before the wording.** Every pose here was generated with
Runway `gen4_image` passing `waiting.png` as a reference image tagged `@fox`.
That holds the character far better than prompt phrasing alone; a text-only run
produces a different animal, which is exactly how this folder acquired a golden
fire-fox and a leaping fox in the first place.

### Character lock — paste into every prompt

> The exact same character as @fox: a slender elegant night fox, deep
> indigo-violet fur with tiny gold star sparkles scattered through it,
> cream-apricot chest ruff and inner ears, cream tail tip, warm amber-gold
> eyes, soft flat cel-shaded 2D illustration with warm apricot rim light, calm
> and loyal expression. Whole animal fully inside the frame with clear margin
> on all sides, centered. Plain solid pure black background. No text, no
> watermark, no logo, no letters, no halo, no ring above the head, no border,
> no photoreal fur, no 3D render, no chibi proportions.

### Per-state sentence

- **`nesting`** — Curled up in a round nest shape, tail wrapped all the way
  around itself, but wide awake and alert: head and neck lifted high and clear
  of the body, chin up, ears pricked upright, both eyes wide open, looking
  calmly toward the viewer. A settled animal keeping watch from its nest.
- **`waiting`** — Sitting upright, chest lifted, ears up and slightly forward,
  head turned off and slightly up, eyes open and soft. Watching for someone who
  has not arrived yet.
- **`ready`** — Sitting upright and alert, facing the viewer three-quarter,
  ears pricked forward, eyes wide open and bright with anticipation, chin
  lifted, front paws neatly together, tail sweeping out behind. Poised, about
  to move.
- **`glowing`** — Sitting tall and radiant, chest lifted, eyes softly closed in
  contentment with a gentle warm smile, ears relaxed, tail curled forward
  around its paws.
- **`streaklit`** — Sitting upright and calm, body three-quarter left, head
  level, eyes open and content, tail curled neatly around its front paws, a
  warm golden glow on its chest.
- **`resting`** — Lying down with front paws extended forward, head up and
  awake but low energy, eyes open and gentle, ears slightly lowered, tail laid
  out loosely behind. Quieter than usual, still present.
- **`sleeping`** — Fully asleep, curled nose-to-tail. The body is a closed
  circle with the tail wrapped over the nose, ears folded back and down, eyes
  closed. Unmistakably *curled*.

## Post-processing

Raw outputs arrive **opaque on flat black**, sometimes with a stray glyph
stamped in a corner. Each is processed to transparency:

1. **Soft luma ramp to alpha** (`lo` 6, `hi` 26 on perceptual luma). The
   background is pure `#000` and the darkest fur is indigo, so the two separate
   cleanly; a ramp rather than a hard cut keeps the rim light from going jagged.
2. **Largest connected component only.** Threshold the alpha into a core mask,
   close it, label it, keep the biggest blob, fill holes. This is what removes
   stray glyphs — no rectangle wipe and no hand-placed coordinates, so it works
   wherever the artifact lands.
3. **Dilate that blob into a gate** and multiply the soft alpha by it, so the
   feathered edge survives but nothing outside the animal does.
4. **Trim to content, re-centre on a square** with a 5.5% margin, resize to
   768, then one 0.6px blur on the alpha channel only to de-fringe.

Verify any future reprocessing **against the actual render**, not the raw PNG
in a viewer: composite onto the app's real surfaces (`#0E0B14` page, `#221C30`
card) at the sizes it actually renders at. A fringe invisible on a light
preview canvas can be very visible on Lunara's dark ground.
