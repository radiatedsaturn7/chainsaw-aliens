#!/usr/bin/env bash
set -euo pipefail

DEST="vendor/webaudiofont"
BASE="https://surikov.github.io/webaudiofontdata"
KIT="Chaos_sf2_file"

mkdir -p "$DEST"

curl -L -o "$DEST/webaudiofont.js" \
  "$BASE/webaudiofont.js"

for NOTE in $(seq 35 81); do
  curl -L -o "$DEST/128${NOTE}_0_${KIT}.js" \
    "$BASE/sound/128${NOTE}_0_${KIT}.js"
done

echo "Downloaded WebAudioFont drum kit to $DEST"
du -sh "$DEST"
