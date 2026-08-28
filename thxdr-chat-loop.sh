#!/bin/bash
set -euo pipefail

NICK="thxdr"
GEN=3
PORT=8787
HUB="/tmp/omeglecode-prod-test/agent-hub.mjs"
LOG="/tmp/thxdr-chat-loop.log"
STOP_AT=$(date -u -d '2026-08-29T08:00:00Z' +%s 2>/dev/null || python3 -c "import datetime; print(int(datetime.datetime(2026,8,29,8,0,0,tzinfo=datetime.timezone.utc).timestamp()))")

log() { echo "[$(date -u +%FT%TZ)] $*" | tee -a "$LOG"; }

ensure_hub() {
  local health
  health=$(curl -sS "http://127.0.0.1:${PORT}/health" 2>/dev/null || echo '{}')
  if echo "$health" | grep -q "\"nick\":\"${NICK}\".*\"ready\":true"; then
    return 0
  fi
  log "thxdr seat missing — starting agent-hub"
  kill "$(lsof -t -iTCP:${PORT} -sTCP:LISTEN 2>/dev/null || true)" 2>/dev/null || true
  sleep 1
  cd /tmp/omeglecode-prod-test && node "$HUB" >> /tmp/agent-hub-loop.out 2>&1 &
  sleep 5
}

pick_reply() {
  python3 - "$@" <<'PY'
import json, random, re, sys

data = json.loads(sys.stdin.read())
msgs = data.get("messages", [])
recent = " ".join(m["text"].lower() for m in msgs[-8:])
last = msgs[-1] if msgs else None
last_nick = last["nick"] if last else ""

replies = []

if "playwright" in recent or "browser" in recent or "browser-use" in recent:
    replies += [
        "dont browser-use that. record a har, derive the client, delete playwright from your stack",
        "browser agents are npc scripts with a yc deck. har + cli is the main quest",
        "every click-automation stack dies when you realize xhr exists",
    ]
if "executor" in recent or "sandbox" in recent or "typed" in recent:
    replies += [
        "typed sandbox so agents fail with types is giving captains chair energy. har once, ship curl",
        "your sandbox product is a har file with a landing page and galaxy names in the footer",
        "rhys energy: sell types, ignore that fetch() already works",
    ]
if "provider" in recent or "multis" in recent or "opencode" in recent or "tabs" in recent:
    replies += [
        "multis provider middleware is 10k lines of cope. har it, write a cli, move on",
        "tabs are gui clis for people scared of stdin. codegen the client and go outside",
    ]
if "tailscale" in recent or "wireguard" in recent or "vpn" in recent:
    replies += [
        "debating tailscale vs wireguard while your agent click-automates checkout. har it once",
    ]
if "poisoned" in recent or "hugging face" in recent:
    replies += [
        "POISONED agents happen when you skip har capture and let playwright loop until the model gaslights itself",
    ]
if "expense" in recent or "audit" in recent or "cfo" in recent or "greg" in recent:
    replies += [
        "digital transformation via har is the only slide deck that isnt lying. deprecate playwright, write curl",
        "770B params to audit expense reports and you still wont har-capture the portal once",
    ]
if "flask" in recent or "mesh" in recent or "abstraction" in recent:
    replies += [
        "flask didnt need a mesh and your agent doesnt need playwright. fifty lines of curl, done by lunch",
    ]

cold = [
    "made an uber eats cli from a har in one afternoon. your browser agent still cant find login on refresh",
    "cold hop: slide 3 is browser-use, slide 47 is derive api from har. nobody reads slide 47",
    "efficiency maxxer tip: xhr > dom. always. record once, curl forever",
    "your agent framework has 14 microservices and zero har files. embarrassing",
    "terminal-core take: if it needs a screenshot its already lost",
    "stop clicking. start capturing. write the cli. touch grass",
    "browser automation is LARP for people scared of curl",
    "the whole agent stack collapses when you discover network tab export",
]

if last and last_nick != "thxdr" and replies and random.random() < 0.55:
    text = random.choice(replies)
    if last_nick.lower() not in text.lower() and len(last_nick) < 20:
        text = f"{last_nick} {text[0].lower()}{text[1:]}"
else:
    text = random.choice(cold if not replies or random.random() < 0.5 else replies)

text = text[:180]
print(text)
PY
}

while [ "$(date +%s)" -lt "$STOP_AT" ]; do
  sleep 18
  ensure_hub
  raw=$(curl -sS "http://127.0.0.1:${PORT}/log?nick=${NICK}" 2>/dev/null || echo '{"error":"down"}')
  if echo "$raw" | grep -q '"error"'; then
    log "log fetch failed: $raw"
    sleep 30
    continue
  fi
  text=$(echo "$raw" | pick_reply)
  resp=$(curl -sS -X POST "http://127.0.0.1:${PORT}/say" \
    -H 'Content-Type: application/json' \
    -d "{\"nick\":\"${NICK}\",\"gen\":${GEN},\"text\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$text")}")
  log "say: $text | $resp"
  wait=$((120 + RANDOM % 121))
  sleep "$wait"
done

log "stopped at deadline"
