#!/bin/sh
set -eu

APP_DIR="/var/www/rintisai"
LOG_DIR="/var/log/rintisai"
URL="http://127.0.0.1:3000/"
PUBLIC_URL="${PUBLIC_URL:-https://rintisai.site/}"
RESOLV_CONF="/etc/resolv.conf"

mkdir -p "$LOG_DIR"

timestamp() {
  date -u +%Y-%m-%dT%H:%M:%SZ
}

ensure_dns() {
  if getent hosts api.cloudflare.com >/dev/null 2>&1 && getent hosts region1.v2.argotunnel.com >/dev/null 2>&1; then
    return 0
  fi

  echo "[$(timestamp)] dns failed: forcing public resolvers"
  touch /etc/.pve-ignore.resolv.conf 2>/dev/null || true
  printf 'nameserver 1.1.1.1\nnameserver 8.8.8.8\n' > "$RESOLV_CONF" 2>/dev/null || true
  resolvectl flush-caches >/dev/null 2>&1 || true
  getent hosts api.cloudflare.com >/dev/null 2>&1
}

ensure_cloudflared() {
  if ! systemctl is-active --quiet cloudflared; then
    echo "[$(timestamp)] cloudflared inactive: restarting"
    systemctl kill -s SIGKILL cloudflared >/dev/null 2>&1 || true
    systemctl reset-failed cloudflared >/dev/null 2>&1 || true
    systemctl start cloudflared >/dev/null 2>&1 || true
    sleep 5
  fi
}

ensure_dns || true
ensure_cloudflared

if curl -fsS --max-time 10 "$URL" >/dev/null 2>&1; then
  if curl -fsS --max-time 15 "$PUBLIC_URL" >/dev/null 2>&1; then
    echo "[$(timestamp)] health ok"
    exit 0
  fi
  echo "[$(timestamp)] public health failed: restarting cloudflared"
  systemctl kill -s SIGKILL cloudflared >/dev/null 2>&1 || true
  systemctl reset-failed cloudflared >/dev/null 2>&1 || true
  systemctl restart cloudflared >/dev/null 2>&1 || true
  sleep 8
  if curl -fsS --max-time 15 "$PUBLIC_URL" >/dev/null 2>&1; then
    echo "[$(timestamp)] tunnel recovery ok"
    exit 0
  fi
  echo "[$(timestamp)] tunnel recovery pending"
  exit 0
fi

echo "[$(timestamp)] health failed: restarting rintisai"

systemctl start pm2-root >/dev/null 2>&1 || true

if pm2 describe rintisai >/dev/null 2>&1; then
  pm2 restart rintisai >/dev/null 2>&1 || true
else
  cd "$APP_DIR"
  pm2 start npm --name rintisai -- start >/dev/null 2>&1 || true
fi

pm2 save >/dev/null 2>&1 || true
sleep 8

if curl -fsS --max-time 10 "$URL" >/dev/null 2>&1; then
  echo "[$(timestamp)] recovery ok"
  exit 0
fi

echo "[$(timestamp)] recovery failed"
exit 1
