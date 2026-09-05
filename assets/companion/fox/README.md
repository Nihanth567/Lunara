# Night fox — companion art brief

Seven PNGs live here, one per companion state. Until they do, the app draws a
vector placeholder (`components/NightFoxArt.tsx`) and everything works; dropping
the files in and uncommenting the matching lines in `index.ts` is the entire
integration.

## Hard constraint

**No AI-generated final character art.** The placeholder in the repo is
deliberately geometric — primitives, not a character — so it can never be
mistaken for a finished asset or quietly shipped as one. The seven files below
are a commission for a human illustrator.

## Files

| File | State | The moment |
|---|---|---|
| `nesting.png` | Nesting | Just paired, no shared night yet. Curled in the den, unhurried. |
| `waiting.png` | Waiting | One of them has shared, the other hasn't. Sitting up, keeping a small light. |
| `ready.png` | Ready | Both shared, nothing opened. Alert, ears forward, about to move. |
| `glowing.png` | Glowing | Tonight is open and done. The warmest pose of the seven. |
| `streaklit.png` | Streak-lit | Tonight still open, but a live run carries it. Settled and lit. |
| `resting.png` | Resting | A night or few missed. Lying down, eyes open, still watching. |
| `sleeping.png` | Sleeping | A longer quiet stretch. Curled nose-to-tail, asleep. |

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
- **Palette**: the app's lunar tokens — indigo grounds (`#0F0C29`/`#1E1B3A`),
  lavender `#C3B1E1`, coral `#FF9A8B`, sage `#A8D8A8`, amber `#FFD6A5`, on
  near-black. The fox is a *night* fox: dusk-lavender and deep plum fur rather
  than daylight orange, warm amber only where something is lit.
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
