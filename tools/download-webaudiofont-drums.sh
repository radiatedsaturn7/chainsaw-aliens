#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
DEST="$REPO_ROOT/vendor/webaudiofont"
BASE="https://surikov.github.io/webaudiofontdata"
PLAYER_URL="https://unpkg.com/webaudiofont@3.0.4/npm/dist/WebAudioFontPlayer.js"
KIT="Chaos_sf2_file"

mkdir -p "$DEST"

curl -fL -o "$DEST/webaudiofont.js" \
  "$PLAYER_URL"

for NOTE in $(seq 35 81); do
  curl -fL -o "$DEST/128${NOTE}_0_${KIT}.js" \
    "$BASE/sound/128${NOTE}_0_${KIT}.js"
done

echo "Downloaded WebAudioFont drum kit to $DEST"
du -sh "$DEST"
