#!/usr/bin/env bash
set -euo pipefail

EXPORT_ROOT="${1:-data/server-storage/vfs}"

if [[ ! -d "$EXPORT_ROOT" ]]; then
  echo "Export root not found: $EXPORT_ROOT" >&2
  exit 1
fi

echo "VFS export root: $EXPORT_ROOT"
echo

find "$EXPORT_ROOT" -type f \
  | sed "s#^$EXPORT_ROOT/##" \
  | sort
