# Night fox — companion art brief

Seven PNGs live here, one per companion state. Until they do, the app draws a
vector placeholder (`components/NightFoxArt.tsx`) and everything works; dropping
the files in and uncommenting the matching lines in `index.ts` is the entire
integration.

## Art policy

**AI-generated art is accepted here.** This file used to carry a hard constraint
against it and describe the seven poses as a commission for a human
illustrator. That was overridden deliberately, so the rule is removed rather
than left sitting in the repo being quietly ignored.

Two things it does *not* reverse:

- **The placeholder stays geometric.** `NightFoxArt`'s vector fallback is
  primitives rather than a character, so a missing PNG can still never be
  mistaken for finished art.
- **Consistency is still the bar.** The reason this was specified as a
  commission is that one character across seven poses is precisely what
  generation is worst at. Judge a generated set on whether it reads as the
  *same animal* at 44pt — not on whether each image is individually pretty.
  The character lock in "Generation prompts" below is the whole game.

## Files

| File | State | The moment | Status |
|---|---|---|---|
| `nesting.png` | Nesting | Just paired, no shared night yet. Curled in the den, unhurried. | Falls back to `fox.png` |
| `waiting.png` | Waiting | One of them has shared, the other hasn't. Sitting up, keeping a small light. | **Live** — reprocessed from `fox_patient.png` |
| `ready.png` | Ready | Both shared, nothing opened. Alert, ears forward, about to move. | Falls back to `fox.png` |
| `glowing.png` | Glowing | Tonight is open and done. The warmest pose of the seven. | Falls back to `fox.png` |
| `streaklit.png` | Streak-lit | Tonight still open, but a live run carries it. Settled and lit. | Falls back to `fox.png` |
| `resting.png` | Resting | A night or few missed. Lying down, eyes open, still watching. | Falls back to `fox.png` |
| `sleeping.png` | Sleeping | A longer quiet stretch. Curled nose-to-tail, asleep. | **Live** — reprocessed from `fox_sleeping.png` |

`fox.png` is the generic single image every fallback state above points at —
posture doesn't change with state there, only on `waiting` and `sleeping`.

Both delivered "poses" (`fox_patient.png` → `waiting.png`, `fox_sleeping.png` →
`sleeping.png`) arrived as opaque exports — solid background, no alpha channel
— with a "Made with AI" badge baked into a top-right corner. Neither was usable
as-is. Both were reprocessed:

1. **Flood-filled to transparency from the border**, never a global color-key —
   an internal fox pixel that happens to share the background color is never
   touched unless it's actually connected to the edge through more background.
2. **Eroded ~3px inward** before finalizing the mask. A pure color-threshold
   flood fill leaves a thin ring of pixels fully opaque wherever the source's
   own antialiasing blended the outline ink with the background — those pixels
   don't read as "background" by color, but they're not real fox edge either,
   and left alone they show up as a faint light halo around the whole
   silhouette once composited onto the app's dark ground. Eroding the kept
   region trims that ring away; the softened edge below covers the seam.
3. **Badge region cleared** (a rectangle wipe — it's a different color sitting
   inside the background, not part of it, so color-keying alone doesn't catch
   it).
4. **Edges softened**, then **defringed** — for any pixel left with partial
   alpha, its RGB is decontaminated against the known original background
   color (`fg = bg + (rgb - bg) / alpha`), since the source's antialiasing had
   already blended background color into those pixels before transparency
   ever entered the picture.
5. **Trimmed to content** with a small pad, so the fox fills more of its square
   slot instead of sitting in mostly-empty padding.

Verify any future reprocessing against the actual render, not just the raw PNG
in an image viewer — composite the result onto the app's real surface colors
(`#251B2B` card, `#150F19` ground) at the actual size it renders at (`sm` 44 /
`md` 76 / `lg` 116, see `CoupleCompanion.tsx`) before trusting it. A fringe that
reads as invisible against a light preview canvas can be very visible against
Lunara's dark ground, and the reverse is just as possible for a defect assumed
fixed from pixel checks alone.

The raw originals stay alongside as source; nothing `require`s them, so they
cost nothing in the shipped bundle.

## Specification

- **Square, 512×512**, transparent background. Ship `@2x` and `@3x` alongside if
  the budget allows; the largest on-screen size is 116pt.
- **The silhouette must read at 44pt.** That is the header instance — the one
  people see every single night, and the smallest. Design at that size first and
  scale up, not the other way round.
- **Same fox, seven moods.** Not seven drawings of a fox. Head shape, ear shape,
  tail mass and proportions stay fixed; posture, ear angle, eye state and warmth
  are what change. A viewer must never wonder whether it is the same animal.
- **Posture carries the state, not opacity.** `sleeping` is *curled*; a dimmed
  awake fox reads as a rendering bug. This is the single most important note
  here.
