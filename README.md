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

- **Tables**: `profiles`, `couples`, `couple_members`, `entries` — all RLS-protected.
  A partner's ritual answers only become visible once *both* partners have
  submitted for that date (enforced at the RLS layer, not just in the UI).
- **RPCs**: `create_couple`, `join_couple`, `get_my_couple` — pairing logic
  ported from the old Express backend, run as `SECURITY DEFINER` functions.
- **Realtime**: enabled on `entries`, `couples`, `couple_members` — the reveal
  flow updates live without polling once both partners have submitted.
- **Storage**: `avatars` bucket (public read, owner-only write).
- **Edge Functions**:
  - `send-nudge` — sends a push to your partner ("gentle nudge").
  - `entries-webhook` — fires on every submitted entry; pushes "partner
    shared" / "ready to reveal" notifications. Wired via a `pg_net` trigger,
    no dashboard step needed.
  - `revenuecat-webhook` — RevenueCat → Supabase; flips `profiles.is_subscribed`
    so the whole couple unlocks Premium when either partner pays.

### One-time dashboard configuration (needs your own accounts)

These need real credentials from services only you can create accounts for —
the code paths are fully wired and waiting on them:

1. **Apple Sign-In**: Supabase dashboard → Authentication → Providers → Apple.
   Needs your Apple Developer Services ID, Team ID, Key ID, and private key.
2. **Google Sign-In**: Supabase dashboard → Authentication → Providers →
   Google, using OAuth client IDs from Google Cloud Console. Put the iOS
   client ID's reversed form into `app.json` →
   `plugins → @react-native-google-signin/google-signin → iosUrlScheme`
   (currently a placeholder).
3. **Phone (SMS) OTP**: Supabase dashboard → Authentication → Providers →
   Phone. Needs a Twilio (or MessageBird/Vonage) account connected.
4. **RevenueCat webhook**: RevenueCat dashboard → Project settings →
   Integrations → Webhooks. URL:
   `https://lumixwmobjvlzgqrdjak.supabase.co/functions/v1/revenuecat-webhook`,
   Authorization header value must match the `REVENUECAT_WEBHOOK_SECRET`
   function secret (set it via `supabase secrets set` or the dashboard).
5. Configure RevenueCat with `appUserID` = the Supabase auth user id (already
   done in `lib/purchases.ts`) and create an entitlement named `premium`.

## EAS Build & Submit

```bash
npm install -g eas-cli
eas login
eas init                 # fills in extra.eas.projectId in app.json
eas build:configure
eas build --profile development   # or preview / production
eas submit --platform ios
```

Before submitting, fill in the placeholders in `eas.json` (`appleId`,
`ascAppId`, `appleTeamId`, Android service account path) and `app.json`
(`extra.eas.projectId`, the Google `iosUrlScheme`).

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
