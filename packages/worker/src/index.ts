import { validNickname, validRoomCode } from "@omeglecode/protocol";
import { ChatRoom } from "./ChatRoom.js";
import { Matchmaker, trackEvent } from "./Matchmaker.js";
import type { Assignment, Env } from "./types.js";

export { ChatRoom, Matchmaker };

function roomStub(env: Env, code: string) {
  if (code === "development") {
    return env.ROOMS.get(env.ROOMS.idFromName("development"));
  }
  if (validRoomCode(code)) {
    return env.ROOMS.get(env.ROOMS.idFromName(`invite:${code}`));
  }
  return env.ROOMS.get(env.ROOMS.idFromString(code));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ ok: true });
    if (url.pathname === "/stats") {
      if (request.method !== "GET")
        return new Response("Method not allowed", { status: 405 });
      return env.MATCHMAKER.get(env.MATCHMAKER.idFromName("global")).fetch(
        "https://matchmaker/stats",
      );
    }
    if (url.pathname !== "/connect")
      return new Response("Not found", { status: 404 });
    if (request.headers.get("Upgrade") !== "websocket")
      return new Response("Expected WebSocket", { status: 426 });

    const session = url.searchParams.get("session");
    const nickname = url.searchParams.get("nickname")?.trim();
    const invite = url.searchParams.get("room");
    if (!session || !nickname || !validNickname(nickname))
      return new Response("Invalid connection", { status: 400 });
    if (invite !== null && !validRoomCode(invite))
      return new Response("Invalid room code", { status: 400 });

    const development =
      url.searchParams.get("development") === "true" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    const matcher = env.MATCHMAKER.get(env.MATCHMAKER.idFromName("global"));
    const managed = !development && invite === null;
    const label = development
      ? "development"
      : invite !== null
        ? invite
        : "matchmaker";
    let assignment: Assignment;
    if (development) {
      assignment = { room: "development", session };
    } else if (invite !== null) {
      assignment = { room: invite, session };
    } else {
      const matched = await matcher.fetch("https://matchmaker/assign", {
        method: "POST",
        body: session,
      });
      if (!matched.ok) return matched;
      assignment = await matched.json<Assignment>();
    }
    const response = await roomStub(env, assignment.room).fetch(request, {
      headers: {
        ...Object.fromEntries(request.headers),
        "X-Omeglecode-Nickname": nickname,
        "X-Omeglecode-Managed": String(managed),
        "X-Omeglecode-Label": label,
        "X-Omeglecode-Room": assignment.room,
        "X-Omeglecode-Session": session,
      },
    });
    if (response.status === 101) {
      await trackEvent(env, "join", label).catch(() => {});
      return response;
    }

    if (managed) {
      await matcher.fetch("https://matchmaker/release", {
        method: "POST",
        body: JSON.stringify(assignment),
      });
    }
    return response;
  },
} satisfies ExportedHandler<Env>;
