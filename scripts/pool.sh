#!/usr/bin/env bash
# Reusable developer worktrees: scripts/pool.sh init | acquire <1|2|3> <branch> | release <1|2|3> | status
# Pool lives next to the repo: ../freejoy-app-pool/developerN, each a git worktree parked on pool/developerN.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
POOL="$ROOT/../freejoy-app-pool"
BASE="${POOL_BASE:-main}"

slot() { echo "$POOL/developer$1"; }

case "${1:-}" in
init)
  mkdir -p "$POOL"
  for n in 1 2 3; do
    d="$(slot "$n")"
    if [ -d "$d" ]; then echo "developer$n exists"; continue; fi
    git -C "$ROOT" worktree add -q -b "pool/developer$n" "$d" "$BASE"
    echo "developer$n created: $d"
  done ;;
status)
  for n in 1 2 3; do
    d="$(slot "$n")"
    [ -d "$d" ] || { echo "developer$n: missing (run init)"; continue; }
    echo "developer$n: $(git -C "$d" branch --show-current) dirty=$(git -C "$d" status --porcelain | wc -l)"
  done ;;
acquire)
  n="${2:?slot}"; branch="${3:?branch}"; d="$(slot "$n")"
  [ "$(git -C "$d" branch --show-current)" = "pool/developer$n" ] || { echo "developer$n is in use"; exit 1; }
  [ -z "$(git -C "$d" status --porcelain)" ] || { echo "developer$n is dirty"; exit 1; }
  git -C "$d" switch -q -c "$branch" "$BASE"
  (cd "$d/nextjs-frontend" && npm ci --no-audit --no-fund --silent)
  [ -f "$d/nextjs-frontend/.env.local" ] || cp "$ROOT/nextjs-frontend/.env.local" "$d/nextjs-frontend/.env.local" 2>/dev/null || true
  echo "developer$n ready on $branch: $d" ;;
release)
  n="${2:?slot}"; d="$(slot "$n")"; cur="$(git -C "$d" branch --show-current)"
  [ "$cur" != "pool/developer$n" ] || { echo "developer$n is already free"; exit 0; }
  git -C "$ROOT" branch --merged "$BASE" | grep -qx "[ *+]*$cur" || { echo "$cur is not merged into $BASE"; exit 1; }
  git -C "$d" switch -q -C "pool/developer$n" "$BASE"
  git -C "$d" branch -d "$cur"
  git -C "$d" clean -fdxq -e node_modules -e .env.local -e .next
  echo "developer$n released" ;;
*) echo "usage: $0 init | status | acquire <1|2|3> <branch> | release <1|2|3>"; exit 2 ;;
esac
