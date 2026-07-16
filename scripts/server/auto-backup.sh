#!/bin/sh
set -eu

APP_DIR="/var/www/rintisai"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/rintisai}"
LOG_DIR="/var/log/rintisai"
LOCK_DIR="/tmp/rintisai-auto-backup.lock"
KEEP_COUNT="${KEEP_COUNT:-28}"

mkdir -p "$BACKUP_DIR" "$LOG_DIR"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] backup skipped: lock exists"
  exit 0
fi

cleanup() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

DB_PATH="$APP_DIR/dev.db"
if [ ! -f "$DB_PATH" ]; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] backup failed: missing $DB_PATH"
  exit 1
fi

STAMP="$(date -u +%Y%m%d%H%M%S)"
TMP_BACKUP="$BACKUP_DIR/dev-auto-$STAMP.tmp"
FINAL_BACKUP="$BACKUP_DIR/dev-auto-$STAMP.db"

sqlite3 "$DB_PATH" ".backup '$TMP_BACKUP'"
mv "$TMP_BACKUP" "$FINAL_BACKUP"

old_files=$(ls -1t "$BACKUP_DIR"/*.db 2>/dev/null | awk "NR>$KEEP_COUNT") || true
if [ -n "$old_files" ]; then
  printf '%s\n' "$old_files" | while IFS= read -r file; do
    [ -n "$file" ] && rm -f "$file"
  done
fi

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] backup ok: $FINAL_BACKUP"
