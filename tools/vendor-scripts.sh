#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(git rev-parse --show-toplevel)
cd "$ROOT_DIR"

VENDOR_DIR="vendor"
SOUNDFONT_DIR="$VENDOR_DIR/soundfonts/FluidR3_GM"
SOUNDFONT_BASE="https://raw.githubusercontent.com/gleitz/midi-js-soundfonts/master/FluidR3_GM"
SOUNDFONT_PLAYER_URL="https://raw.githubusercontent.com/danigb/soundfont-player/master/dist/soundfont-player.min.js"

mkdir -p "$SOUNDFONT_DIR"

curl -fsSL "$SOUNDFONT_PLAYER_URL" -o "$VENDOR_DIR/soundfont-player.min.js"

soundfont_names=$(node --input-type=module -e "import { GM_SOUNDFONT_NAMES, GM_DRUM_KITS } from './src/audio/gm.js'; const names = new Set(GM_SOUNDFONT_NAMES.filter(Boolean)); GM_DRUM_KITS.forEach((kit) => { if (kit.soundfont) names.add(kit.soundfont); }); names.add('synth_drum'); console.log([...names].join('\\n')); ")

missing=0
while IFS= read -r name; do
  if [[ -z "$name" ]]; then
    continue
  fi
  url="$SOUNDFONT_BASE/${name}-mp3.js"
  dest="$SOUNDFONT_DIR/${name}-mp3.js"
  if ! curl -fsSL "$url" -o "$dest"; then
    echo "Missing SoundFont script: $url" >&2
    missing=1
  fi
done <<< "$soundfont_names"

if [[ "$missing" -ne 0 ]]; then
  echo "One or more SoundFont scripts failed to download." >&2
  exit 1
fi

echo "Vendor scripts updated in $VENDOR_DIR"
