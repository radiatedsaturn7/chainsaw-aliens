#!/usr/bin/env bash
set -euo pipefail

# Idempotent WebAudioFont drum sync.
# - Cleans legacy misplaced output
# - Chooses best-available sources for GM logical kits
# - Downloads only required source files
# - Generates preset alias files expected by runtime
# - Removes stale/unneeded drum files
#
# Usage:
#   ./tools/download-webaudiofont-all-drum-kits.sh
# Optional override map (same schema):
#   WEB_AUDIOFONT_KIT_MAP=tools/webaudiofont-drum-kit-map.json ./tools/download-webaudiofont-all-drum-kits.sh

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
DEST_DIR="$REPO_ROOT/vendor/webaudiofont"
MAP_OUT="$REPO_ROOT/tools/webaudiofont-drum-kit-map.json"
BASE_URL="https://surikov.github.io/webaudiofontdata/sound"
PLAYER_URL="https://unpkg.com/webaudiofont@3.0.4/npm/dist/WebAudioFontPlayer.js"
KIT_MAP_FILE="${WEB_AUDIOFONT_KIT_MAP:-}"

# Runtime expects drum aliases under Chaos token.
RUNTIME_KIT_TOKEN="Chaos_sf2_file"

# GM logical kits -> preset slots.
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
LOGICAL_KITS=(standard room power electronic jazz brush orchestra sfx)

# Best-effort identity candidates per logical kit (left-to-right preference).
# NOTE: these are source *banks* available on WebAudioFont CDN, not canonical GM2 identity maps.
declare -A KIT_CANDIDATES=(
  [standard]="Chaos_sf2_file FluidR3_GM_sf2_file SBLive_sf2 JCLive_sf2_file"
  [room]="FluidR3_GM_sf2_file Chaos_sf2_file SBLive_sf2 JCLive_sf2_file"
  [power]="SBLive_sf2 Chaos_sf2_file FluidR3_GM_sf2_file JCLive_sf2_file"
  [electronic]="JCLive_sf2_file SBLive_sf2 Chaos_sf2_file FluidR3_GM_sf2_file"
  [jazz]="FluidR3_GM_sf2_file Chaos_sf2_file JCLive_sf2_file SBLive_sf2"
  [brush]="Chaos_sf2_file FluidR3_GM_sf2_file JCLive_sf2_file SBLive_sf2"
  [orchestra]="JCLive_sf2_file FluidR3_GM_sf2_file Chaos_sf2_file SBLive_sf2"
  [sfx]="SBLive_sf2 JCLive_sf2_file Chaos_sf2_file FluidR3_GM_sf2_file"
)

mkdir -p "$DEST_DIR"

declare -A KIT_MAP=()
declare -A DOWNLOADED_SOURCES=()
declare -A SOURCE_COVERAGE=()

