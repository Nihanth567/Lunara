# CLAUDE.md

Guidance for working in this repo. See `README.md` for backend/deploy setup detail.

## What Lunara is

A couples app with two halves that deliberately behave in opposite ways.

**The ritual (private until mutual).** Each partner privately answers three
prompts — **Grateful**, **Cute**, **Grow** — and once *both* have submitted for
that date, they reveal together.

**The shared list (visible immediately).** One list both partners read and write
in real time. Each person has their own colour; an item can be finished by
either of them, or marked `needs_both` so it only completes when both tick it.

The contrast is the point: the list is where the app is practical, so the ritual
never has to be. Dark-mode-only, warm plum "candlelight" aesthetic.

## Stack

- Expo SDK 54 · Expo Router (file-based) · React Native 0.81 · React 19 · new architecture
- React Compiler is **on** (`experiments.reactCompiler`, `babel-plugin-react-compiler`) — don't hand-add `useMemo`/`useCallback` purely for referential stability; do keep them where a dependency contract matters.
- Supabase — Auth (**Apple / Google only** — phone OTP and email/password were removed), Postgres + RLS, Realtime, Edge Functions, Storage
- RevenueCat (`react-native-purchases`) for subscriptions
- `react-native-reanimated` v4 for animation; `expo-haptics` for feedback
- iOS home-screen widget via `@bacons/apple-targets` (`targets/widget/`)

## Commands

```bash
npx expo start            # dev server
npm run typecheck         # tsc --noEmit — run this before finishing any change
npm test                  # all three suites (streak, companion, paywall moment)
npm run test:streak       # node --test lib/streak.test.ts — the streak rules
npm run ios / android / web
npx expo prebuild -p ios --clean   # regenerate native projects (needed for widget work)
cd ios && pod install              # also regenerates ios/build/generated (RN codegen)
```

**Do not delete `ios/build/`.** Despite the name it is not only derived data:
`ios/build/generated/` holds React Native **codegen output** (`ComponentDescriptors.cpp`
and friends) that the `ReactCodegen` Pods target consumes as a build *input*.
Removing it fails the build with "Build input file cannot be found". It is
untracked by git, so "no tracked files" is not a safe check. Recover with
`cd ios && pod install`, which re-runs codegen.

