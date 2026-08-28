import { SELF } from "cloudflare:test";
import { describe, expect, test } from "vitest";

function connect(
  session: number,
  nickname: string,
  development = false,
  room?: string,
): Promise<Response> {
  const mode = development ? "&development=true" : "";
  const invite = room ? `&room=${room}` : "";
  const host = development ? "localhost" : "example";
  return SELF.fetch(
    `http://${host}/connect?session=${session.toString(16).padStart(32, "0")}&nickname=${nickname}${mode}${invite}`,
    {
      headers: { Upgrade: "websocket" },
    },
  );
}

function next(
  socket: WebSocket,
  match?: (event: Record<string, unknown>) => boolean,
): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const onMessage = (event: MessageEvent) => {
      const parsed = JSON.parse(String(event.data)) as Record<string, unknown>;
      if (match && !match(parsed)) return;
      socket.removeEventListener("message", onMessage);
      resolve(parsed);
    };
    socket.addEventListener("message", onMessage);
  });
}

function close(socket: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    socket.addEventListener("close", () => resolve(), { once: true });
    socket.close();
  });
}

describe("chat service", () => {
  test("packs rooms to eight users and sends messages", async () => {
    const sockets: WebSocket[] = [];
    const rooms: string[] = [];

    for (let index = 1; index <= 9; index++) {
      const response = await connect(index, `user${index}`);
      expect(response.status).toBe(101);
      const socket = response.webSocket!;
      socket.accept();
      const ready = await next(socket);
      sockets.push(socket);
      rooms.push(String(ready.room));
    }

    expect(new Set(rooms.slice(0, 8)).size).toBe(1);
    expect(rooms[8]).not.toBe(rooms[0]);

    const received = next(sockets[1]!);
    sockets[0]!.send(JSON.stringify({ type: "message", text: "hello" }));
    expect(await received).toMatchObject({
      type: "message",
      message: { nickname: "user1", text: "hello" },
    });

    await Promise.all(sockets.slice(0, 2).map(close));
    const packed = await connect(10, "user10");
    const packedSocket = packed.webSocket!;
    packedSocket.accept();
    expect((await next(packedSocket)).room).toBe(rooms[0]);

    await Promise.all([...sockets.slice(2), packedSocket].map(close));
  });

  test("puts local development clients in one room", async () => {
    const first = await connect(20, "local1", true);
    const second = await connect(21, "local2", true);
    const firstSocket = first.webSocket!;
    const secondSocket = second.webSocket!;
    firstSocket.accept();
    secondSocket.accept();

    const firstReady = await next(firstSocket);
    const secondReady = await next(secondSocket);
    expect(firstReady.room).toBe(secondReady.room);

    await Promise.all([close(firstSocket), close(secondSocket)]);
  });

  test("puts clients with the same invite code in one room", async () => {
    const first = await connect(30, "friend1", false, "weekend-test");
    const second = await connect(31, "friend2", false, "weekend-test");
    const firstSocket = first.webSocket!;
    const secondSocket = second.webSocket!;
    firstSocket.accept();
    secondSocket.accept();

    expect((await next(firstSocket)).room).toBe((await next(secondSocket)).room);

    await Promise.all([close(firstSocket), close(secondSocket)]);
  });

  test("decrements presence when a socket closes", async () => {
    const first = await connect(50, "stays", false, "presence-room");
    const firstSocket = first.webSocket!;
    firstSocket.accept();
    expect(await next(firstSocket)).toMatchObject({ type: "ready", online: 1 });

    const joined = next(
      firstSocket,
      (event) => event.type === "presence" && event.online === 2,
    );
    const second = await connect(51, "leaves", false, "presence-room");
    const secondSocket = second.webSocket!;
    secondSocket.accept();
    expect(await next(secondSocket)).toMatchObject({ type: "ready", online: 2 });
    expect(await joined).toMatchObject({
      type: "presence",
      online: 2,
    });

    const left = next(
      firstSocket,
      (event) => event.type === "presence" && event.online === 1,
    );
    await close(secondSocket);
    expect(await left).toMatchObject({ type: "presence", online: 1 });

    await close(firstSocket);
  });

  test("moves stale assignments into an active room", async () => {
    const first = await connect(40, "returning");
    const firstSocket = first.webSocket!;
    firstSocket.accept();
    const staleRoom = String((await next(firstSocket)).room);
    await close(firstSocket);

    const second = await connect(41, "waiting");
    const secondSocket = second.webSocket!;
    secondSocket.accept();
    const activeRoom = String((await next(secondSocket)).room);
    expect(activeRoom).not.toBe(staleRoom);

    const reconnected = await connect(40, "returning");
    const reconnectedSocket = reconnected.webSocket!;
    reconnectedSocket.accept();
    expect((await next(reconnectedSocket)).room).toBe(activeRoom);

    await Promise.all([close(secondSocket), close(reconnectedSocket)]);
  });
});