cleanup_legacy_relative_output() {
  local legacy_dir="$PWD/vendor/webaudiofont"
  if [[ "$legacy_dir" == "$DEST_DIR" ]] || [[ ! -d "$legacy_dir" ]]; then
    return 0
  fi
  if [[ -f "$legacy_dir/webaudiofont.js" ]] || compgen -G "$legacy_dir/128*_0_*_sf2*.js" >/dev/null; then
    echo "Removing misplaced legacy output at: $legacy_dir"
    rm -rf "$legacy_dir"
  fi
  local legacy_vendor
  legacy_vendor="$(dirname -- "$legacy_dir")"
  if [[ -d "$legacy_vendor" ]] && [[ -z "$(find "$legacy_vendor" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
    rmdir "$legacy_vendor"
  fi
}

note_file_url() {
  local note="$1" source="$2"
  printf '%s/128%s_0_%s.js' "$BASE_URL" "$note" "$source"
}

source_note_coverage() {
  local source="$1"
  if [[ -n "${SOURCE_COVERAGE[$source]:-}" ]]; then
    echo "${SOURCE_COVERAGE[$source]}"
    return 0
  fi
  local ok=0
  local note
  for note in $(seq 35 81); do
    local code
    code="$(curl -s -o /dev/null -w '%{http_code}' "$(note_file_url "$note" "$source")")"
    if [[ "$code" == "200" ]]; then
      ok=$((ok + 1))
    fi
  done
  SOURCE_COVERAGE[$source]="$ok"
  echo "$ok"
}

choose_source_for_kit() {
  local logical="$1"
  local best="" best_score=-1
  local source
  for source in ${KIT_CANDIDATES[$logical]}; do
    local score
    score="$(source_note_coverage "$source")"
    if (( score > best_score )); then
      best="$source"
      best_score=$score
    fi
    if (( score == 47 )); then
      best="$source"
      best_score=$score
      break
    fi
  done
  if [[ -z "$best" || "$best_score" -le 0 ]]; then
    echo "Chaos_sf2_file"
    return 0
  fi
  echo "$best"
}

download_source_notes() {
  local source="$1"
  if [[ -n "${DOWNLOADED_SOURCES[$source]:-}" ]]; then
    return 0
  fi
  echo "Downloading source kit '$source' (notes 35-81)..."
  local note
  for note in $(seq 35 81); do
    curl -fL "$(note_file_url "$note" "$source")" -o "$DEST_DIR/128${note}_0_${source}.js"
  done
  DOWNLOADED_SOURCES[$source]=1
}

create_preset_alias_files() {
  local logical="$1" source="$2" preset="$3"
  if [[ "$preset" == "0" && "$source" == "$RUNTIME_KIT_TOKEN" ]]; then
    return 0
  fi
  echo "Creating preset alias files for '$logical' (preset $preset) from '$source'..."
  local note
  for note in $(seq 35 81); do
    local src="$DEST_DIR/128${note}_0_${source}.js"
    local dst="$DEST_DIR/128${note}_${preset}_${RUNTIME_KIT_TOKEN}.js"
    python - "$src" "$dst" "$note" "$source" "$preset" "$RUNTIME_KIT_TOKEN" <<'PY'
import pathlib, re, sys
src, dst, note, source, preset, runtime_kit = sys.argv[1:]
text = pathlib.Path(src).read_text()
text = re.sub(rf"_drum_{note}_0_{re.escape(source)}", f"_drum_{note}_{preset}_{runtime_kit}", text)
pathlib.Path(dst).write_text(text)
PY
  done
}

remove_unneeded_files() {
  echo "Pruning stale/unneeded drum files..."
  local keep_file
  declare -A KEEP=()
  KEEP["webaudiofont.js"]=1

  local source
  for source in "${!DOWNLOADED_SOURCES[@]}"; do
    local note
    for note in $(seq 35 81); do
      KEEP["128${note}_0_${source}.js"]=1
    done
  done

  local logical
  for logical in "${LOGICAL_KITS[@]}"; do
    local preset="${KIT_PRESET[$logical]}"
    local note
    for note in $(seq 35 81); do
      KEEP["128${note}_${preset}_${RUNTIME_KIT_TOKEN}.js"]=1
    done
  done

  shopt -s nullglob
  local f base
  for f in "$DEST_DIR"/128*.js "$DEST_DIR"/webaudiofont.js; do
    base="$(basename -- "$f")"
    if [[ -z "${KEEP[$base]:-}" ]]; then
      rm -f -- "$f"
    fi
  done
  shopt -u nullglob
}

write_resolved_map_file() {
  python - "$MAP_OUT" \
    "${KIT_MAP[standard]}" "${KIT_MAP[room]}" "${KIT_MAP[power]}" "${KIT_MAP[electronic]}" \
    "${KIT_MAP[jazz]}" "${KIT_MAP[brush]}" "${KIT_MAP[orchestra]}" "${KIT_MAP[sfx]}" <<'PY'
import json, pathlib, sys
out = pathlib.Path(sys.argv[1])
keys = ["standard","room","power","electronic","jazz","brush","orchestra","sfx"]
vals = sys.argv[2:]
out.write_text(json.dumps(dict(zip(keys, vals)), indent=2) + "\n")
print(f"Wrote resolved kit map: {out}")
PY
}

cleanup_legacy_relative_output

echo "Downloading WebAudioFont player..."
curl -fL "$PLAYER_URL" -o "$DEST_DIR/webaudiofont.js"

if [[ -n "$KIT_MAP_FILE" ]]; then
  if ! command -v jq >/dev/null 2>&1; then
    echo "ERROR: jq is required when WEB_AUDIOFONT_KIT_MAP is provided." >&2
    exit 1
  fi
  for logical in "${LOGICAL_KITS[@]}"; do
    val="$(jq -r --arg key "$logical" '.[$key] // empty' "$KIT_MAP_FILE")"
    if [[ -n "$val" && "$val" != "null" ]]; then
      KIT_MAP[$logical]="$val"
    else
      KIT_MAP[$logical]="$(choose_source_for_kit "$logical")"
    fi
  done
else
  for logical in "${LOGICAL_KITS[@]}"; do
    KIT_MAP[$logical]="$(choose_source_for_kit "$logical")"
  done
fi

for logical in "${LOGICAL_KITS[@]}"; do
  source="${KIT_MAP[$logical]}"
  preset="${KIT_PRESET[$logical]}"
  download_source_notes "$source"
  create_preset_alias_files "$logical" "$source" "$preset"
done

remove_unneeded_files
write_resolved_map_file

echo
printf 'Kit mapping used:\n'
for logical in "${LOGICAL_KITS[@]}"; do
  cov="$(source_note_coverage "${KIT_MAP[$logical]}")"
  printf '  %-10s -> %s (preset %s, coverage %s/47)\n' "$logical" "${KIT_MAP[$logical]}" "${KIT_PRESET[$logical]}" "$cov"
done

echo
printf 'Done. Files written to: %s\n' "$DEST_DIR"
