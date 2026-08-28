import {
  limits,
  parseClientEvent,
  type ChatMessage,
  type ServerEvent,
} from "@omeglecode/protocol";
import type { Env, SocketData } from "./types.js";

const windowMs = 10_000;
const rate = 5;

export class ChatRoom implements DurableObject {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket")
      return new Response("Expected WebSocket", { status: 426 });
    const nickname = request.headers.get("X-Omeglecode-Nickname");
    const managed = request.headers.get("X-Omeglecode-Managed");
    const session = request.headers.get("X-Omeglecode-Session");
    const room = request.headers.get("X-Omeglecode-Room");
    if (!nickname || !session || !room || !managed)
      return new Response("Missing connection data", { status: 400 });

    const sockets = this.state.getWebSockets();
    if (sockets.length >= limits.room)
      return new Response("Room is full", { status: 409 });
    const taken = sockets.some(
      (socket) =>
        (socket.deserializeAttachment() as SocketData | undefined)?.nickname.toLowerCase() ===
        nickname.toLowerCase(),
    );
    if (taken)
      return new Response("Nickname is already in this room", { status: 409 });

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.state.acceptWebSocket(server);
    server.serializeAttachment({
      managed: managed === "true",
      nickname,
      session,
      sent: [],
    } satisfies SocketData);

    const history =
      (await this.state.storage.get<ChatMessage[]>("history")) ?? [];
    server.send(
      JSON.stringify({
        type: "ready",
        room,
        online: sockets.length + 1,
        history,
      } satisfies ServerEvent),
    );
    this.broadcast({ type: "presence", online: sockets.length + 1 });
    return new Response(undefined, { status: 101, webSocket: client });
  }

  async webSocketMessage(
    socket: WebSocket,
    raw: string | ArrayBuffer,
  ): Promise<void> {
    const data = socket.deserializeAttachment() as SocketData | undefined;
    if (!data || typeof raw !== "string") return;

    let event;
    try {
      event = parseClientEvent(raw);
    } catch {
      socket.send(
        JSON.stringify({
          type: "error",
          message: "Invalid message",
        } satisfies ServerEvent),
      );
      return;
    }
    if (!event) {
      socket.send(
        JSON.stringify({
          type: "error",
          message: `Messages must be 1-${limits.message} characters`,
        } satisfies ServerEvent),
      );
      return;
    }

    const now = Date.now();
    const sent = data.sent.filter((time) => now - time < windowMs);
    if (sent.length >= rate) {
      socket.send(
        JSON.stringify({
          type: "error",
          message: "Slow down",
        } satisfies ServerEvent),
      );
      return;
    }
    socket.serializeAttachment({ ...data, sent: [...sent, now] });

    const message = {
      id: crypto.randomUUID(),
      nickname: data.nickname,
      text: event.text,
      sentAt: now,
    };
    const history =
      (await this.state.storage.get<ChatMessage[]>("history")) ?? [];
    await this.state.storage.put(
      "history",
      [...history, message].slice(-limits.history),
    );
    this.broadcast({ type: "message", message });
  }

  async webSocketClose(socket: WebSocket): Promise<void> {
    const data = socket.deserializeAttachment() as SocketData | undefined;
    socket.close();
    this.broadcast({
      type: "presence",
      online: this.onlineCount(socket, data),
    });
    if (!data?.managed) return;
    const matcher = this.env.MATCHMAKER.get(
      this.env.MATCHMAKER.idFromName("global"),
    );
    await matcher.fetch("https://matchmaker/release", {
      method: "POST",
      body: JSON.stringify({
        room: this.state.id.toString(),
        session: data.session,
      }),
    });
  }

  webSocketError(socket: WebSocket): void {
    socket.close(1011, "WebSocket error");
  }

  private onlineCount(
    except?: WebSocket,
    leaving?: SocketData,
  ): number {
    const nick = leaving?.nickname.toLowerCase();
    const session = leaving?.session;
    return this.state.getWebSockets().filter((open) => {
      if (except && open === except) return false;
      if (open.readyState !== WebSocket.OPEN) return false;
      const data = open.deserializeAttachment() as SocketData | undefined;
      if (!data) return false;
      if (session && data.session === session) return false;
      if (nick && data.nickname.toLowerCase() === nick) return false;
      return true;
    }).length;
  }

  private broadcast(event: ServerEvent): void {
    const payload = JSON.stringify(event);
    for (const socket of this.state.getWebSockets()) {
      if (socket.readyState === WebSocket.OPEN) socket.send(payload);
    }
  }
}
