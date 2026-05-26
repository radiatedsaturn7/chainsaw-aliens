#!/usr/bin/env bash
set -euo pipefail

EXPORT_ROOT="${1:-data/server-storage/files}"

if [[ ! -d "$EXPORT_ROOT" ]]; then
  echo "Export root not found: $EXPORT_ROOT" >&2
  exit 1
fi

echo "Project Files export root: $EXPORT_ROOT"
echo

find "$EXPORT_ROOT" -type f \
  | sed "s#^$EXPORT_ROOT/##" \
  | sort