There is no ESLint script wired up, and no test framework — the three test
files (`lib/streak.test.ts`, `lib/companion.test.ts`,
`lib/paywallMoment.test.ts`) run on Node's built-in `node --test`. `npm run
typecheck` plus `npm test` is the gate. Note: `supabase/functions/**` (Deno edge functions) always report `tsc`
errors (remote URL imports, `Deno` global) — those are **pre-existing and
expected**; ignore them and only care about errors in app code.

## Layout

```
app/                 Expo Router routes
  index.tsx          entry gate → redirects to onboarding or (app)
  (onboarding)/      welcome → intro → auth → profile-setup → pairing (5 steps).
                     `pairing` is the last one and calls `completeOnboarding()`.
                     `tutorial` / `who-pays` / `pro-preview` still exist and are
                     routable but are deliberately NOT on the path — Premium is
                     introduced later, from inside the product.
  (app)/             the 4 native tabs:
    index.tsx          "Tonight"  — the nightly ritual
    list.tsx           "List"     — the shared list
    history.tsx        "Moments"  — past revealed entries
    profile.tsx        "Us"       — stats, settings, growth/date-night, recap
  (modals)/          paywall, privacy, terms  (presentation: modal)
  reveal.tsx         full-screen reveal flow
  moment/[date].tsx  one past night in full — both partners + voice playback
  keepsakes.tsx      shared long-form Q&A
components/          shared UI (cards, StarField, LunaraButton, GlassCard, …)
context/AppContext.tsx   the single source of truth for auth/couple/entries/keepsakes
hooks/               useColors, useGrowth, useGrowCheckBack
lib/                 supabase client, entitlements, purchases, widget, growth data,
                     voiceNotes (Storage upload/signed URLs), moments helpers,
                     list.ts (shared-list rules — completion, ordering),
                     companion.ts (fox state machine), reactions.ts (the shared
                     reaction table — reveal writes it, moment reads it),
                     paywallMoment.ts (when Premium may be offered)
constants/           colors.ts (design tokens), keepsakeQuestions.ts
services/            notifications.ts (local + push scheduling)
supabase/functions/  Deno edge functions (send-nudge, grow-guidance, webhooks)
targets/widget/      SwiftUI WidgetKit extension
```

## Core architecture notes

- **`AppContext` is the data layer.** All auth, couple, entry, keepsake, and
  notification state lives there, exposed via `useApp()`. Screens don't call
  Supabase directly (edge-function `invoke` from a component is the rare
  exception). It transparently supports a **demo mode** (`couple.isDemoMode`)
  backed by AsyncStorage instead of the server — new stateful features should
  work in demo mode too.
- **Streaks are derived, never incremented.** `computeStreaks()` recomputes from
  the set of dates where both partners submitted, so a missed night self-heals.
  Server-paired couples get `current_streak`/`longest_streak` from the RPC;
  demo couples compute locally.
- **Reveal gating is enforced in RLS**, not just UI — a partner's answers are
  literally not returned until both have submitted for that date. The shared
  list is the deliberate exception: both members read and write the same rows
  with no gate at all.
- **List completion is derived, never stored.** There is no `done` column.
  `list_item_checks` holds one row per (item, person); `isDone()` in `lib/list.ts`
  resolves it — any check completes a solo item, every member's check completes
  a `needs_both` one. Ticking is an insert/delete of *your own* check row, so
  two simultaneous taps touch disjoint rows and can't clobber each other. Same
  principle as streaks.
- **Realtime**: `AppContext` subscribes to `entries`/`couples`/`couple_members`/
  `keepsakes`/`list_items`/`list_item_checks` for the paired couple and calls
  the narrowest matching refresh on change. `list_item_checks` has no
  `couple_id` to filter on, so its subscription is unfiltered and the refresh
  (plus RLS) is what scopes it.
- **Entitlements**: `isPro(couple)` (`lib/entitlements.ts`) is the single gate.
  One subscription unlocks Premium for both partners. Route locked features to
  `/(modals)/paywall`.
- **When Premium may be *offered*** is a separate question from what it gates,
  and it has its own rule: `shouldOfferPremium()` in `lib/paywallMoment.ts`
  (with `usePaywallMoment()` for the per-device "already asked" flag). One
  proactive prompt, in the afterglow of a *finished* night, only after three
  shared nights, only once. Never before the first mutual reveal and never
  mid-ritual. Locked features still route to the paywall on tap — that is the
  person asking, not us. The rules are tested in `lib/paywallMoment.test.ts`;
  if one starts failing, ask whether you are about to sell to someone who
  hasn't seen the product yet.
- **Widget sync**: any change to streak / ritual-complete state should flow
  through `updateWidgetData()` in `lib/widget.ts` (already wired in an
  `AppContext` effect).

## Conventions

- **Imports**: use the `@/` alias (maps to repo root), never long relative paths.
- **Styling**: `StyleSheet.create` at the bottom of each file. Dark theme only.
  **Import tokens; do not paste hex.** `palette`, `gradients`, `tint`, `glow`
  from `constants/colors.ts`; `type`, `tabularNumerals` from
  `constants/typography.ts`; `radius`, `space`, `elevation` from
  `constants/tokens.ts`. Roughly 315 one-off hexes were converted to tokens in
  one pass — do not start the pile again.
  Cards: `backgroundColor: palette.ink[2]`, `borderRadius: radius.lg` plus
  `borderCurve: 'continuous'` — iOS squircles, never circular corners. Primary
  CTAs are pills (`radius.full`); nothing else is.
  **The mood is "night nursery for two"**: a cool dark room with one warm
  light in it. Large surfaces stay night; warmth arrives as a *glow* on the
  thing that earned it, never as a wash over the page.
  **Neutrals come from the ink ramp, not from taste**: `#0E0B14` page ·
  `#1A1524` elevated · `#221C30` card · `#2A2338` soft · `#3A3149` line.
  One hue family (~265°) with chroma tapering as it lightens; do not introduce
  a sixth near-black.
  Text is three warm-cream tiers — `#F7F1E8` / `#C9BDB0` / `#9A9084`
  (14.7:1, 8.9:1, 5.2:1 on card). Every tier clears WCAG AA on all four
  surfaces; verify a new value with a contrast check rather than eyeballing it.
  Never pure `#FFF` or `#000`.
  Accents have *rank*: apricot `glow` `#FFB86B` is the fox's light and the only
  colour that means "act on this"; coral `heart` `#FF7A9A` is love (reveal,
  reactions, partner A) and never a generic button; violet `moon` `#A78BFA` is
  secondary and ambience, never an action; `success` `#7DDEB5` and `streak`
  `#F0C75E` are strictly semantic; `danger` `#E89B9B` is soft on purpose — this
  app never shows a couple a harsh red.
  The two people have fixed colours — `partnerA` `#FF7A9A` (you) and
  `partnerB` `#8FC5DE` (them) — which differ in lightness as well as hue, so
  authorship is never conveyed by hue alone.
  Backgrounds come from `gradients` — `screen` normally, `warm` once both
  partners are in a night, `reveal` on the reveal. One definition, not an
  inline stop array per screen.
  Type is **Fraunces** (display/serif, the couple's own words) + **Plus Jakarta
  Sans** (all chrome) — *not* Inter, which `constants/typography.ts` rejects by
  name. Use the 8-step scale in that file (12·14·16·18·22·26·34·44) and never
  invent a size between steps; `label` and `overline` are styles, not sizes.
  The three documented exceptions are the tab-bar labels (iOS convention), the
  welcome wordmark, and `WidgetHomeScreenPreview` (a scale model).
- **The fox is the product, not an illustration of it.** On any screen where it
  appears at `hero`, it is the subject and nothing else competes above the fold.
  State comes from `lib/companion.ts` (pure, derived, never stored) via
  `useCompanion()`; art comes from `assets/companion/fox/index.ts`, where seven
  states currently share three on-character poses grouped by energy. Never wire
  in art that is a different animal — read the note in that file first.
- **Copy voice**: gentle, warm, never prescriptive or gamified-pushy. Match the
  existing microcopy tone ("A gentle way forward", "No pressure — …").
- **Haptics**: `Haptics.selectionAsync()` on tab/segment changes,
  `impactAsync(Light)` on taps, `notificationAsync(Success)` on positive
  completion.
- **Screens** wrap content in `<LinearGradient>` + `<StarField />` and pad with
  `useSafeAreaInsets()` (`insets.top + 16` top, `insets.bottom + 90` bottom for
  the tab bar; add `+67/+34` on web — see existing screens).
- **Native tabs**: `(app)/_layout.tsx` renders `NativeTabs` when
  `isLiquidGlassAvailable()`, else a classic `<Tabs>`. Adding a tab means
  editing both branches.

## Persistence patterns

- Server-backed shared state → through `AppContext` / Supabase.
- Per-device, non-critical state (viewed flags, local streaks, prefs) →
  AsyncStorage with a versioned key (`lunara_*_v1`). `hooks/useGrowth.ts` is the
  reference example: pure data/helpers in `lib/`, stateful storage in a hook.

## graphify

This project has a graphify knowledge graph at .graphify/.

Rules:
- For codebase or architecture questions, when `.graphify/graph.json` exists, first run `graphify query "<question>"` (or `graphify path "<A>" "<B>"` / `graphify explain "<concept>"`); these return a scoped subgraph, usually much smaller than `GRAPH_REPORT.md` or raw grep output
- If .graphify/wiki/index.md exists, navigate it instead of reading raw files
- If .graphify/graph.json is missing but graphify-out/graph.json exists, run `graphify migrate-state --dry-run` first; if tracked legacy artifacts are reported, ask before using the recommended `git mv -f graphify-out .graphify` and commit message
- If .graphify/needs_update exists or .graphify/branch.json has stale=true, warn before relying on semantic results and run /graphify . --update when appropriate
- Before proposing or committing .graphify artifacts, run `graphify portable-check .graphify`; commit-safe graph artifacts must use repo-relative paths, and never commit .graphify/branch.json, .graphify/worktree.json, .graphify/needs_update, or .graphify/cache/. If a repo already tracks any of them, first add them to .gitignore, then propose `git rm --cached .graphify/branch.json .graphify/worktree.json .graphify/needs_update` and `git rm -r --cached .graphify/cache`; never mutate git state without asking
- Before deep graph traversal, prefer `graphify summary --graph .graphify/graph.json` for compact first-hop orientation
- For review impact on changed files, use `graphify review-delta --graph .graphify/graph.json` instead of generic traversal
- Read `.graphify/GRAPH_REPORT.md` only for broad architecture review or when `query` / `path` / `explain` do not surface enough context
- After modifying code files in this session, run `npx graphify hook-rebuild` to keep the graph current
