import WebSocket from "ws";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { appendFileSync } from "node:fs";

const HOST = "omeglecode.tanishqkancharla3.workers.dev";
const PORT = 8787;
const GEN = 3;
const LOG = "/tmp/thxdr-hub.log";
const STOP_AT = Date.parse("2026-08-29T08:00:00Z");

const ROSTER = [
  { nick: "thxdr", venue: "yu3wdbqpn6" },
  { nick: "SkibidiGary", venue: "yu3wdbqpn6" },
];

function log(line) {
  const text = `[${new Date().toISOString()}] ${line}`;
  console.log(text);
  appendFileSync(LOG, `${text}\n`);
}

function sessionId(seed) {
  return createHash("sha256")
    .update(`${seed}:${Date.now()}:${randomBytes(16).toString("hex")}`)
    .digest("hex")
    .slice(0, 32);
}

const seats = new Map();
const transcripts = new Map();

function transcript(venue) {
  if (!transcripts.has(venue)) transcripts.set(venue, []);
  return transcripts.get(venue);
}

function remember(venue, message) {
  if (!message?.id || !message?.text) return;
  const log = transcript(venue);
  if (log.some((entry) => entry.id === message.id)) return;
  log.push({
    id: message.id,
    nick: message.nickname,
    text: message.text,
    sentAt: message.sentAt,
  });
  if (log.length > 40) log.splice(0, log.length - 40);
}

function connectSeat(spec) {
  const url = new URL(`wss://${HOST}/connect`);
  url.searchParams.set("session", sessionId(`${spec.nick}:${spec.venue}`));
  url.searchParams.set("nickname", spec.nick);
  url.searchParams.set("room", spec.venue);

  const socket = new WebSocket(url);
  const seat = seats.get(spec.nick) ?? {
    ...spec,
    socket: undefined,
    online: 0,
    room: undefined,
    ready: false,
  };
  seat.socket = socket;
  seat.ready = false;
  seats.set(spec.nick, seat);

  socket.on("unexpected-response", () => scheduleReconnect(spec));
  socket.on("error", (error) => log(`${spec.nick} error ${error.message}`));
  socket.on("close", () => {
    seat.ready = false;
    if (Date.now() < STOP_AT) scheduleReconnect(spec);
  });
  socket.on("message", (data) => {
    let event;
    try {
      event = JSON.parse(String(data));
    } catch {
      return;
    }
    if (event.type === "ready") {
      seat.ready = true;
      seat.online = event.online;
      seat.room = event.room;
      for (const message of event.history ?? []) remember(spec.venue, message);
      log(`${spec.nick} joined #${spec.venue} online=${event.online}`);
    }
    if (event.type === "presence") seat.online = event.online;
    if (event.type === "message") remember(spec.venue, event.message);
  });
}

const reconnectTimers = new Map();
function scheduleReconnect(spec) {
  if (reconnectTimers.has(spec.nick)) return;
  const timer = setTimeout(() => {
    reconnectTimers.delete(spec.nick);
    if (Date.now() >= STOP_AT) return;
    connectSeat(spec);
  }, 4000);
  reconnectTimers.set(spec.nick, timer);
}

function say(nick, text, gen) {
  if (gen !== GEN) return { ok: false, error: "stale" };
  const seat = seats.get(nick);
  const payload = String(text ?? "").trim().slice(0, 180);
  if (!seat?.ready || seat.socket?.readyState !== WebSocket.OPEN || !payload) {
    return { ok: false, error: "not connected or empty" };
  }
  seat.socket.send(JSON.stringify({ type: "message", text: payload }));
  log(`${nick}: ${payload}`);
  return { ok: true };
}

function logFor(nick) {
  const seat = seats.get(nick);
  if (!seat) return { error: "unknown nick" };
  return {
    you: nick,
    venue: seat.venue,
    online: seat.online,
    ready: seat.ready,
    vibe: "ironic twitter caricature in a 3am nerd chat. Coherent. Half reply, half hop in. Never claim to be the real person.",
    gen: GEN,
    messages: transcript(seat.venue).slice(-20).map((message) => ({
      nick: message.nick,
      text: message.text,
      you: message.nick === nick,
    })),
  };
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${PORT}`);
  const send = (status, body) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  };
  if (request.method === "GET" && url.pathname === "/health") {
    return send(200, {
      ok: true,
      gen: GEN,
      seats: [...seats.values()].map((seat) => ({
        nick: seat.nick,
        venue: seat.venue,
        ready: seat.ready,
        online: seat.online,
      })),
    });
  }
  if (request.method === "GET" && url.pathname === "/log") {
    const nick = url.searchParams.get("nick");
    return send(nick ? 200 : 400, nick ? logFor(nick) : { error: "nick required" });
  }
  if (request.method === "POST" && url.pathname === "/say") {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      return send(400, { error: "invalid json" });
    }
    return send(200, say(body.nick, body.text, body.gen));
  }
  send(404, { error: "not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  log(`thxdr hub on 127.0.0.1:${PORT} gen=${GEN}`);
  for (const spec of ROSTER) connectSeat(spec);
});

setTimeout(() => {
  for (const seat of seats.values()) {
    try {
      seat.socket?.close();
    } catch {
      /* ignore */
    }
  }
  server.close();
  process.exit(0);
}, Math.max(0, STOP_AT - Date.now()));
