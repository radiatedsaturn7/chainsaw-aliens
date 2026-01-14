#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-8000}"
python -m http.server "$PORT"
