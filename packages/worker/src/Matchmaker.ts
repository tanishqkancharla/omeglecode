import { inviteCode, limits, validRoomCode } from "@omeglecode/protocol";
import type { Assignment, Env, Stats } from "./types.js";

type Session = {
  connected: boolean;
  expiresAt: number;
  room: string;
};

type Room = { count: number };

const ttl = 6 * 60 * 60 * 1000;

export async function trackEvent(
  env: Env,
  event: "join" | "message",
  room: string,
): Promise<void> {
  await env.MATCHMAKER.get(env.MATCHMAKER.idFromName("global")).fetch(
    "https://matchmaker/track",
    {
      method: "POST",
      body: JSON.stringify({ event, room }),
    },
  );
}

export class Matchmaker implements DurableObject {
  constructor(
    private readonly state: DurableObjectState,
    _env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/stats" && request.method === "GET")
      return this.stats();
    if (request.method !== "POST")
      return new Response("Method not allowed", { status: 405 });
    if (url.pathname === "/assign") return this.assign(await request.text());
    if (url.pathname === "/release")
      return this.release(await request.json<Assignment>());
    if (url.pathname === "/track") {
      try {
        return this.track(
          await request.json<{ event?: unknown; room?: unknown }>(),
        );
      } catch {
        return new Response("Invalid body", { status: 400 });
      }
    }
    return new Response("Not found", { status: 404 });
  }

  private async assign(sessionID: string): Promise<Response> {
    if (!/^[a-f0-9]{32}$/.test(sessionID))
      return new Response("Invalid session", { status: 400 });

    const assignment = await this.state.storage.transaction(async (storage) => {
      const key = `session:${sessionID}`;
      const current = await storage.get<Session>(key);
      if (current?.connected) return;

      if (current && current.expiresAt > Date.now()) {
        const roomKey = `room:${current.room}`;
        const room = await storage.get<Room>(roomKey);
        if (room && room.count > 0 && room.count < limits.room) {
          await storage.put(roomKey, { count: room.count + 1 });
          await storage.put(key, {
            ...current,
            connected: true,
            expiresAt: Date.now() + ttl,
          });
          return current.room;
        }
      }

      const rooms = await storage.list<Room>({ prefix: "room:" });
      for (const [roomKey, room] of rooms) {
        if (room.count === 0) await storage.delete(roomKey);
      }
      const available = [...rooms.entries()].filter(
        ([, room]) => room.count > 0 && room.count < limits.room,
      );
      available.sort(
        ([firstKey, first], [secondKey, second]) =>
          second.count - first.count || firstKey.localeCompare(secondKey),
      );
      let room = available[0]?.[0].slice(5);
      if (!room) {
        do {
          room = inviteCode();
        } while (await storage.get<Room>(`room:${room}`));
      }
      const roomKey = `room:${room}`;
      const record = (await storage.get<Room>(roomKey)) ?? { count: 0 };
      await storage.put(roomKey, { count: record.count + 1 });
      await storage.put(key, {
        connected: true,
        expiresAt: Date.now() + ttl,
        room,
      } satisfies Session);
      return room;
    });

    if (!assignment)
      return new Response("Session is already connected", { status: 409 });
    return Response.json({
      room: assignment,
      session: sessionID,
    } satisfies Assignment);
  }

  private async release(assignment: Assignment): Promise<Response> {
    await this.state.storage.transaction(async (storage) => {
      const key = `session:${assignment.session}`;
      const session = await storage.get<Session>(key);
      if (!session?.connected || session.room !== assignment.room) return;
      const roomKey = `room:${assignment.room}`;
      const room = await storage.get<Room>(roomKey);
      await storage.put(key, { ...session, connected: false });
      const count = Math.max(0, (room?.count ?? 1) - 1);
      if (count === 0) {
        await storage.delete(roomKey);
        return;
      }
      await storage.put(roomKey, { count });
    });
    return new Response(undefined, { status: 204 });
  }

  private async track(body: {
    event?: unknown;
    room?: unknown;
  }): Promise<Response> {
    const event = body.event;
    const room = typeof body.room === "string" ? body.room : "";
    if (event !== "join" && event !== "message")
      return new Response("Invalid event", { status: 400 });
    if (room !== "matchmaker" && room !== "development" && !validRoomCode(room))
      return new Response("Invalid room", { status: 400 });

    const metric = event === "join" ? "joins" : "messages";
    await this.state.storage.transaction(async (storage) => {
      const totalKey = `stats:total:${metric}`;
      const roomKey = `stats:room:${room}:${metric}`;
      const total = (await storage.get<number>(totalKey)) ?? 0;
      const count = (await storage.get<number>(roomKey)) ?? 0;
      await storage.put(totalKey, total + 1);
      await storage.put(roomKey, count + 1);
    });
    return new Response(undefined, { status: 204 });
  }

  private async stats(): Promise<Response> {
    const joins =
      (await this.state.storage.get<number>("stats:total:joins")) ?? 0;
    const messages =
      (await this.state.storage.get<number>("stats:total:messages")) ?? 0;
    const rooms: Stats["rooms"] = {};
    const listed = await this.state.storage.list<number>({
      prefix: "stats:room:",
    });
    for (const [key, count] of listed) {
      const rest = key.slice("stats:room:".length);
      const split = rest.lastIndexOf(":");
      if (split <= 0) continue;
      const label = rest.slice(0, split);
      const metric = rest.slice(split + 1);
      const entry = rooms[label] ?? { joins: 0, messages: 0 };
      if (metric === "joins") entry.joins = count;
      else if (metric === "messages") entry.messages = count;
      rooms[label] = entry;
    }
    return Response.json({ joins, messages, rooms } satisfies Stats);
  }
}
