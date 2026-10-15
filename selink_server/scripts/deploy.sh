#!/bin/sh
# Deploy prebuilt images from GHCR on the VPS (no source code, no build here).
#   scripts/deploy.sh            -> tag "latest"
#   scripts/deploy.sh 3f2a9c1    -> a specific commit (rollback = deploy an older tag)
# .env must contain SM_REGISTRY=ghcr.io/<owner>/smartmotor ; run `docker login ghcr.io` once.
set -eu
cd "$(dirname "$0")/.."
TAG="${1:-latest}"
sed -i "/^SM_TAG=/d" .env && echo "SM_TAG=$TAG" >> .env
docker compose pull api ingest analytics notifier web
docker compose up -d --no-build api ingest analytics notifier web
docker image prune -f >/dev/null
docker compose ps --format '{{.Service}}\t{{.Image}}\t{{.Status}}'
