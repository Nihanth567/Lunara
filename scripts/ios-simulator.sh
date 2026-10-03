#!/usr/bin/env bash
# Build Lunara and run it on an iOS Simulator — no Apple developer account,
# no signing certificate.
#
# Why this exists: `npx expo run:ios` refuses to build even for a simulator
# when the app has the Sign in with Apple capability ("No code signing
# certificates are available to use"), so a developer who isn't on the Lunara
# Apple team could not open the app at all. A simulator build doesn't need a
# signature, so this builds with signing turned off.
#
# The trade: an unsigned build has no Sign in with Apple and no push. To test
# as a signed-in couple without them, create a partner with
# `npm run dev:partner` and join with the code it prints (see README).
#
# Usage: npm run ios:sim [-- "iPhone 17"]
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "No .env — copy .env.example to .env and fill in the Supabase URL and anon key (ask the project owner)." >&2
  exit 1
fi

DEVICE_NAME="${1:-}"
DERIVED=".expo/ios-simulator-build"

# Pick a simulator: the one named, else a booted one, else the first iPhone.
if [ -n "$DEVICE_NAME" ]; then
  UDID=$(xcrun simctl list devices available | grep -F "$DEVICE_NAME (" | head -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/')
else
  UDID=$(xcrun simctl list devices booted | grep -E "iPhone" | head -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/')
  [ -z "$UDID" ] && UDID=$(xcrun simctl list devices available | grep -E "iPhone" | head -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/')
fi
if [ -z "${UDID:-}" ]; then
  echo "No iPhone simulator found. Install one from Xcode → Settings → Components." >&2
  exit 1
fi
echo "› Simulator $UDID"
xcrun simctl boot "$UDID" 2>/dev/null || true
open -a Simulator

# Generate the native project if it isn't there (it isn't committed).
if [ ! -d ios ]; then
  echo "› Generating the iOS project (expo prebuild)"
  npx expo prebuild -p ios --no-install
fi
echo "› Installing pods"
(cd ios && pod install --silent)

echo "› Building (unsigned, Debug, simulator) — the first build takes several minutes"
xcodebuild \
  -workspace ios/Lunara.xcworkspace \
  -scheme Lunara \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination "id=$UDID" \
  -derivedDataPath "$DERIVED" \
  CODE_SIGNING_ALLOWED=NO \
  build | grep -E "error:|warning: .*deprecated|BUILD (SUCCEEDED|FAILED)" || true

APP=$(find "$DERIVED/Build/Products/Debug-iphonesimulator" -maxdepth 1 -name "*.app" | head -1)
if [ -z "$APP" ]; then
  echo "Build failed — run the xcodebuild command above without the grep to see why." >&2
  exit 1
fi

BUNDLE_ID=$(/usr/libexec/PlistBuddy -c "Print CFBundleIdentifier" "$APP/Info.plist")
xcrun simctl install "$UDID" "$APP"
SLUG=$(node -p "require('./app.json').expo.slug")
echo "› Installed $BUNDLE_ID. Starting the dev server — the app opens once it's up."
echo "  (First launch only: tap Open on \"Open in Lunara?\", then Continue on the developer-menu card.)"
# Open straight into this dev server rather than the dev client's server picker.
( until curl -s localhost:8081/status | grep -q running; do sleep 1; done
  xcrun simctl openurl "$UDID" "exp+${SLUG}://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081" ) &
npx expo start --dev-client