- **Palette**: the app's tokens — ground `#150F19`, surface `#251B2B`, lilac
  `#B9A5E3`, rose `#E8A0B4`, mint `#9BC9A8`, peach `#E8B98A`, cream `#F8F1F6`.
  The fox is a *night* fox: dusk-lilac and deep plum fur rather than daylight
  orange, warm peach only where something is lit.
  (This bullet previously cited `#0F0C29` / `#1E1B3A` / `#C3B1E1` / `#FF9A8B` /
  `#A8D8A8` / `#FFD6A5`. The app moved from the indigo ramp to the plum one and
  none of those tokens exist any more — see `constants/colors.ts`.)
- **Room for 0–5 star specks** along the flank and tail. The app draws these
  itself over the art (streak tier), so leave those areas uncluttered.
- **A small warm light** near the muzzle in `waiting.png` — the literal reading
  of "holding a light for them", and the detail that makes that state legible
  at 44pt.
- **Glow lives outside the file.** The app renders a soft animated halo behind
  the fox and a slow breathing scale over it. Do not bake either in, or they
  double up.

## Tone

Soft loyalty. This is an animal that waits up for someone. It is never sad,
never scolding, never pleading, and never sick — a couple who missed four nights
opens the app to a fox *asleep*, not a fox suffering. Every state has to look
recoverable in one shared night, because it is.

## Generation prompts

Each prompt is **character lock + state + rules**. Keep the lock and the rules
byte-identical across all seven runs and vary only the state paragraph. That is
the only lever that keeps this one animal rather than seven foxes.

**Before wording, use the mechanics.** If the tool supports image-to-image, run
all seven *from the first fox* at low-to-middling strength rather than
text-to-image from scratch — that holds the character far better than any
prompt phrasing can. If it supports seeds, fix one seed across all seven.

### Character lock — paste into every prompt

> A slender nocturnal fox, three-quarter front view, head and upper body. Large
> upright triangular ears with pale ivory inner fur. Deep indigo-violet fur over
> the head, back and tail, gradating to dark plum beneath. A darker mask patch
> across the brow and around the eyes, with two small pale ivory oval markings
> above the eyes. Ivory-cream muzzle, cheeks, chest ruff and tail tip. Warm
> peach-amber eyes with a single soft star glint. A scattering of tiny star
> specks in the brow fur. Flat 2D illustration, clean confident linework, soft
> cel shading, no photorealism.

### Rules — paste into every prompt

> 512×512 square. Fully transparent background: no scene, no sky, no ground, no
> vignette. Do not draw any halo, glow ring, aura or light bloom around the
> animal — the app renders those itself and they will double up. Keep the flank
> and tail uncluttered; the app draws star specks over that area. The silhouette
> must read at 44 pixels, so keep ear shape and tail mass distinct and avoid
> fine detail that disappears when small. Head shape, ear shape, tail mass and
> body proportions are identical in every image and must not change. Palette:
> fur `#B9A5E3` down to `#312338`, cream `#F8F1F6`, eyes and warm light
> `#E8B98A`, optional rose warmth `#E8A0B4`.

### Per-state paragraphs

**`nesting.png`** — Just paired, no shared night yet.
> Curled in the den, unhurried. Body curled with the tail wrapped around the
> front paws. Ears relaxed and angled slightly outward. Eyes half-open, calm and
> unbothered. Settled, not sleepy.

**`waiting.png`** — One has shared, the other hasn't.
> Sitting upright, keeping watch. Chest lifted, ears up and slightly forward,
> eyes fully open and soft. A single small warm light floats just in front of
> the muzzle and is the only lit thing in the image — this is the fox holding a
> light for someone who has not arrived yet. This detail is what makes the state
> legible at 44pt; do not omit it.

**`ready.png`** — Both shared, nothing opened.
> Alert and about to move. Chest high, front paws planted, ears fully forward
> and sharp, eyes wide and bright, weight leaning very slightly forward.
> Anticipation, not alarm.

**`glowing.png`** — Tonight is open and done.
> The warmest pose of the seven. Head tilted slightly up, eyes closed into happy
> crescents, cheeks lifted, chest ruff full and soft. Warm peach light on the
> muzzle, brow and chest. Quiet contentment shared with someone.

**`streaklit.png`** — Still open, but a live run carries it.
> Settled and lit. Sitting calm and square, ears up but relaxed, eyes open and
> steady. Warm peach light catching along the brow, the ruff and the top of the
> tail. Steady pride, not excitement.

**`resting.png`** — A night or few missed.
> Lying down, still watching. Body down, front paws forward, chin up or resting
> lightly on the paws. Ears at half-mast, eyes open and patient. Waiting out a
> quiet stretch — never sad, never sick.

**`sleeping.png`** — A longer quiet stretch.
> Fully asleep, curled nose-to-tail. The body is a closed circle with the tail
> wrapped over the nose. Ears folded back and down, eyes closed. Peacefully
> asleep, never unwell. This pose must be unmistakably *curled* — a dimmed awake
> fox reads as a rendering bug.
