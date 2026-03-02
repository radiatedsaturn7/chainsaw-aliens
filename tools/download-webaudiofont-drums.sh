#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
DEST="$REPO_ROOT/vendor/webaudiofont"
BASE="https://surikov.github.io/webaudiofontdata"
PLAYER_URL="https://unpkg.com/webaudiofont@3.0.4/npm/dist/WebAudioFontPlayer.js"
KIT="Chaos_sf2_file"

mkdir -p "$DEST"


cleanup_legacy_relative_output() {
  local legacy_dir="$PWD/vendor/webaudiofont"
  if [[ "$legacy_dir" == "$DEST" ]]; then
    return 0
  fi
  if [[ ! -d "$legacy_dir" ]]; then
    return 0
  fi

  if [[ -f "$legacy_dir/webaudiofont.js" ]] || compgen -G "$legacy_dir/128*_0_*_sf2_file.js" >/dev/null; then
    echo "Removing misplaced legacy output at: $legacy_dir"
    rm -rf "$legacy_dir"
  fi

  local legacy_vendor
  legacy_vendor="$(dirname -- "$legacy_dir")"
  if [[ -d "$legacy_vendor" ]] && [[ -z "$(find "$legacy_vendor" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
    rmdir "$legacy_vendor"
  fi
}

cleanup_legacy_relative_output

curl -fL -o "$DEST/webaudiofont.js" \
  "$PLAYER_URL"

for NOTE in $(seq 35 81); do
  curl -fL -o "$DEST/128${NOTE}_0_${KIT}.js" \
    "$BASE/sound/128${NOTE}_0_${KIT}.js"
done

echo "Downloaded WebAudioFont drum kit to $DEST"
du -sh "$DEST"
