#!/usr/bin/env bash
# Push site files from your laptop to the Pi (run from repo root).
#
# Usage:
#   export PI_HOST=pi@192.168.1.50    # or pi@your-public-ip
#   export PI_PORT=22                 # optional
#   bash deploy/sync-to-pi.sh
#
# Requires: rsync, SSH key login recommended

set -euo pipefail

PI_HOST="${PI_HOST:?Set PI_HOST, e.g. pi@192.168.1.50}"
PI_PORT="${PI_PORT:-22}"
REMOTE="${REMOTE:-/var/www/filipfilip}"

RSYNC_SSH="ssh -p ${PI_PORT}"

echo "==> Syncing to ${PI_HOST}:${REMOTE}..."
rsync -avz --delete \
  -e "${RSYNC_SSH}" \
  --exclude '.git' \
  --exclude 'deploy' \
  --exclude 'README.md' \
  --exclude '.gitignore' \
  ./ "${PI_HOST}:${REMOTE}/"

echo "Done. Reload nginx on the Pi if needed: sudo systemctl reload nginx"
