# Host on Raspberry Pi at filipfilip.xyz

Your domain **filipfilip.xyz** is at **OVH**. The site is static (HTML/CSS/JS), so a Pi with **nginx** is enough.

## Overview

```text
Internet -> router (ports 80/443) -> Raspberry Pi -> nginx -> /var/www/filipfilip
         -> OVH DNS (A records to your home public IP)
         -> Let's Encrypt (certbot) for HTTPS
```

## 1. Raspberry Pi (one-time)

On the Pi (Raspberry Pi OS or Ubuntu):

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git nginx certbot python3-certbot-nginx
```

Clone and install:

```bash
git clone https://github.com/filipgal16/portfolio-or-sum.git
cd portfolio-or-sum
bash deploy/setup-raspberry-pi.sh
```

That copies files to `/var/www/filipfilip` and enables nginx for `filipfilip.xyz` and `www.filipfilip.xyz`.

## 2. Router

Forward **TCP 80** and **TCP 443** from your router to the Pi’s **local IP** (e.g. `192.168.1.50`). Give the Pi a **fixed DHCP reservation** so the IP does not change.

## 3. OVH DNS (filipfilip.xyz)

In the [OVH control panel](https://www.ovh.com/manager/) → Domain → **filipfilip.xyz** → **DNS zone**:

| Subdomain | Type | Target |
|-----------|------|--------|
| `@` (empty) | **A** | Your **public** home IP (see [whatismyip.com](https://whatismyip.com) from home) |
| `www` | **A** | Same IP, **or** CNAME to `filipfilip.xyz.` |

Remove conflicting parking/redirect records if OVH added defaults. Wait up to a few hours for DNS (often 15–30 minutes).

**Dynamic IP:** If your ISP changes your IP, update the A record or use OVH’s dynamic DNS / a small updater script on the Pi.

## 4. HTTPS (after DNS works)

From the Pi:

```bash
sudo certbot --nginx -d filipfilip.xyz -d www.filipfilip.xyz
```

Follow prompts (email, agree to terms). Certbot edits nginx for SSL and sets up renewal.

Check:

```bash
curl -I https://filipfilip.xyz
```

## 5. Updates after you change the site

**Option A – on the Pi:**

```bash
cd ~/portfolio-or-sum
git pull
sudo rsync -a --delete index.html css/ js/ assets/ /var/www/filipfilip/
```

**Option B – from your computer:**

```bash
cd portfolio-or-sum
export PI_HOST=pi@YOUR_PI_IP
bash deploy/sync-to-pi.sh
```

(Sync target must be writable; you may need `REMOTE=/home/pi/filipfilip` first time and adjust nginx `root`, or sync with sudo on the Pi.)

## 6. Optional: redirect www to apex

After certbot, you can add a second server block or use certbot’s suggested config so `www` and apex both serve the same site (already configured in `deploy/nginx-filipfilip.xyz.conf`).

## 7. Old host (filipfilip.tojest.dev)

When **filipfilip.xyz** works, you can stop using the Mikrus VPS or point the old subdomain elsewhere. No change is required in the repo for that.

## Troubleshooting

| Problem | Check |
|---------|--------|
| Site not loading | DNS: `dig +short filipfilip.xyz A` shows your public IP |
| Connection refused | Router port forward, Pi firewall: `sudo ufw allow 'Nginx Full'` |
| 502 / wrong site | `sudo nginx -t`, `root` path is `/var/www/filipfilip` |
| HTTPS fails | Port 443 forwarded; DNS must point to you before certbot |

## Files in this repo

- [`deploy/nginx-filipfilip.xyz.conf`](../deploy/nginx-filipfilip.xyz.conf) – nginx vhost
- [`deploy/setup-raspberry-pi.sh`](../deploy/setup-raspberry-pi.sh) – first-time Pi setup
- [`deploy/sync-to-pi.sh`](../deploy/sync-to-pi.sh) – rsync deploy from your PC
