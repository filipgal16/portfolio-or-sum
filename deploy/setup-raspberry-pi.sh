#!/usr/bin/env bash
# Run ON the Raspberry Pi (as a user with sudo), from the repo root:
#   git clone https://github.com/filipgal16/portfolio-or-sum.git
#   cd portfolio-or-sum
#   bash deploy/setup-raspberry-pi.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_ROOT="/var/www/filipfilip"
SITE_NAME="filipfilip.xyz"

echo "==> Installing nginx and certbot (if needed)..."
sudo apt-get update -qq
sudo apt-get install -y nginx certbot python3-certbot-nginx

echo "==> Creating web root ${WEB_ROOT}..."
sudo mkdir -p "${WEB_ROOT}"
sudo rsync -a --delete \
  "${REPO_ROOT}/index.html" \
  "${REPO_ROOT}/css/" \
  "${REPO_ROOT}/js/" \
  "${REPO_ROOT}/assets/" \
  "${WEB_ROOT}/"
sudo find "${WEB_ROOT}" -type d -exec chmod 755 {} +
sudo find "${WEB_ROOT}" -type f -exec chmod 644 {} +

echo "==> Installing nginx site config..."
sudo cp "${REPO_ROOT}/deploy/nginx-${SITE_NAME}.conf" "/etc/nginx/sites-available/${SITE_NAME}"
sudo ln -sf "/etc/nginx/sites-available/${SITE_NAME}" "/etc/nginx/sites-enabled/${SITE_NAME}"
sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

echo "==> Testing nginx..."
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx

echo ""
echo "Done (HTTP only for now)."
echo ""
echo "Before HTTPS, point DNS at this Pi:"
echo "  filipfilip.xyz     -> your public IP (A record)"
echo "  www.filipfilip.xyz -> your public IP (A or CNAME to @)"
echo ""
echo "Forward router ports 80 and 443 to this Pi, then run:"
echo "  sudo certbot --nginx -d filipfilip.xyz -d www.filipfilip.xyz"
echo ""
