#!/bin/sh
set -eu

APP_DIR="/var/www/rintisai"
LOG_DIR="/var/log/rintisai"
URL="http://127.0.0.1:3000/"

mkdir -p "$LOG_DIR"

timestamp() {
  date -u +%Y-%m-%dT%H:%M:%SZ
}

if curl -fsS --max-time 10 "$URL" >/dev/null 2>&1; then
  echo "[$(timestamp)] health ok"
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
