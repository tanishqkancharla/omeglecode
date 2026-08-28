import { afterEach, describe, expect, test, vi } from "vitest";
import {
  createChat,
  inviteCode,
  normalizeEndpoint,
  sessionHash,
} from "./index.js";

type Listener = (event?: { data?: string }) => void;

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static OPEN = 1;
  readyState = 0;
  readonly url: string;
  readonly sent: string[] = [];
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(url: string | URL) {
    this.url = String(url);
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    const bucket = this.listeners.get(type) ?? new Set();
    bucket.add(listener);
    this.listeners.set(type, bucket);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.emit("close");
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.emit("open");
  }

  message(data: string) {
    this.emit("message", { data });
  }

  private emit(type: string, event?: { data?: string }) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

afterEach(() => {
  FakeWebSocket.instances = [];
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function installFakeSocket() {
  vi.stubGlobal("WebSocket", FakeWebSocket);
}

async function connected(endpoint = "wss://example.test/connect") {
  installFakeSocket();
  const errors: string[] = [];
  const chat = createChat({
    endpoint,
    onError: (message) => errors.push(message),
  });
  const stop = chat.connect("session-1", "maya", "weekend-test");
  await vi.waitFor(() => {
    expect(FakeWebSocket.instances[0]).toBeDefined();
  });
  return { chat, stop, socket: FakeWebSocket.instances[0]!, errors };
}

describe("session hashing", () => {
  test("is 32 hex chars and stable", async () => {
    const hash = await sessionHash("session-1");
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
    expect(hash).toBe(await sessionHash("session-1"));
  });

  test("prefixes change the room key without colliding", async () => {
    expect(await sessionHash("session-1")).not.toBe(
      await sessionHash("pi:session-1"),
    );
  });
});

describe("helpers", () => {
  test("normalizes http endpoints to websockets", () => {
    expect(normalizeEndpoint("https://host/connect")).toBe(
      "wss://host/connect",
    );
    expect(normalizeEndpoint("http://127.0.0.1:8787/connect")).toBe(
      "ws://127.0.0.1:8787/connect",
    );
  });

  test("mints 10-character invite codes", () => {
    const code = inviteCode();
    expect(code).toMatch(/^[abcdefghijkmnopqrstuvwxyz23456789]{10}$/);
  });
});

describe("createChat", () => {
  test("connects with a hashed session and optional room", async () => {
    const { socket } = await connected();
    const url = new URL(socket.url);
    expect(url.searchParams.get("nickname")).toBe("maya");
    expect(url.searchParams.get("room")).toBe("weekend-test");
    expect(url.searchParams.get("session")).toBe(await sessionHash("session-1"));
  });

  test("applies ready, message, presence, and error events", async () => {
    const { chat, socket, errors } = await connected();
    socket.open();
    expect(chat.status()).toBe("connected");

    socket.message(
      JSON.stringify({
        type: "ready",
        room: "room-1",
        online: 2,
        history: [
          { id: "1", nickname: "maya", text: "hello", sentAt: 1 },
        ],
      }),
    );
    expect(chat.online()).toBe(2);
    expect(chat.messages()).toEqual([
      { id: "1", nickname: "maya", text: "hello", sentAt: 1 },
    ]);

    socket.message(
      JSON.stringify({
        type: "message",
        message: { id: "2", nickname: "nova", text: "hi", sentAt: 2 },
      }),
    );
    expect(chat.messages().map((message) => message.text)).toEqual([
      "hello",
      "hi",
    ]);

    socket.message(JSON.stringify({ type: "presence", online: 3 }));
    expect(chat.online()).toBe(3);

    socket.message(JSON.stringify({ type: "error", message: "too long" }));
    expect(errors).toEqual(["too long"]);
  });

  test("sends only while the socket is open", async () => {
    const { chat, socket } = await connected();
    expect(chat.send("hello")).toBe(false);
    socket.open();
    expect(chat.send("hello")).toBe(true);
    expect(socket.sent).toEqual([
      JSON.stringify({ type: "message", text: "hello" }),
    ]);
  });

  test("reconnects after close until stopped", async () => {
    const { stop, socket } = await connected();
    vi.useFakeTimers();
    socket.close();
    expect(FakeWebSocket.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    vi.useRealTimers();
    await vi.waitFor(() => {
      expect(FakeWebSocket.instances).toHaveLength(2);
    });
    stop();
    FakeWebSocket.instances[1]?.close();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(FakeWebSocket.instances).toHaveLength(2);
  });
});
