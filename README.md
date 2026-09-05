# Lunara

A private nightly ritual app for couples. Each partner privately answers three
prompts — **Grateful**, **Cute**, **Grow** — and once both have shared, they
reveal their answers together.

## Stack

- Expo SDK 54 (Expo Router, React Native 0.81, React 19, new architecture)
- Supabase — Auth (Apple / Google / Phone OTP), Postgres + Row Level Security,
  Realtime, Storage, Edge Functions
- RevenueCat — subscriptions (`react-native-purchases`)
- Expo Notifications — local reminders + remote push
- iOS home screen widget — `@bacons/apple-targets`, `targets/widget/`

## Setup

```bash
npm install
cp .env.example .env   # already pre-filled with the Lunara Supabase project
npx expo start
```

### Environment variables (`.env`)

| Variable | Where to get it |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API (already filled in) |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` / `_ANDROID_API_KEY` | RevenueCat dashboard → Project settings → API keys |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` / `_WEB_CLIENT_ID` | Google Cloud Console → Credentials → OAuth client IDs |

## Backend (Supabase project `lunara`, id `lumixwmobjvlzgqrdjak`)

### Schema and migrations

The whole schema is in `supabase/migrations/`, starting from
`20260824000000_initial_schema.sql` — the baseline that creates every table,
RPC, trigger, policy and bucket the later migrations build on. Read that file
first if you want to know what the reveal gate actually is; the policy is
called `select partner entries after mutual submit` and it is commented in
place. `supabase/config.toml` configures the local stack.

Until recently neither existed: the migrations directory held only additive
files and everything they altered had been created by hand in the dashboard.
`supabase db reset` against a fresh project failed on the first statement, so
the project could not be rebuilt, staged or rolled back, and the RLS enforcing
the product's central promise lived nowhere anyone could review it.

**Migration history on the hosted project needs repairing once.** The baseline
was written after the fact, and the three additive migrations were applied to
`lumixwmobjvlzgqrdjak` under different timestamps than the filenames they now
have. The remote records `20260825000000`, `20260828070427`, `20260828070437`,
`20260829073326`; the repo has `20260824000000`, `20260825000000`,
`20260828000000`, `20260828000100`, `20260829000000`, `20260830000000`,
`20260830000100`. Reconcile before the next `supabase db push`:

```bash
supabase link --project-ref lumixwmobjvlzgqrdjak
# Mark the baseline and the already-applied files as applied, without running them.
supabase migration repair --status applied 20260824000000
supabase migration repair --status reverted 20260828070427 20260828070437 20260829073326
supabase migration repair --status applied 20260828000000 20260828000100 20260829000000
supabase migration list        # confirm local and remote agree
supabase db push               # applies the two that really are pending
```

The baseline is written idempotently (`create table if not exists`,
`create or replace function`, `drop policy if exists` before each `create
policy`), so running it against the existing project is a no-op rather than a
collision — but repair is still the right route, so the recorded history
matches the files.

All migrations are now applied to the hosted project. The two that were
outstanding went up on 2026-08-31 / 09-01:

| Local file | Recorded remotely as |
| --- | --- |
| `20260830000100_fix_voice_note_storage_name_shadowing.sql` | `20260831193933` |
| `20260830000000_streak_grace_alignment.sql` | `20260901010635` |

They were applied through the Supabase API rather than `db push`, so the
recorded versions are their apply-time timestamps rather than the filenames —
one more reason to run the repair sequence above before the next push, so local
and remote agree on what has run.

Verified after applying: all four `voice-notes` storage policies now resolve
`storage.objects.name` (voice notes could previously not be uploaded *or*
played by anyone), and `recompute_couple_streaks` no longer carries the
`current_s > 0` grace guard and computes `longest` with the same
one-forgiven-night rule as `current`, matching `lib/streak.ts`.

- **Tables**: `profiles`, `couples`, `couple_members`, `entries` — all RLS-protected.
  A partner's ritual answers only become visible once *both* partners have
  submitted for that date (enforced at the RLS layer, not just in the UI).
  `entries` also carries `voice_grateful` / `voice_cute` / `voice_grow` (Storage
  paths) and `grow_followup` / `grow_followup_at` (the next-day Grow check-back
  reply), so both inherit that same gate rather than needing policies of their own.
- **RPCs**: `create_couple`, `join_couple`, `get_my_couple` — pairing logic
  ported from the old Express backend, run as `SECURITY DEFINER` functions.
