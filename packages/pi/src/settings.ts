import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DEFAULT_ENDPOINT, normalizeEndpoint } from "@omeglecode/client";
import { validNickname, validRoomCode } from "@omeglecode/protocol";

export type Density = "expanded" | "compact" | "hidden";

export type Settings = {
  nickname: string;
  room: string;
  density: Density;
  endpoint: string;
};

const densities: Density[] = ["expanded", "compact", "hidden"];

export function settingsPath(): string {
  return path.join(os.homedir(), ".pi", "agent", "omeglecode.json");
}

export function defaultSettings(): Settings {
  return {
    nickname: "",
    room: "",
    density: "expanded",
    endpoint: DEFAULT_ENDPOINT,
  };
}

function asDensity(value: unknown): Density {
  return densities.includes(value as Density) ? (value as Density) : "expanded";
}

export function loadSettings(file = settingsPath()): Settings {
  const settings = defaultSettings();
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Record<
      string,
      unknown
    >;
    if (typeof parsed.nickname === "string" && validNickname(parsed.nickname)) {
      settings.nickname = parsed.nickname;
    }
    if (typeof parsed.room === "string" && validRoomCode(parsed.room)) {
      settings.room = parsed.room;
    }
    settings.density = asDensity(parsed.density);
    if (typeof parsed.endpoint === "string" && parsed.endpoint.trim()) {
      settings.endpoint = normalizeEndpoint(parsed.endpoint.trim());
    }
  } catch {
    return settings;
  }
  return settings;
}

export function saveSettings(settings: Settings, file = settingsPath()): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(settings, undefined, 2)}\n`);
}

export function cycleDensity(current: Density): Density {
  return densities[(densities.indexOf(current) + 1) % densities.length] ?? "expanded";
}
