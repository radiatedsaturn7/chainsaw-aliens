#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-}"
PORT="${2:-8000}"

has_remote() {
  git remote | grep -qx "$1"
}

resolve_remote_for_branch() {
  local branch="$1"
  local remotes=(origin upstream)
  for remote in "${remotes[@]}"; do
    if has_remote "$remote"; then
      git fetch "$remote"
      if git show-ref --verify --quiet "refs/remotes/$remote/$branch"; then
        echo "$remote"
        return 0
      fi
    fi
  done
  return 1
}

if [[ -n "$BRANCH" ]]; then
  echo "Resolving branch '$BRANCH' from remotes..."
  REMOTE="$(resolve_remote_for_branch "$BRANCH" || true)"
  if [[ -z "$REMOTE" ]]; then
    echo "Could not find branch '$BRANCH' on origin/upstream after fetch." >&2
    exit 1
  fi

  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    echo "Checking out existing local branch: $BRANCH"
    git checkout "$BRANCH"
  else
    echo "Creating local branch '$BRANCH' from $REMOTE/$BRANCH"
    git checkout -b "$BRANCH" "$REMOTE/$BRANCH"
  fi

  echo "Pulling latest for $REMOTE/$BRANCH"
  git pull --ff-only "$REMOTE" "$BRANCH"
else
  echo "No branch specified; pulling latest for current branch"
  git pull --ff-only
fi

python tools/dev_server.py "$PORT"
