#!/usr/bin/env bash
# Deploy/update PULSE on the EC2 box. Run from the repo root after `git pull`.
# Requires: the shared `webnet` network + a `mongo` container already running
# (see deploy/docker-compose.prod.yml header), SESSION_SECRET in the environment.
set -euo pipefail

cd "$(dirname "$0")/.."

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
