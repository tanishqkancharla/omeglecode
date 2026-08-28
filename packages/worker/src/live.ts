import { cachedDurableObjectCost } from "./cost.js";
import { livePageHtml } from "./generated/livePage.js";
import type { Env, LiveData, Stats } from "./types.js";

export function livePage(request: Request): Response {
  if (request.method !== "GET")
    return new Response("Method not allowed", { status: 405 });
  return new Response(livePageHtml, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function liveData(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "GET")
    return new Response("Method not allowed", { status: 405 });

  const [statsResponse, cost] = await Promise.all([
    env.MATCHMAKER.get(env.MATCHMAKER.idFromName("global")).fetch(
      "https://matchmaker/stats",
    ),
    cachedDurableObjectCost(env),
  ]);
  if (!statsResponse.ok)
    return new Response("Stats unavailable", { status: 502 });

  const stats = await statsResponse.json<Stats>();
  const body: LiveData = {
    joins: stats.joins,
    messages: stats.messages,
    rooms: stats.rooms,
    updatedAt: new Date().toISOString(),
    cost,
  };
  return Response.json(body, {
    headers: { "cache-control": "no-store" },
  });
}
