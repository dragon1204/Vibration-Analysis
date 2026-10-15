#!/bin/sh
# Deploy immutable GHCR images on the VPS with health verification and rollback.
#   scripts/deploy.sh 3f2a9c1    -> deploy a specific commit tag (recommended)
#   scripts/deploy.sh latest     -> deploy the moving latest tag
# .env must contain SM_REGISTRY=ghcr.io/<owner>/smartmotor; login to GHCR once.
set -eu
cd "$(dirname "$0")/.."

TAG="${1:-latest}"
TIMEOUT_S="${DEPLOY_TIMEOUT_S:-180}"
SERVICES="api ingest analytics notifier web"
PREVIOUS_TAG="$(sed -n 's/^SM_TAG=//p' .env | tail -n 1)"
PREVIOUS_TAG="${PREVIOUS_TAG:-latest}"

set_tag() {
  next="$1"
  tmp=".env.deploy.$$"
  sed '/^SM_TAG=/d' .env > "$tmp"
  printf '\nSM_TAG=%s\n' "$next" >> "$tmp"
  mv "$tmp" .env
}

all_ready() {
  for service in $SERVICES; do
    cid="$(docker compose ps -q "$service")"
    [ -n "$cid" ] || return 1
    [ "$(docker inspect -f '{{.State.Running}}' "$cid")" = "true" ] || return 1
  done
  for service in api web; do
    cid="$(docker compose ps -q "$service")"
    [ "$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid")" = "healthy" ] || return 1
  done
}

wait_ready() {
  elapsed=0
  while [ "$elapsed" -lt "$TIMEOUT_S" ]; do
    if all_ready; then
      return 0
    fi
    sleep 5
    elapsed=$((elapsed + 5))
  done
  return 1
}

rollback() {
  echo "Release $TAG failed health verification; rolling back to $PREVIOUS_TAG" >&2
  set_tag "$PREVIOUS_TAG"
  docker compose pull api ingest analytics notifier web || true
  docker compose up -d --no-build api ingest analytics notifier web || true
  if wait_ready; then
    echo "Rollback to $PREVIOUS_TAG completed" >&2
  else
    echo "Rollback also failed; operator action is required" >&2
  fi
  docker compose ps --format '{{.Service}}\t{{.Image}}\t{{.Status}}' >&2 || true
  exit 1
}

echo "Pre-pulling release $TAG (current: $PREVIOUS_TAG)"
SM_TAG="$TAG" docker compose pull api ingest analytics notifier web
set_tag "$TAG"
docker compose up -d --no-build api ingest analytics notifier web || rollback
wait_ready || rollback

# Do not prune here: retaining the previous local image makes emergency rollback
# possible even when GHCR or the network is unavailable.
echo "Release $TAG is healthy"
docker compose ps --format '{{.Service}}\t{{.Image}}\t{{.Status}}'
