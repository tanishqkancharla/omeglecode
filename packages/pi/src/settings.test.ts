import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { DEFAULT_ENDPOINT } from "@omeglecode/client";
import {
  cycleDensity,
  defaultSettings,
  loadSettings,
  saveSettings,
} from "./settings.js";
import { piSessionKey } from "./session.js";
import { sessionHash } from "@omeglecode/client";

describe("settings", () => {
  test("round-trips nickname, room, and density", () => {
    const file = path.join(mkdtempSync(path.join(os.tmpdir(), "omegle-")), "omeglecode.json");
    saveSettings(
      {
        ...defaultSettings(),
        nickname: "maya",
        room: "weekend-test",
        density: "compact",
      },
      file,
    );
    expect(JSON.parse(readFileSync(file, "utf8"))).toMatchObject({
      nickname: "maya",
      room: "weekend-test",
      density: "compact",
    });
    expect(loadSettings(file)).toMatchObject({
      nickname: "maya",
      room: "weekend-test",
      density: "compact",
      endpoint: DEFAULT_ENDPOINT,
    });
  });

  test("ignores invalid values", () => {
    const file = path.join(mkdtempSync(path.join(os.tmpdir(), "omegle-")), "omeglecode.json");
    saveSettings(
      {
        nickname: "x",
        room: "no",
        density: "expanded",
        endpoint: DEFAULT_ENDPOINT,
      },
      file,
    );
    expect(loadSettings(file)).toMatchObject({
      nickname: "",
      room: "",
      density: "expanded",
    });
  });

  test("cycles expanded → compact → hidden", () => {
    expect(cycleDensity("expanded")).toBe("compact");
    expect(cycleDensity("compact")).toBe("hidden");
    expect(cycleDensity("hidden")).toBe("expanded");
  });
});

describe("pi session keys", () => {
  test("prefix session files so OpenCode hashes stay unchanged", async () => {
    const file = "/home/maya/.pi/agent/sessions/abc.jsonl";
    expect(await piSessionKey("/tmp/acme", file)).toBe(
      await sessionHash(`pi:${file}`),
    );
    expect(await piSessionKey("/tmp/acme", file)).not.toBe(
      await sessionHash(file),
    );
  });

  test("ephemeral sessions hash cwd plus process start", async () => {
    const first = await piSessionKey("/tmp/acme", undefined);
    const second = await piSessionKey("/tmp/acme", undefined);
    expect(first).toBe(second);
    expect(first).not.toBe(await piSessionKey("/tmp/other", undefined));
  });
});
