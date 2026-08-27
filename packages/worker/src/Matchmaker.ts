import { limits } from "@omeglecode/protocol";
import type { Assignment, Env } from "./types.js";

type Session = {
  connected: boolean;
  expiresAt: number;
  room: string;
};

type Room = { count: number };

const ttl = 6 * 60 * 60 * 1000;

async function score(session: string, room: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${session}:${room}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export class Matchmaker implements DurableObject {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST")
      return new Response("Method not allowed", { status: 405 });
    if (url.pathname === "/assign") return this.assign(await request.text());
    if (url.pathname === "/release")
      return this.release(await request.json<Assignment>());
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
        const room = (await storage.get<Room>(roomKey)) ?? { count: 0 };
        if (room.count < limits.room) {
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
      const available = [...rooms.entries()].filter(
        ([, room]) => room.count < limits.room,
      );
      const ranked = await Promise.all(
        available.map(async ([roomKey]) => ({
          room: roomKey.slice(5),
          score: await score(sessionID, roomKey),
        })),
      );
      ranked.sort((a, b) => b.score.localeCompare(a.score));
      const room = ranked[0]?.room ?? this.env.ROOMS.newUniqueId().toString();
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
      await storage.put(roomKey, {
        count: Math.max(0, (room?.count ?? 1) - 1),
      });
    });
    return new Response(undefined, { status: 204 });
  }
}