- **Realtime**: enabled on `entries`, `couples`, `couple_members` — the reveal
  flow updates live without polling once both partners have submitted.
- **Storage**: `avatars` bucket (public read, owner-only write); `voice-notes`
  bucket (**private**, 10 MB cap, audio MIME types only) holding optional voice
  notes at `{couple_id}/{date}/{user_id}/{slot}.m4a`. Its RLS mirrors the entry
  reveal gate — your own recording is always yours, a partner's only unlocks
  once you have both submitted that date. Playback uses short-lived signed URLs,
  so a stored path grants nothing on its own.
- **Edge Functions**:
  - `send-nudge` — sends a push to your partner ("gentle nudge").
  - `entries-webhook` — pushes "partner shared" / "ready to reveal". Wired via
    a `pg_net` trigger, no dashboard step needed. The trigger fires **only on
    the false → true transition** of `submitted`; before the retention pass it
    fired on every update where `submitted` was true, so a voice note, a
    reaction or a Grow check-back each re-sent "your partner shared their heart
    tonight" to someone who'd already been told.
  - `revenuecat-webhook` — RevenueCat → Supabase; flips `profiles.is_subscribed`
    so the whole couple unlocks Premium when either partner pays.
  - `grow-guidance` — after both partners reveal tonight's Grow answers, calls
    OpenAI (`gpt-4o-mini`) to generate 2-3 gentle, non-prescriptive
    suggestions grounded in what was actually written. Needs the
    `OPENAI_API_KEY` secret (below); without it the app falls back to the
    keyword-matched templates in `lib/growGuidance.ts` automatically — nothing
    breaks either way.

### One-time dashboard configuration (needs your own accounts)

These need real credentials from services only you can create accounts for —
the code paths are fully wired and waiting on them:

Both Apple and Google use the **native** sign-in flow: the OS returns an
identity token and the app hands it to `supabase.auth.signInWithIdToken`
(`signInWithApple` / `signInWithGoogle` in `context/AppContext.tsx`). There is
no browser redirect and no `redirectTo` anywhere in the app. That matters for
how the providers are configured, because most Supabase setup guides describe
the *web* OAuth flow instead, which needs a different — and larger — set of
credentials.

The field that makes the native flow work, for both providers, is
**Authorized Client IDs** in the Supabase provider settings. Supabase checks
the `aud` claim of the incoming token against that list. If the id isn't
listed, sign-in fails with `Unacceptable audience in id_token` no matter how
correct everything else is. This is the single most common way to lose an
afternoon here.

1. **Apple Sign-In**: Supabase dashboard → Authentication → Providers → Apple.
   Enable it, and add the bundle ID `com.lunara.app` to the comma-separated
   client-id field (the dashboard labels it **Client IDs** for Apple and
   **Authorized Client IDs** for Google — same purpose, same `aud` check).
   That is the whole of it for this app.

   You do *not* need a Services ID, Key ID, or private key — those are for the
   web redirect flow, which Lunara never uses. You do need "Sign In with Apple"
   enabled on the App ID in the Apple Developer portal; the entitlement is
   already in the build (`expo-apple-authentication` writes
   `com.apple.developer.applesignin` into `Lunara.entitlements`).

2. **Google Sign-In**: from
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials) →
   APIs & Services → Credentials → *Create credentials* → OAuth client ID.

   | Create | Paste into |
   | --- | --- |
   | **iOS** client (bundle ID `com.lunara.app`) | `.env` → `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, *and* Supabase → Providers → Google → **Authorized Client IDs** |
   | **Web application** client | `.env` → `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, *and* Supabase → Providers → Google → **Authorized Client IDs** |
   | **Android** client (package `com.lunara.app` + the signing SHA-1) | nothing — Google matches it by package name and certificate fingerprint |

   Both ids go in the same comma-separated **Authorized Client IDs** field. The
   Web client is what `@react-native-google-signin` uses on Android and what
   issues the id token Supabase validates, so it is required even on an
   iOS-only build.

   The Web client's *secret* is only needed if you also want the browser
   redirect flow. Lunara doesn't use it, so it can be left blank.

   For Android, get the SHA-1 from the credential EAS actually signs with —
   `eas credentials -p android` — not from a local debug keystore, or Google
   will reject the release build while the dev build works.

   Nothing needs to be pasted into `app.json`. The native URL scheme Google
   calls back on is the iOS client id with its components reversed
   (`123-abc.apps.googleusercontent.com` → `com.googleusercontent.apps.123-abc`),
   and `app.config.js` derives it from `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` at
   build time. `app.json` previously carried the literal string
   `com.googleusercontent.apps.YOUR_IOS_CLIENT_ID`, which compiled a fake scheme
   into the native project — Google Sign-In could start but never come back.

   Without both ids the Google plugin is not included, the scheme is not
   registered, and `isGoogleSignInConfigured()` hides the Google button rather
   than offering a sign-in that cannot complete. Apple, phone and email are
   unaffected. Run `npx expo prebuild -p ios --clean` after setting the ids, so
   the scheme lands in the native project.
