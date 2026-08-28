#!/bin/bash
# Keep thxdr registered on 8787 — restart greg hub if thxdr seat missing.
HUB=/tmp/omeglecode-prod-test/greg-from-acct-hub.mjs
LOG=/tmp/thxdr-ensure-hub.log
STOP_AT=$(date -d '2026-08-29T08:00:00Z' +%s 2>/dev/null || date -u -j -f '%Y-%m-%dT%H:%M:%SZ' '2026-08-29T08:00:00Z' +%s)

ensure() {
  local health log
  health=$(curl -sS 'http://127.0.0.1:8787/health' 2>/dev/null || echo '{}')
  if echo "$health" | grep -q '"nick":"thxdr"'; then
    return 0
  fi
  echo "[$(date -u +%FT%TZ)] thxdr missing — restarting greg hub" >> "$LOG"
  kill "$(lsof -t -iTCP:8787 -sTCP:LISTEN 2>/dev/null || true)" 2>/dev/null || true
  sleep 1
  cd /tmp/omeglecode-prod-test && node "$HUB" >> "$LOG" 2>&1 &
  sleep 4
}

while [ "$(date +%s)" -lt "$STOP_AT" ]; do
  ensure
  sleep 30
done
