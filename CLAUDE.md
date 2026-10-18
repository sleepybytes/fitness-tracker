@AGENTS.md

## Physical devices: always ask first

Never run a command that reaches the user's iPhone (or any physical device) without asking and getting a yes first, every time. Earlier approval does not carry over.
This covers anything that queries, connects to, pairs with, or installs on a real device, e.g.:
- `npm run ios:device` / `scripts/install-iphone.sh`
- `xcrun devicectl …` (list, info, install, launch, pair)
- `xcodebuild` or `expo run:ios` with a physical-device destination
- probing the phone on the network (`ping`, `dns-sd`, etc.)

Simulators, tests, lint, typecheck and web previews don't need permission. When a step needs the phone, say what you'd run and why, then wait.
