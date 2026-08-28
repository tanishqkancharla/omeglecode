import { SELF } from "cloudflare:test";
import { describe, expect, test } from "vitest";
import type { LiveData, Stats } from "../src/types.js";

describe("live dashboard", () => {
  test("serves a Maui HTML page at GET /live", async () => {
    const response = await SELF.fetch("http://example/live");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/text\/html/);
    const html = await response.text();
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("data-theme");
    expect(html).toContain("Omeglecode live");
    expect(html).toContain('id="root"');
    expect(html).not.toMatch(/CLOUDFLARE_[A-Z_]*TOKEN\s*[:=]\s*["'][^"']+["']/);
  });

  test("rejects non-GET on /live and /live/data", async () => {
    expect((await SELF.fetch("http://example/live", { method: "POST" })).status).toBe(
      405,
    );
    expect(
      (await SELF.fetch("http://example/live/data", { method: "POST" })).status,
    ).toBe(405);
  });

  test("returns stats plus unavailable cost without an analytics token", async () => {
    const response = await SELF.fetch("http://example/live/data");
    expect(response.status).toBe(200);
    const body = await response.json<LiveData>();
    expect(body.joins).toBe(0);
    expect(body.messages).toBe(0);
    expect(body.rooms).toEqual({});
    expect(body.updatedAt).toEqual(expect.any(String));
    expect(body.cost.available).toBe(false);
    if (!body.cost.available) {
      expect(body.cost.reason).toMatch(/CLOUDFLARE_API_TOKEN/);
    }
    expect(JSON.stringify(body)).not.toMatch(/eyJ/);
  });

  test("keeps GET /stats unchanged", async () => {
    const response = await SELF.fetch("http://example/stats");
    expect(response.status).toBe(200);
    const stats = await response.json<Stats>();
    expect(stats).toEqual({ joins: 0, messages: 0, rooms: {} });
  });

  test("live data joins follow /stats after a websocket accept", async () => {
    const before = await (await SELF.fetch("http://example/live/data")).json<LiveData>();
    const connected = await SELF.fetch(
      "http://example/connect?session=00000000000000000000000000000061&nickname=live1&room=live-room",
      { headers: { Upgrade: "websocket" } },
    );
    expect(connected.status).toBe(101);
    connected.webSocket?.accept();
    connected.webSocket?.close();
    const after = await (await SELF.fetch("http://example/live/data")).json<LiveData>();
    expect(after.joins).toBe(before.joins + 1);
    expect(after.rooms["live-room"]?.joins).toBe(
      (before.rooms["live-room"]?.joins ?? 0) + 1,
    );
    expect(after.cost.available).toBe(false);
  });
});
