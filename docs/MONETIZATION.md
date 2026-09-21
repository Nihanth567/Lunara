# Monetisation — configuration and rationale

Everything the app expects from RevenueCat and the stores, and why each choice
is what it is. Code alone cannot express most of this: the trial length, the
prices and the offering shape live in consoles, and the app reads them at
runtime rather than hardcoding them.

> **Nothing in this document is configured by shipping the app.** The four
> "Console work" items below have to be done by hand or the paywall renders an
> empty plan list and the front gate locks everyone out.

---

## 1. Entitlement

| | |
|---|---|
| **Identifier** | `premium` |
| **Declared in** | `lib/purchases.ts` → `ENTITLEMENT_ID` |
| **Granted by** | any active weekly / monthly / yearly subscription, **including one still inside its free trial** |

**Console work — this is a rename.** The entitlement used to be `lunara_pro`.
If the RevenueCat dashboard still calls it that, every customer reads as
unentitled and the front gate locks out people who have paid. The dashboard
rename has to land *with* this build, not after it.

RevenueCat reports a trial as an active entitlement, so the gate does not check
trial state separately — `isTrialing()` exists only for copy and for the
day-18 reminder.

---

## 2. Products

| Package | Product ID | Price | Intro |
|---|---|---|---|
| Weekly (**default**) | `lunara_premium_weekly` | $4.99 / week | 21-day free trial |
| Yearly (secondary) | `lunara_premium_yearly` | $59.99 / year | 21-day free trial |
| Monthly (optional) | `lunara_premium_monthly` | $9.99 / month | 21-day free trial |

Declared for reference in `lib/purchases.ts` → `PRODUCT_IDS`. **No price or
trial length is hardcoded anywhere in the client.** Every number on the paywall
comes from the store via RevenueCat, so it stays correct in every storefront and
currency, and the trial label is derived from `introPrice` — the button never
promises a trial the store is not actually offering on the selected plan.

**Console work:** create the products in App Store Connect / Google Play with a
21-day introductory free trial, then map them into RevenueCat.

---

## 3. Offering

- Offering identifier: `default`
- Must contain **weekly** and **yearly** at minimum; monthly optional.

**Package order and default selection are enforced in the client**, in
`lib/purchases.ts` → `packageRank()` / `defaultPackage()`: weekly first and
pre-selected, then yearly, then monthly. This does not depend on the dashboard's
ordering, so a console change cannot silently revert it.

### Why weekly is the default

This inverts the previous paywall, which sorted annual to the top and called
`setSelected(annual)` — so the default path was a $59.99 commitment from someone
who had not yet finished a single night.

The reason is revenue, not taste. Across Adapty's 2026 sample (~16k apps, ~$3B):

| Plan | Day-one revenue / user | End-of-year |
|---|---|---|
| Weekly + trial | ~$7 | ~$54 |
| Annual + trial | ~$42 | ~$50 |

Annual wins the first day and loses the year. Weekly plans are now ~55% of app
subscription revenue, up from ~43% two years ago. Annual stays *offered* — a
couple who knows they want this should be able to say so and pay less — it is
simply no longer the silent default.

---

## 4. The front gate

`app/index.tsx` → `lib/accessGate.ts` → `resolveGate()`.

There is **no free full product**. After auth and onboarding, a couple with no
active entitlement and no running trial reaches the paywall, not the ritual.

The decision is a pure function with 11 tests (`lib/accessGate.test.ts`) because
it depends on two signals that settle at different times, and the expensive
failure is showing a paywall to someone who has already paid:

- `couple.isSubscribed` — the server's answer, `bool_or(profiles.is_subscribed)`
  across the couple's members. Authoritative, and **late**: seconds-to-minutes
  behind a purchase, and never written at all for a restore, which emits no
  webhook.
- the device's own RevenueCat answer — immediate, but speaks only for the person
  holding the phone.

Either being true means entitled. **Neither being true means nothing** until
RevenueCat has actually been asked, which is what `purchasesReady` records and
why `loading` is a distinct answer. Treating "not known yet" as "not entitled"
is the bug that file exists to prevent.

### Enforcement points

1. `app/index.tsx` — cold start.
2. `app/(app)/_layout.tsx` → `EntitlementGuard` — every route in the tab group.
   This is the one that matters: `pairing` and `join/[code]` both `router.replace`
   straight to `/(app)/`, and deep links and restored navigation state can land
   there without passing through the index.

### The one deliberate hole

`resolveGate` returns `app` when there is **no RevenueCat key for the platform
AND the build is `__DEV__`** — web and local builds without env vars, where
there is nothing to read and nothing to sell, so gating would make the app
impossible to open rather than protect revenue. A **production** build with a
missing key still gates, loudly, because that is a misconfiguration someone
needs to notice. Both conditions are required; there is a test for each.

---

## 5. One person pays

Unchanged by this work, and already correct:

- The webhook (`supabase/functions/revenuecat-webhook`) resolves the RevenueCat
  `app_user_id` (which is the Supabase user id — set in `configurePurchases`)
  to a profile and writes `profiles.is_subscribed`.
- `get_my_couple()` derives the couple's `is_subscribed` as
  `bool_or(profiles.is_subscribed)` across its members.

So whichever half of the couple subscribes, both halves are entitled, and the
partner who never paid never sees a wall. This is server-side, not a client
boolean.

### Webhook event policy

- **Grants:** `INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION`,
  `NON_RENEWING_PURCHASE`, `PRODUCT_CHANGE`, `TRANSFER`. Trial start arrives as
  `INITIAL_PURCHASE`.
- **Revokes:** `EXPIRATION`, `SUBSCRIPTION_PAUSED`.
- **`CANCELLATION` deliberately does not revoke.** In RevenueCat it means
  auto-renew was switched off; the subscription stays active until it expires.
  Treating it as a revocation previously took Premium away from people who had
  paid through the end of their term. A **refund** arrives as a `CANCELLATION`
  with a refund reason followed by an `EXPIRATION`, and it is the `EXPIRATION`
  that ends access.
- Revocation is per-profile, so the couple keeps access as long as *either*
  member still holds an entitlement — which falls out of `bool_or` for free.

No webhook changes were needed for this work.

---

## 6. Trial

21 days, requested from the stores and read back from `introPrice`. Full
Premium for the whole couple during the trial — identical to paid.

A single reminder fires **3 days before expiry** (day 18 of 21) —
`scheduleTrialEndingReminder()` in `services/notifications.ts`, scheduled from
`refreshEntitlement()` so it self-corrects on every cold start and entitlement
change, and cancels itself on conversion or cancellation.

Copy: *"Your free trial ends in a few days / Nothing changes tonight — your
nights can keep going, and one of you covers both."*

No countdown, and no "don't lose your streak". The streak belongs to the couple;
holding it as collateral for a payment is the dark pattern this product is meant
to be the alternative to.

---

## 7. Analytics

`lib/analytics.ts` — one typed `track()` with a single `sink()` to wire a
provider into. **Nothing leaves the device yet.** Events:

`paywall_view` · `paywall_cta_weekly_trial` · `paywall_cta_yearly` ·
`trial_started` · `purchase_completed` · `restore_completed` ·
`couple_premium_granted` · `paywall_dismiss_blocked`

Props are closed to `plan` / `source` / `trialDays` / `paired` by type, so an
answer, a name or an invite code cannot be attached by accident.

`paywall_dismiss_blocked` is the one worth watching: it counts people trying to
leave the front gate, which is how you find out whether the gate is set in the
right place.

---

## 8. Paywall copy

| Slot | Text |
|---|---|
| Headline | Keep your nights together |
| Lede | One of you unlocks Lunara for both. 21 days free. |
| Benefit 1 | Your nightly ritual and the reveal you open together |
| Benefit 2 | Every night you have kept — with voice notes, and your fox |
| Benefit 3 | A streak that belongs to both of you, not to whoever paid |
| Coverage | One of you subscribes and Lunara opens for both of you. Your partner never pays, and never sees a paywall. |
| Yearly badge | Best if you're in it for the long run · {price}/mo |
| CTA | Start {n}-Day Free Trial *(derived from the store)* |
| Footer | Restore purchases · Terms · Privacy · Apple EULA |

Benefits come from `PREMIUM_FEATURES` in `lib/entitlements.ts`, where each entry
still records the gate that enforces it, so a claim cannot outlive its feature.

The auto-renewal sentence (`priceSentence()`) is a **Guideline 3.1.2
requirement**, not decoration: it names the subscription, the period, the price
and that it renews until cancelled. Restore Purchases and the EULA link are
required too — do not remove them to tidy the layout.

### Gate mode

`/(modals)/paywall?gate=1` hides the close button, disables the swipe-down
gesture and removes the "Not now" escape, because there is nothing behind it to
go back to. **Restore stays** — it is App Review's requirement and it is a
returning subscriber's only way back in.

---

## What is no longer true

`lib/paywallMoment.ts`, `hooks/usePaywallMoment.ts`, their 9 tests and the
`PremiumMoment` card on the Tonight screen have been **removed**. They encoded
the opposite product: never offer Premium before the first mutual reveal, only
after three shared nights, only once. That rule protected a free tier that no
longer exists, and under a front gate it could never fire — `shouldOfferPremium`
returns false for anyone entitled, and nobody unentitled is inside the app.

`freeTierSummary()` is gone for the same reason; it promised the ritual, the
reveal and the streak were "free for both of you, always". `FREE_HISTORY_DAYS`
and `freeHistoryCutoffDate()` survive as a backstop inside `history.tsx` — if
the front gate is ever bypassed by a routing bug, the archive degrades instead
of opening. **It is not a free tier and should not be described as one.**