3. **Phone (SMS) OTP**: Supabase dashboard → Authentication → Providers →
   Phone. Needs a Twilio (or MessageBird/Vonage) account connected.
4. **RevenueCat webhook**: RevenueCat dashboard → Project settings →
   Integrations → Webhooks. URL:
   `https://lumixwmobjvlzgqrdjak.supabase.co/functions/v1/revenuecat-webhook`,
   Authorization header value must match the `REVENUECAT_WEBHOOK_SECRET`
   function secret (set it via `supabase secrets set` or the dashboard).
5. Configure RevenueCat with `appUserID` = the Supabase auth user id (already
   done in `lib/purchases.ts`) and create an entitlement named `lunara_pro`.
6. **Grow guidance (OpenAI)**: the function itself lives in
   `supabase/functions/grow-guidance/` — deploy it with
   `supabase functions deploy grow-guidance --project-ref lumixwmobjvlzgqrdjak`.
   Then get an API key at [platform.openai.com](https://platform.openai.com/api-keys)
   and set it as an Edge Function secret — either
   `supabase secrets set OPENAI_API_KEY=sk-... --project-ref lumixwmobjvlzgqrdjak`
   (needs `supabase login` + the CLI installed) or Supabase dashboard →
   Edge Functions → `grow-guidance` → Secrets. The key never touches the app
   bundle or client code — it's read server-side only, via
   `Deno.env.get('OPENAI_API_KEY')` inside the function.

## Deep links

Lunara advertises exactly two URLs, and both are built in `lib/inviteLinks.ts`
rather than written out at their call sites — the constants there are named
after the route files that answer them, so a rename breaks the link builder
first instead of breaking silently in a share sheet.

| URL | Route | Sent from |
| --- | --- | --- |
| `lunara://join/<CODE>` | `app/join/[code].tsx` | the invite share sheet (pairing screen, and the Tonight tab's invite card) |
| `lunara://tonight` | `app/tonight.tsx` → redirects to the Tonight tab | the home-screen widget's `.widgetURL` (`targets/widget/index.swift`) |

Both used to point at routes that did not exist, so every widget tap and every
tapped invite opened the app straight onto the not-found screen.

`app/join/[code].tsx` holds no pairing logic of its own — it decides where the
tap should land and hands off to the pairing screen, which is the one place that
redeems a code:

- **signed in, not paired** → pairing, join form, code already filled in;
- **not signed in** → the code is stashed (`lunara_pending_invite_v1`) and they
  go to sign-in; the pairing screen picks it back up on the far side, so a cold
  start is one journey rather than two;
- **already paired** → a warm "you're already here", not a join that would only
  fail;
- **clipped or malformed code** → a warm route to typing the six characters in.

A code that is well-formed but unknown, used, or expired can only be judged by
the server, so it is answered where it is redeemed — inline under the field on
the pairing screen, not in an alert that has to be dismissed before the code is
visible again.

**Scheme, not universal links.** `scheme: "lunara"` in `app.json` is the whole
configuration; there are no `associatedDomains`. Universal (`https://`) links
need an `apple-app-site-association` file served from a domain Lunara does not
own yet, and an `https://` invite with no AASA behind it opens Safari to a 404 —
which is the bug this fixed, not a fix for it. Because a custom-scheme link only
resolves on a device that already has the app, the share message always spells
the six-character code out as well as linking it.

## Retention system

The habit loop is trigger → action → reward, and each leg has a specific owner:

| Leg | Surface | Where it lives |
| --- | --- | --- |
| Trigger | nightly reminder, partner-submitted push, ready-to-reveal push, streak-protection nudge, home-screen widget | `services/notifications.ts`, `supabase/functions/entries-webhook/`, `targets/widget/` |
| Action | three cards, auto-advancing, one pass, under two minutes | `app/(app)/index.tsx`, `components/RitualCard.tsx` |
| Reward | paced reveal, milestone banner, "that's tonight, together" | `app/reveal.tsx`, `components/MilestoneBanner.tsx` |

**Streaks** (`lib/streak.ts`) are the one place the rules live, and
`recompute_couple_streaks()` in SQL mirrors it:

- a night counts only when **both** partners submitted — it's a shared streak,
  not two personal ones;
- the run is anchored to **yesterday** until tonight is finished, so a couple on
  40 nights reads "40, still open" at 9am rather than "0";
- **one missed night per run is forgiven**, once — a second gap ends it, and
  the forgiveness covers *last* night, not only nights further back. There is no
  currency, no purchase, and no "you lost your streak" language anywhere;
- **`longest` is measured with the same grace rule as `current`**, so the record
  can never read lower than the run standing next to it on screen.

`lib/streak.test.ts` states these as executable cases (`npm run test:streak`,
`node --test`, no framework). `recompute_couple_streaks()` implements the same
four rules in SQL — when a case changes, both change.

**Tonight's screen order is a design invariant.** While the night is unfinished
the three cards come first — before the streak, before yesterday's check-back,
before any upsell. Everything above the action is something to read instead of
do, and the promise is "under two minutes". Once submitted the order inverts:
the streak becomes the payoff, and the soft next-day questions get their room.
Exactly one call to action is ever on screen.

**Notification budget** is 2–5 touches/week by construction. A couple who shows
up sees one nightly reminder they usually beat, plus a partner-submitted or
ready-to-reveal push. The streak-protection nudge only exists on nights a live
streak is still unfinished, so engaged couples never receive it at all.

**Widget** (`lib/widget.ts` → `targets/widget/index.swift`) shows status before
number: `Ready to reveal` / `Waiting for your partner…` / `Tonight is still
open` / `Tonight is complete`. It never shows either partner's words — a home
screen is visible to whoever is holding the phone, and that would defeat the
reveal gate.

**Dates are local, not UTC.** Every date key goes through `toDateKey` /
`todayKey` in `lib/streak.ts`. The previous `toISOString().split('T')[0]` filed
a 9pm ritual in California under tomorrow's date.

## EAS Build & Submit

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --profile development   # or preview / production
eas submit --platform ios
```

The EAS project is already created and linked — `app.json` carries the real
`extra.eas.projectId` (`e6cb5f12-95b9-4c8d-b097-399b34250563`, owner
`nihu0504`, https://expo.dev/accounts/nihu0504/projects/lunara). **Do not
replace it with a placeholder.** `getExpoPushTokenAsync({ projectId })` throws
without a valid id, which silently disables every remote push in the app.

`app.config.js` overlays the environment-dependent bits on top of `app.json`.
Today that is Google Sign-In: the iOS URL scheme is derived from
`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, and when that isn't set the plugin is left
out entirely and the Google button hides itself, rather than shipping a
placeholder scheme that can never receive a callback.

Still to fill in before submitting: `eas.json` (`appleId`, `ascAppId`,
`appleTeamId`, Android service account path) and `ios.appleTeamId` in
`app.json`, which `@bacons/apple-targets` needs for the widget target.

## iOS home screen widget

`targets/widget/` is a real WidgetKit extension (SwiftUI) generated via
`@bacons/apple-targets`, showing the current streak and whether tonight's
ritual is done. It reads from an App Group (`group.com.lunara.app.widget`)
that `lib/widget.ts` writes to from the RN side whenever streak/entry state
changes, then calls `ExtensionStorage.reloadWidget()`.

- Verified with a real build: `npx expo prebuild -p ios --clean`, `cd ios &&
  pod install`, then `xcodebuild -workspace ios/Lunara.xcworkspace -scheme
  LunaraWidget -destination "generic/platform=iOS Simulator" -sdk
  iphonesimulator build CODE_SIGNING_ALLOWED=NO` — **BUILD SUCCEEDED**,
  including the `.appex` embed.
- Before archiving for a real device or the App Store, set `ios.appleTeamId`
  in `app.json` (prebuild currently warns it's missing) — signing needs it.
- To develop the widget UI further: `npx expo prebuild -p ios`, then `xed
  ios` and edit inside the `expo:targets/LunaraWidget` virtual folder in
  Xcode — changes there sync back to `targets/widget/` automatically.
- Not implemented: an Android widget (`react-native-android-widget` would be
  the equivalent route, not attempted here).
