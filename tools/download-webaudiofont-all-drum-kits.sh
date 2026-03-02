#!/usr/bin/env bash
set -euo pipefail

# Downloads WebAudioFont drum-note assets for GM drum-kit programs (0-7).
#
# Output files are always written under <repo>/vendor/webaudiofont so they are
# usable by the app regardless of the directory from which this script runs.
#
# Optional kit map:
#   WEB_AUDIOFONT_KIT_MAP=tools/webaudiofont-drum-kit-map.json ./tools/download-webaudiofont-all-drum-kits.sh
#
# Mapping file format:
# {
#   "standard": "Chaos_sf2_file",
#   "room": "FluidR3_GM_sf2_file",
#   "power": "Aspirin_sf2_file",
#   "electronic": "JCLive_sf2_file",
#   "jazz": "SomeOtherKitToken",
#   "brush": "SomeOtherKitToken",
#   "orchestra": "SomeOtherKitToken",
#   "sfx": "SomeOtherKitToken"
# }

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
DEST_DIR="$REPO_ROOT/vendor/webaudiofont"
BASE_URL="https://surikov.github.io/webaudiofontdata/sound"
PLAYER_URL="https://unpkg.com/webaudiofont@3.0.4/npm/dist/WebAudioFontPlayer.js"

KIT_MAP_FILE="${WEB_AUDIOFONT_KIT_MAP:-}"
if [[ -z "${KIT_MAP_FILE}" && -f "$REPO_ROOT/tools/webaudiofont-drum-kit-map.json" ]]; then
  KIT_MAP_FILE="$REPO_ROOT/tools/webaudiofont-drum-kit-map.json"
fi

declare -A KIT_MAP=(
  [standard]="Chaos_sf2_file"
  [room]="Chaos_sf2_file"
  [power]="Chaos_sf2_file"
  [electronic]="Chaos_sf2_file"
  [jazz]="Chaos_sf2_file"
  [brush]="Chaos_sf2_file"
  [orchestra]="Chaos_sf2_file"
  [sfx]="Chaos_sf2_file"
)

declare -A KIT_PRESET=(
  [standard]=0
  [room]=1
  [power]=2
  [electronic]=3
  [jazz]=4
  [brush]=5
  [orchestra]=6
  [sfx]=7
)

if [[ -n "${KIT_MAP_FILE}" ]]; then
  if ! command -v jq >/dev/null 2>&1; then
    echo "ERROR: jq is required when WEB_AUDIOFONT_KIT_MAP is provided." >&2
    exit 1
  fi
  for key in "${!KIT_MAP[@]}"; do
    value="$(jq -r --arg key "$key" '.[$key] // empty' "$KIT_MAP_FILE")"
    if [[ -n "$value" && "$value" != "null" ]]; then
      KIT_MAP[$key]="$value"
    fi
  done
fi

mkdir -p "$DEST_DIR"

cleanup_legacy_relative_output() {
  local legacy_dir="$PWD/vendor/webaudiofont"
  if [[ "$legacy_dir" == "$DEST_DIR" ]]; then
    return 0
  fi
  if [[ ! -d "$legacy_dir" ]]; then
    return 0
  fi

  # Older versions wrote to ./vendor/webaudiofont relative to the caller's CWD.
  # If that misplaced directory looks like WebAudioFont output, remove it.
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

echo "Downloading WebAudioFont player..."
curl -fL "$PLAYER_URL" -o "$DEST_DIR/webaudiofont.js"

declare -A DOWNLOADED_SOURCES=()

is_source_available() {
  local source="$1"
  local url="$BASE_URL/12836_0_${source}.js"
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' "$url")"
  [[ "$code" == "200" ]]
}

download_source_notes() {
  local source="$1"
  if [[ -n "${DOWNLOADED_SOURCES[$source]:-}" ]]; then
    return 0
  fi
  if ! is_source_available "$source"; then
    echo "WARN: source '$source' is not available at $BASE_URL (skipping)." >&2
    return 1
  fi
  echo "Downloading source kit '$source' (notes 35-81)..."
  for note in $(seq 35 81); do
    curl -fL "$BASE_URL/128${note}_0_${source}.js" -o "$DEST_DIR/128${note}_0_${source}.js"
  done
  DOWNLOADED_SOURCES[$source]=1
  return 0
}

create_preset_alias_files() {
  local logical="$1"
  local source="$2"
  local preset="$3"

  if [[ "$preset" == "0" && "$source" == "Chaos_sf2_file" ]]; then
    return 0
  fi

  echo "Creating preset alias files for '$logical' (preset $preset) from '$source'..."
  for note in $(seq 35 81); do
    local src="$DEST_DIR/128${note}_0_${source}.js"
    local dst="$DEST_DIR/128${note}_${preset}_Chaos_sf2_file.js"
    python - "$src" "$dst" "$note" "$source" "$preset" <<'PY'
import pathlib
import re
import sys

src, dst, note, source, preset = sys.argv[1:]
text = pathlib.Path(src).read_text()
text = re.sub(
    rf"_drum_{note}_0_{re.escape(source)}",
    f"_drum_{note}_{preset}_Chaos_sf2_file",
    text,
)
pathlib.Path(dst).write_text(text)
PY
  done
}

for logical in standard room power electronic jazz brush orchestra sfx; do
  source="${KIT_MAP[$logical]}"
  preset="${KIT_PRESET[$logical]}"
  if download_source_notes "$source"; then
    create_preset_alias_files "$logical" "$source" "$preset"
  else
    echo "WARN: logical kit '$logical' unresolved because source '$source' could not be downloaded." >&2
  fi
done

echo
printf 'Kit mapping used:\n'
for logical in standard room power electronic jazz brush orchestra sfx; do
  printf '  %-10s -> %s (preset %s)\n' "$logical" "${KIT_MAP[$logical]}" "${KIT_PRESET[$logical]}"
done

echo
printf 'Done. Files written to: %s\n' "$DEST_DIR"
