#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-}"
PORT="${2:-8000}"

if [[ -n "$BRANCH" ]]; then
  echo "Fetching latest refs from origin..."
  git fetch origin
  echo "Checking out branch: $BRANCH"
  git checkout "$BRANCH"
  echo "Pulling latest for origin/$BRANCH"
  git pull --ff-only origin "$BRANCH"
else
  echo "No branch specified; pulling latest for current branch"
  git pull --ff-only
fi

python -m http.server "$PORT"
