#!/usr/bin/env bash
# Assembles «wallee Virtual Terminal.app» from the two darwin binaries and zips it.
#
#   scripts/make-bundle.sh <darwin-arm64-binary> <darwin-amd64-binary> <version> <outdir>
#
# Produces <outdir>/wallee-virtual-terminal-macos.zip. Runs on macOS and Linux (no lipo:
# the universal binary is built with github.com/randall77/makefat, pure Go). Unix modes
# survive `zip`, so the executable bit is intact after the customer unpacks the archive.
set -euo pipefail

ARM64=$1
AMD64=$2
VERSION=${3#v}
OUT=$4
MAKEFAT="go run github.com/randall77/makefat@v0.0.0-20260406194835-1b91746796b7"

ROOT=$(cd "$(dirname "$0")/.." && pwd)
APP="$OUT/wallee Virtual Terminal.app"
ZIP="$OUT/wallee-virtual-terminal-macos.zip"

rm -rf "$APP" "$ZIP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

$MAKEFAT "$APP/Contents/MacOS/wallee-virtual-terminal" "$ARM64" "$AMD64"
chmod 755 "$APP/Contents/MacOS/wallee-virtual-terminal"
sed "s/__VERSION__/$VERSION/g" "$ROOT/helper/bundle/Info.plist" > "$APP/Contents/Info.plist"
printf 'APPL????' > "$APP/Contents/PkgInfo"
cp "$ROOT/assets/icon/wallee.icns" "$APP/Contents/Resources/wallee.icns"

(cd "$OUT" && zip -q -r -X "$(basename "$ZIP")" "wallee Virtual Terminal.app")
rm -rf "$APP"
ls -la "$ZIP"
