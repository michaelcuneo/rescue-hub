#!/usr/bin/env bash
# Explicitly deploy and seed identical fictional data into three independent stages.
set -euo pipefail
cd "$(dirname "$0")/.."

seed_only=false
if [[ "${1:-}" == "--seed-only" && $# -eq 1 ]]; then
  seed_only=true
elif [[ $# -ne 0 ]]; then
  echo "Usage: $0 [--seed-only]" >&2
  exit 2
fi
if [[ ! -t 0 ]]; then
  echo "Run in an interactive terminal, not CI or a pipe." >&2
  exit 1
fi
if [[ "$(git branch --show-current)" != "feature/maplibre-admin-map-poc" ]]; then
  echo "Checkout feature/maplibre-admin-map-poc first." >&2
  exit 1
fi

echo "AWS profile: ${AWS_PROFILE:-default}"
echo "Targets: michael, michaelcuneo, demo (three independent AWS stages)."
if [[ "$seed_only" == true ]]; then
  echo "Mode: add missing historical rescue and GPS milestone data only."
else
  echo "Mode: deploy SST-managed base demo fixtures, then enrich archive GPS."
fi
read -r -p "Type SEED ALL 3 to continue: " approval
if [[ "$approval" != "SEED ALL 3" ]]; then
  echo "Cancelled."
  exit 1
fi
for stage in michael michaelcuneo demo; do
  echo "=== Stage: $stage ==="
  if [[ "$seed_only" != true ]]; then
    npx sst deploy --stage "$stage"
  fi
  npx sst shell --stage "$stage" -- node packages/pc-rescues/scripts/seed-historical-rescues.mjs --stage "$stage"
  npx sst shell --stage "$stage" -- node packages/pc-rescues/scripts/seed-historical-rescues.mjs --stage "$stage" --write --enrich
done
echo "Completed all three stages."
