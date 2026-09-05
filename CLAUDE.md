# CLAUDE.md

Guidance for working in this repo. See `README.md` for backend/deploy setup detail.

## What Lunara is

A private nightly ritual app for couples. Each partner privately answers three
prompts — **Grateful**, **Cute**, **Grow** — and once *both* have submitted for
that date, they reveal together. Dark-mode-only, deep-indigo "cosmic" aesthetic.

## Stack

- Expo SDK 54 · Expo Router (file-based) · React Native 0.81 · React 19 · new architecture
- React Compiler is **on** (`experiments.reactCompiler`, `babel-plugin-react-compiler`) — don't hand-add `useMemo`/`useCallback` purely for referential stability; do keep them where a dependency contract matters.
- Supabase — Auth (Apple / Google / Phone OTP), Postgres + RLS, Realtime, Edge Functions, Storage
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
```

There is no ESLint script wired up, and no test framework — `lib/streak.test.ts`
runs on Node's built-in `node --test` and is the only test file. `npm run
typecheck` is the gate. Note: `supabase/functions/**` (Deno edge functions) always report `tsc`
errors (remote URL imports, `Deno` global) — those are **pre-existing and
expected**; ignore them and only care about errors in app code.

## Layout

```
app/                 Expo Router routes
  index.tsx          entry gate → redirects to onboarding or (app)
  (onboarding)/      auth, profile setup, pairing, tutorial, paywall preview
  (app)/             the 3 native tabs:
    index.tsx          "Tonight"  — the nightly ritual
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
                     voiceNotes (Storage upload/signed URLs), moments helpers
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
  literally not returned until both have submitted for that date.
- **Realtime**: `AppContext` subscribes to `entries`/`couples`/`couple_members`/
  `keepsakes` for the paired couple and calls `refreshSharedState()` on change.
- **Entitlements**: `isPro(couple)` (`lib/entitlements.ts`) is the single gate.
  One subscription unlocks Premium for both partners. Route locked features to
  `/(modals)/paywall`.
- **Widget sync**: any change to streak / ritual-complete state should flow
  through `updateWidgetData()` in `lib/widget.ts` (already wired in an
  `AppContext` effect).

## Conventions

- **Imports**: use the `@/` alias (maps to repo root), never long relative paths.
- **Styling**: `StyleSheet.create` at the bottom of each file. Dark theme only.
  Cards: `backgroundColor: '#1A1730'` (`ink[2]`), `borderRadius: radius.lg`
  plus `borderCurve: 'continuous'` — iOS squircles, never circular corners.
  **Neutrals come from the ink ramp, not from taste**: `#0A0817` page ·
  `#121024` sunk · `#1A1730` surface · `#23203D` raised · `#2E2A4C` line.
  One hue family (246–248°) with chroma tapering as it lightens; do not
  introduce a sixth near-black.
  Text is three separated tiers — `#F5F2FB` / `#C0B8D4` / `#948BAC`
  (15.7:1, 9.1:1, 5.4:1 on surface). Never reintroduce `#7A6D98`: it failed
  WCAG AA on every surface in the app.
  Accents have *rank*: coral `#FF9A8B` is the only colour that means "act on
  this"; lavender `#C3B1E1` is brand/ambience; sage `#A8D8A8` and amber
  `#F0C07A` are strictly semantic, never decorative.
  The app background is `gradients.screen` from `constants/colors.ts` — one
  definition, not an inline stop array per screen.
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
