#!/usr/bin/env bash
# Regenerates assets/icon/png/*.png and assets/icon/wallee.icns from assets/icon/icon.svg.
# macOS only (uses qlmanage, sips, iconutil). The results are committed; run this only
# when the SVG changes.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC=assets/icon/icon.svg
OUT=assets/icon/png
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

qlmanage -t -s 1024 -o "$TMP" "$SRC" >/dev/null 2>&1
MASTER="$TMP/$(basename "$SRC").png"
test -f "$MASTER" || { echo "qlmanage produced no PNG"; exit 1; }

mkdir -p "$OUT"
for size in 16 32 64 128 256 512 1024; do
  sips -z "$size" "$size" "$MASTER" --out "$OUT/icon-$size.png" >/dev/null
done

ICONSET="$TMP/icon.iconset"
mkdir -p "$ICONSET"
cp "$OUT/icon-16.png"   "$ICONSET/icon_16x16.png"
cp "$OUT/icon-32.png"   "$ICONSET/icon_16x16@2x.png"
cp "$OUT/icon-32.png"   "$ICONSET/icon_32x32.png"
cp "$OUT/icon-64.png"   "$ICONSET/icon_32x32@2x.png"
cp "$OUT/icon-128.png"  "$ICONSET/icon_128x128.png"
cp "$OUT/icon-256.png"  "$ICONSET/icon_128x128@2x.png"
cp "$OUT/icon-256.png"  "$ICONSET/icon_256x256.png"
cp "$OUT/icon-512.png"  "$ICONSET/icon_256x256@2x.png"
cp "$OUT/icon-512.png"  "$ICONSET/icon_512x512.png"
cp "$OUT/icon-1024.png" "$ICONSET/icon_512x512@2x.png"
iconutil -c icns "$ICONSET" -o assets/icon/wallee.icns
ls -la "$OUT" assets/icon/wallee.icns
