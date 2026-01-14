#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ ! -f "$ROOT_DIR/index.html" ]]; then
  echo "index.html not found. Run this script from the repository root." >&2
  exit 1
fi

echo "Chainsaw Aliens ready." 
echo "Tip: run ./run.sh to start a local server."
