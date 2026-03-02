#!/usr/bin/env bash
set -euo pipefail

# Downloads WebAudioFont drum-note assets for multiple logical drum kits.
#
# By default, all logical kits map to Chaos_sf2_file because that source is
# reliably available. To get different kit timbres, provide a mapping file via:
#   WEB_AUDIOFONT_KIT_MAP=path/to/kit-map.json ./tools/download-webaudiofont-all-drum-kits.sh
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

DEST_DIR="vendor/webaudiofont"
BASE_URL="https://surikov.github.io/webaudiofontdata/sound"
PLAYER_URL="https://unpkg.com/webaudiofont@3.0.4/npm/dist/WebAudioFontPlayer.js"

KIT_MAP_FILE="${WEB_AUDIOFONT_KIT_MAP:-}"
if [[ -z "${KIT_MAP_FILE}" && -f "tools/webaudiofont-drum-kit-map.json" ]]; then
  KIT_MAP_FILE="tools/webaudiofont-drum-kit-map.json"
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

create_alias_kit() {
  local logical="$1"
  local source="$2"
  local alias="${logical}_kit"
  if [[ "$alias" == "$source" ]]; then
    return 0
  fi
  echo "Creating alias files for '$logical' -> '$source' as '$alias'..."
  for note in $(seq 35 81); do
    cp "$DEST_DIR/128${note}_0_${source}.js" "$DEST_DIR/128${note}_0_${alias}.js"
  done
}

for logical in standard room power electronic jazz brush orchestra sfx; do
  source="${KIT_MAP[$logical]}"
  if download_source_notes "$source"; then
    create_alias_kit "$logical" "$source"
  else
    echo "WARN: logical kit '$logical' unresolved because source '$source' could not be downloaded." >&2
  fi
done

echo
printf 'Kit mapping used:\n'
for logical in standard room power electronic jazz brush orchestra sfx; do
  printf '  %-10s -> %s\n' "$logical" "${KIT_MAP[$logical]}"
done

echo
echo "Done. Files written to: $DEST_DIR"
