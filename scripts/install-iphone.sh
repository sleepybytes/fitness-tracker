#!/usr/bin/env bash
# Build the standalone (Release) app and install it on the connected iPhone.
# Re-run every 7 days when using a free Apple ID; logged data is kept.
#
# `expo run:ios --device` can't create the signing profile for a free Personal Team,
# so this calls xcodebuild with -allowProvisioningUpdates and installs with devicectl.
set -euo pipefail
cd "$(dirname "$0")/.."

for var in APPLE_TEAM_ID APP_BUNDLE_ID; do
  if [[ -z "${!var:-}" ]] && ! grep -qs "^$var=..*" .env.local; then
    echo "Missing $var. Copy .env.example to .env.local and fill it in." >&2
    exit 1
  fi
done

TMP_JSON="$(mktemp)"
trap 'rm -f "$TMP_JSON"' EXIT

DEVICE="${DEVICE:-}"
if [[ -z "$DEVICE" ]]; then
  xcrun devicectl list devices --json-output "$TMP_JSON" >/dev/null
  DEVICE="$(node -e '
    const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).result.devices
      .find((x) => x.hardwareProperties?.reality === "physical" && x.connectionProperties?.tunnelState !== "unavailable");
    if (d) console.log(d.hardwareProperties.udid);
  ' "$TMP_JSON")"
fi
if [[ -z "$DEVICE" ]]; then
  echo "No iPhone found. Plug it in, unlock it, and tap Trust." >&2
  exit 1
fi
echo "› Installing on device $DEVICE"

npx expo prebuild --platform ios
xcodebuild \
  -workspace ios/FitnessTracker.xcworkspace \
  -scheme FitnessTracker \
  -configuration Release \
  -destination "id=$DEVICE" \
  -derivedDataPath ios/build \
  -allowProvisioningUpdates \
  -allowProvisioningDeviceRegistration \
  -quiet \
  build
xcrun devicectl device install app --device "$DEVICE" ios/build/Build/Products/Release-iphoneos/FitnessTracker.app
echo "✔ Installed. Open Fitness Tracker on your iPhone."
