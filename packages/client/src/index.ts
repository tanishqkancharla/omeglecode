import {
  limits,
  parseServerEvent,
  type ChatMessage,
} from "@omeglecode/protocol";

export const DEFAULT_ENDPOINT =
  "wss://omeglecode.tanishqkancharla3.workers.dev/connect";

const inviteAlphabet = "abcdefghijkmnopqrstuvwxyz23456789";

export function normalizeEndpoint(value: string): string {
  return value.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
}

export function inviteCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (value) =>
    inviteAlphabet.charAt(value % inviteAlphabet.length),
  ).join("");
}

export async function sessionHash(sessionID: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(sessionID),
  );
  return Array.from(new Uint8Array(hash).slice(0, 16), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export type ChatStatus =
  | "choose a nickname"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline"
  | (string & {});

export type Chat = {
  messages: () => ChatMessage[];
  online: () => number;
  status: () => string;
  subscribe: (subscriber: () => void) => () => void;
  connect: (
    sessionID: string,
    nickname: string,
    room: string | undefined,
  ) => () => void;
  send: (text: string) => boolean;
};

export type CreateChatOptions = {
  endpoint: string;
  onChange?: () => void;
  onError?: (message: string) => void;
};

export function createChat(options: CreateChatOptions): Chat {
  const state = {
    messages: [] as ChatMessage[],
    online: 0,
    status: "choose a nickname",
  };
  let socket: WebSocket | undefined;
  const subscribers = new Set<() => void>();
  const change = (mutation: (draft: typeof state) => void) => {
    mutation(state);
    for (const subscriber of subscribers) subscriber();
    options.onChange?.();
  };

  return {
    messages: () => state.messages,
    online: () => state.online,
    status: () => state.status,
    subscribe(subscriber: () => void) {
      subscribers.add(subscriber);
      subscriber();
      return () => subscribers.delete(subscriber);
    },
    connect(sessionID: string, nickname: string, room: string | undefined) {
      let stopped = false;
      let attempt = 0;
      change((draft) => {
        draft.messages = [];
        draft.online = 0;
        draft.status = "connecting";
      });

      const open = async () => {
        const session = await sessionHash(sessionID);
        if (stopped) return;
        const url = new URL(options.endpoint);
        url.searchParams.set("session", session);
        url.searchParams.set("nickname", nickname);
        if (room) url.searchParams.set("room", room);
        socket = new WebSocket(url);
        socket.addEventListener("open", () => {
          attempt = 0;
          change((draft) => {
            draft.status = "connected";
          });
        });
        socket.addEventListener("message", (raw) => {
          if (typeof raw.data !== "string") return;
          const event = parseServerEvent(raw.data);
          if (!event) return;
          if (event.type === "ready") {
            change((draft) => {
              draft.messages = event.history;
              draft.online = event.online;
            });
          }
          if (event.type === "message") {
            change((draft) => {
              draft.messages = [...draft.messages, event.message].slice(
                -limits.history,
              );
            });
          }
          if (event.type === "presence") {
            change((draft) => {
              draft.online = event.online;
            });
          }
          if (event.type === "error") {
            options.onError?.(event.message);
          }
        });
        socket.addEventListener("close", () => {
          if (stopped) return;
          change((draft) => {
            draft.status = "reconnecting";
          });
          const delay = [1000, 2000, 5000][Math.min(attempt++, 2)] ?? 5000;
          setTimeout(() => void open(), delay);
        });
        socket.addEventListener("error", () => {
          change((draft) => {
            draft.status = "offline";
          });
        });
      };

      void open();
      return () => {
        stopped = true;
        socket?.close();
        socket = undefined;
      };
    },
    send(text: string) {
      if (socket?.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify({ type: "message", text }));
      return true;
    },
  };
}
