#!/usr/bin/env bash
# Deploy/update PULSE on the EC2 box. Run from the repo root after `git pull`.
# Requires: the shared `webnet` network + a `mongo` container already running
# (see deploy/docker-compose.prod.yml header).
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE=/etc/tradyai/pulse.env

# Secrets must be a persistent, root-only file — never a shell export. Refuse to
# deploy without it, but drop a ready-to-use example (with a fresh secret) first.
if [ ! -f "$ENV_FILE" ]; then
  sudo mkdir -p /etc/tradyai
  if [ ! -f "$ENV_FILE.example" ]; then
    printf '# PULSE production secrets — root-only, git-ignored. Keep it permanent.\nSESSION_SECRET=%s\n' \
      "$(openssl rand -base64 48)" | sudo tee "$ENV_FILE.example" >/dev/null
    sudo chmod 600 "$ENV_FILE.example"
  fi
  echo "✗ Missing $ENV_FILE — refusing to deploy."
  echo "  An example with a fresh SESSION_SECRET is at $ENV_FILE.example"
  echo "  Review it, then:  sudo cp $ENV_FILE.example $ENV_FILE   (and re-run this script)"
  exit 1
fi
sudo chmod 600 "$ENV_FILE" || true   # keep the secret locked down

echo "→ installing the shared forwarded-proto map"
sudo cp deploy/forwarded-proto.conf /etc/nginx/conf.d/00-forwarded-proto.conf

echo "→ building + (re)starting the server container"
docker compose -f deploy/docker-compose.prod.yml up -d --build

echo "→ building the client for production"
VITE_SERVER_URL="https://pulse.tradyai.live" npm --prefix client ci
VITE_SERVER_URL="https://pulse.tradyai.live" npm --prefix client run build

echo "→ publishing the static client to /srv/pulse"
sudo mkdir -p /srv/pulse
sudo rsync -a --delete client/dist/ /srv/pulse/

echo "→ reloading nginx"
sudo cp deploy/nginx.conf /etc/nginx/conf.d/pulse.conf
sudo nginx -t && sudo nginx -s reload

echo "✓ PULSE deployed → https://pulse.tradyai.live"
