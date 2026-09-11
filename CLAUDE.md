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

There is no ESLint script wired up, and no test framework — `lib/streak.test.ts`
runs on Node's built-in `node --test` and is the only test file. `npm run
typecheck` is the gate. Note: `supabase/functions/**` (Deno edge functions) always report `tsc`
errors (remote URL imports, `Deno` global) — those are **pre-existing and
expected**; ignore them and only care about errors in app code.

## Layout

```
app/                 Expo Router routes
  index.tsx          entry gate → redirects to onboarding or (app)
  (onboarding)/      intro, auth, profile setup, pairing, tutorial, paywall preview
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
                     list.ts (shared-list rules — completion, ordering)
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
- **Widget sync**: any change to streak / ritual-complete state should flow
  through `updateWidgetData()` in `lib/widget.ts` (already wired in an
  `AppContext` effect).

## Conventions

- **Imports**: use the `@/` alias (maps to repo root), never long relative paths.
- **Styling**: `StyleSheet.create` at the bottom of each file. Dark theme only.
  Cards: `backgroundColor: '#251B2B'` (`ink[2]`), `borderRadius: radius.lg`
  plus `borderCurve: 'continuous'` — iOS squircles, never circular corners.
  **Neutrals come from the ink ramp, not from taste**: `#150F19` page ·
  `#1C1421` sunk · `#251B2B` surface · `#312338` raised · `#42304A` line.
  One hue family (~290°, plum) with chroma tapering as it lightens; do not
  introduce a sixth near-black. The ground reads as candlelight, not as a
  purple gradient wash — keep the chroma low.
  Text is three separated tiers — `#F8F1F6` / `#CBB9C9` / `#A492A6`
  (14.9:1, 8.9:1, 5.7:1 on surface). Every tier clears WCAG AA on every
  surface; verify a new value rather than eyeballing it.
  Accents have *rank*: rose `#E8A0B4` is the only colour that means "act on
  this"; lilac `#B9A5E3` is brand/ambience; mint `#9BC9A8` and peach `#E8B98A`
  are strictly semantic, never decorative. `roseDeep` `#C4718A` is a fill and
  border colour only — it is below AA and must never carry small text.
  The two people have fixed colours — `partnerA` `#E8A0B4` (you) and
  `partnerB` `#8FC5DE` (them) — which differ in lightness as well as hue, so
  authorship is never conveyed by hue alone.
  The app background is `gradients.screen` from `constants/colors.ts` — one
  definition, not an inline stop array per screen.
  Prefer importing `palette` / `gradients` over pasting a hex; most older
  screens still hardcode, and new code should not add to that.
  Type is **Fraunces** (display/serif, the couple's own words) + **Plus Jakarta
  Sans** (all chrome) — *not* Inter, which `constants/typography.ts` rejects by
  name. Use the 8-step scale in that file (12·14·16·18·22·28·40·52) and never
  invent a size between steps; `label` and `overline` are styles, not sizes.
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
