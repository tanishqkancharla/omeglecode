export const limits = {
  history: 50,
  message: 280,
  nickname: 20,
  room: 8,
  roomCode: 32,
} as const;

export type ChatMessage = {
  id: string;
  nickname: string;
  text: string;
  sentAt: number;
};

export type ServerEvent =
  | { type: "ready"; room: string; online: number; history: ChatMessage[] }
  | { type: "message"; message: ChatMessage }
  | { type: "presence"; online: number }
  | { type: "error"; message: string };

export type ClientEvent = { type: "message"; text: string };

function json(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return;
  }
}

export function validNickname(value: string): boolean {
  return /^[a-zA-Z0-9_][a-zA-Z0-9_. -]{1,19}$/.test(value);
}

export function validRoomCode(value: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,31}$/.test(value);
}

export function parseClientEvent(value: string): ClientEvent | undefined {
  const parsed = json(value);
  if (typeof parsed !== "object" || parsed === null) return;
  if (!("type" in parsed) || parsed.type !== "message") return;
  if (!("text" in parsed) || typeof parsed.text !== "string") return;
  const text = parsed.text.trim();
  if (!text || text.length > limits.message) return;
  return { type: "message", text };
}

export function parseServerEvent(value: string): ServerEvent | undefined {
  const parsed = json(value);
  if (typeof parsed !== "object" || parsed === null || !("type" in parsed))
    return;
  if (
    parsed.type === "presence" &&
    "online" in parsed &&
    typeof parsed.online === "number"
  ) {
    return { type: "presence", online: parsed.online };
  }
  if (
    parsed.type === "error" &&
    "message" in parsed &&
    typeof parsed.message === "string"
  ) {
    return { type: "error", message: parsed.message };
  }
  if (parsed.type === "message" && "message" in parsed) {
    return { type: "message", message: parsed.message as ChatMessage };
  }
  if (
    parsed.type === "ready" &&
    "room" in parsed &&
    typeof parsed.room === "string" &&
    "online" in parsed &&
    typeof parsed.online === "number" &&
    "history" in parsed &&
    Array.isArray(parsed.history)
  ) {
    return {
      type: "ready",
      room: parsed.room,
      online: parsed.online,
      history: parsed.history as ChatMessage[],
    };
  }
}
