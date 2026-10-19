#!/bin/sh
# Forced command for the GitHub Actions deploy key (~/.ssh/authorized_keys on the VPS):
#   command="/opt/smartmotor/scripts/ci-deploy.sh",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty ssh-ed25519 AAAA… github-deploy
# The key can do exactly one thing: "deploy <git-sha>". stdin carries a tar.gz of the host-side
# files compose needs (docker-compose.yml, scripts/, emqx/*.conf). Code ships inside the GHCR
# images built by the same workflow; .env and certificates on the VPS are never touched.
set -eu
APP=/opt/smartmotor
TAG="$(printf '%s' "${SSH_ORIGINAL_COMMAND:-}" | sed -n 's/^deploy \([0-9a-f]\{7,40\}\)$/\1/p')"
if [ -z "$TAG" ]; then
  echo "usage: deploy <git-sha>" >&2
  exit 2
fi
cd "$APP"
mkdir -p backups
STAMP="$(date +%Y%m%d-%H%M%S)"
tar czf "backups/predeploy-$STAMP-$TAG.tgz" docker-compose.yml scripts emqx/emqx.conf emqx/acl.conf .env 2>/dev/null || true

INCOMING="$(mktemp -d)"
trap 'rm -rf "$INCOMING"' EXIT
tar xzf - -C "$INCOMING"
# Only these paths may be replaced from CI.
for f in docker-compose.yml .env.example emqx/emqx.conf emqx/acl.conf; do
  [ -f "$INCOMING/$f" ] && install -m 644 "$INCOMING/$f" "$APP/$f"
done
if [ -d "$INCOMING/scripts" ]; then
  for f in "$INCOMING"/scripts/*.sh; do
    [ -f "$f" ] && install -m 755 "$f" "$APP/scripts/$(basename "$f")"
  done
fi

echo "Deploying $TAG"
exec sh "$APP/scripts/deploy.sh" "$TAG"
