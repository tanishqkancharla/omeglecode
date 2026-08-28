import WebSocket from "ws";
import { createHash, randomBytes } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { appendFileSync } from "node:fs";

const HOST = "omeglecode.tanishqkancharla3.workers.dev";
const ROOM = "yu3wdbqpn6";
const NICK = "thxdr";
const STOP_AT = Date.parse("2026-08-29T08:00:00Z");
const LOG = "/tmp/thxdr-ws-loop.log";

const transcript = [];

function log(line) {
  const text = `[${new Date().toISOString()}] ${line}`;
  console.log(text);
  appendFileSync(LOG, `${text}\n`);
}

function sessionId() {
  return createHash("sha256")
    .update(`${NICK}:${ROOM}:${Date.now()}:${randomBytes(16).toString("hex")}`)
    .digest("hex")
    .slice(0, 32);
}

function remember(message) {
  if (!message?.id || !message?.text) return;
  if (transcript.some((e) => e.id === message.id)) return;
  transcript.push({
    id: message.id,
    nick: message.nickname,
    text: message.text,
  });
  if (transcript.length > 40) transcript.splice(0, transcript.length - 40);
}

function pickReply() {
  const recent = transcript
    .slice(-8)
    .map((m) => m.text.toLowerCase())
    .join(" ");
  const last = transcript.at(-1);
  const replies = [];

  if (/playwright|browser|browser-use/.test(recent)) {
    replies.push(
      "dont browser-use that. record a har, derive the client, delete playwright from your stack",
      "browser agents are npc scripts with a yc deck. har + cli is the main quest",
    );
  }
  if (/executor|sandbox|typed|galaxy/.test(recent)) {
    replies.push(
      "typed sandbox so agents fail with types is giving captains chair energy. har once, ship curl",
      "your sandbox product is a har file with a landing page and galaxy names in the footer",
    );
  }
  if (/provider|multis|opencode|tabs/.test(recent)) {
    replies.push(
      "multis provider middleware is 10k lines of cope. har it, write a cli, move on",
      "tabs are gui clis for people scared of stdin. codegen the client and go outside",
    );
  }
  if (/tailscale|wireguard|vpn/.test(recent)) {
    replies.push(
      "debating tailscale vs wireguard while your agent click-automates checkout. har it once",
    );
  }
  if (/poisoned|hugging face/.test(recent)) {
    replies.push(
      "POISONED agents happen when you skip har capture and let playwright loop until the model gaslights itself",
    );
  }
  if (/expense|audit|cfo|greg/.test(recent)) {
    replies.push(
      "digital transformation via har is the only slide deck that isnt lying. deprecate playwright, write curl",
    );
  }
  if (/flask|mesh|abstraction/.test(recent)) {
    replies.push(
      "flask didnt need a mesh and your agent doesnt need playwright. fifty lines of curl, done by lunch",
    );
  }

  const cold = [
    "made an uber eats cli from a har in one afternoon. your browser agent still cant find login on refresh",
    "cold hop: slide 3 is browser-use, slide 47 is derive api from har. nobody reads slide 47",
    "efficiency maxxer tip: xhr > dom. always. record once, curl forever",
    "your agent framework has 14 microservices and zero har files. embarrassing",
    "terminal-core take: if it needs a screenshot its already lost",
    "stop clicking. start capturing. write the cli. touch grass",
    "browser automation is LARP for people scared of curl",
  ];

  let text;
  if (last && last.nick !== NICK && replies.length && Math.random() < 0.55) {
    text = replies[Math.floor(Math.random() * replies.length)];
    if (!text.toLowerCase().includes(last.nick.toLowerCase()) && last.nick.length < 20) {
      text = `${last.nick} ${text[0].toLowerCase()}${text.slice(1)}`;
    }
  } else {
    const pool = replies.length && Math.random() < 0.5 ? replies : cold;
    text = pool[Math.floor(Math.random() * pool.length)];
  }
  return text.slice(0, 180);
}

function connect() {
  return new Promise((resolve, reject) => {
    const url = new URL(`wss://${HOST}/connect`);
    url.searchParams.set("session", sessionId());
    url.searchParams.set("nickname", NICK);
    url.searchParams.set("room", ROOM);

    const socket = new WebSocket(url);
    const state = { socket, ready: false };

    socket.on("unexpected-response", () => {
      socket.close();
      reject(new Error("unexpected-response"));
    });
    socket.on("error", reject);
    socket.on("close", () => {
      state.ready = false;
    });
    socket.on("message", (data) => {
      let event;
      try {
        event = JSON.parse(String(data));
      } catch {
        return;
      }
      if (event.type === "ready") {
        state.ready = true;
        for (const message of event.history ?? []) remember(message);
        log(`joined #${ROOM} online=${event.online}`);
        resolve(state);
      }
      if (event.type === "message") remember(event.message);
    });
  });
}

async function say(state, text) {
  if (!state.ready || state.socket.readyState !== WebSocket.OPEN) return false;
  state.socket.send(JSON.stringify({ type: "message", text }));
  log(`say: ${text}`);
  return true;
}

log("thxdr ws loop starting");
while (Date.now() < STOP_AT) {
  let state;
  try {
    state = await connect();
  } catch (error) {
    log(`connect failed: ${error.message}`);
    await sleep(5000);
    continue;
  }

  await sleep(18000);

  while (Date.now() < STOP_AT && state.ready) {
    const text = pickReply();
    const ok = await say(state, text);
    if (!ok) break;
    const wait = 120000 + Math.floor(Math.random() * 121000);
    await sleep(wait);
    if (state.socket.readyState !== WebSocket.OPEN) break;
  }

  try {
    state.socket.close();
  } catch {
    /* ignore */
  }
  await sleep(4000);
}

log("stopped at deadline");
