import {
  CustomEditor,
  type ExtensionAPI,
  type ExtensionContext,
  type Theme,
} from "@earendil-works/pi-coding-agent";
import { matchesKey, type Component, type TUI } from "@earendil-works/pi-tui";
import { createChat, inviteCode } from "@omeglecode/client";
import { validNickname, validRoomCode } from "@omeglecode/protocol";
import { sendingStatus } from "./chrome.js";
import { InviteDialog } from "./invite.js";
import {
  cycleDensity,
  loadSettings,
  saveSettings,
  type Settings,
} from "./settings.js";
import { piSessionKey } from "./session.js";
import { OmegleWidget, type Hallway } from "./widget.js";

const WIDGET_ID = "omeglecode";

export default function omeglecode(pi: ExtensionAPI) {
  let activeCtx: ExtensionContext | undefined;
  let sessionID: string | undefined;
  let disconnect: (() => void) | undefined;
  let sendMode = false;
  let unbindEscape: (() => void) | undefined;
  let unbindSendStatus: (() => void) | undefined;
  const settings: Settings = loadSettings();
  const hallway: Hallway = {
    chat: createChat({
      endpoint: settings.endpoint,
      onError: (message) => activeCtx?.ui.notify(message, "warning"),
    }),
    nickname: settings.nickname,
    room: settings.room,
    density: settings.density,
  };

  const persist = () => {
    hallway.nickname = settings.nickname;
    hallway.room = settings.room;
    hallway.density = settings.density;
    saveSettings(settings);
  };

  const connect = () => {
    disconnect?.();
    disconnect = undefined;
    if (!sessionID || !settings.nickname) return;
    disconnect = hallway.chat.connect(
      sessionID,
      settings.nickname,
      settings.room || undefined,
    );
  };

  const showWidget = (ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;
    if (settings.density === "hidden") {
      ctx.ui.setWidget(WIDGET_ID, undefined);
      return;
    }
    ctx.ui.setWidget(
      WIDGET_ID,
      (tui: TUI, theme: Theme) => new OmegleWidget(tui, theme, hallway),
      { placement: "aboveEditor" },
    );
  };

  const currentRoom = () => hallway.chat.room() || settings.room;

  const statusText = (ctx: ExtensionContext) => {
    const label = sendingStatus(currentRoom());
    return ctx.ui.theme?.fg("accent", label) ?? label;
  };

  const refreshSendStatus = (ctx: ExtensionContext) => {
    if (!ctx.hasUI || !sendMode) return;
    ctx.ui.setStatus?.(WIDGET_ID, statusText(ctx));
  };

  const exitSendMode = (ctx: ExtensionContext) => {
    if (!sendMode) return;
    sendMode = false;
    unbindSendStatus?.();
    unbindSendStatus = undefined;
    if (ctx.hasUI) ctx.ui.setStatus?.(WIDGET_ID, undefined);
  };

  const enterSendMode = (ctx: ExtensionContext) => {
    sendMode = true;
    unbindSendStatus?.();
    unbindSendStatus = hallway.chat.subscribe(() => refreshSendStatus(ctx));
  };

  const wrapEditor = (inner: Component, ctx: ExtensionContext): Component => {
    const original = inner.handleInput?.bind(inner);
    inner.handleInput = (data: string) => {
      if (sendMode && matchesKey(data, "escape")) {
        exitSendMode(ctx);
        return;
      }
      original?.(data);
    };
    return inner;
  };

  const bindEscape = (ctx: ExtensionContext) => {
    unbindEscape?.();
    unbindEscape = undefined;
    if (!ctx.hasUI || typeof ctx.ui.setEditorComponent !== "function") return;
    const previous = ctx.ui.getEditorComponent?.();
    ctx.ui.setEditorComponent((tui, theme, keybindings) =>
      wrapEditor(
        previous
          ? previous(tui, theme, keybindings)
          : new CustomEditor(tui, theme, keybindings),
        ctx,
      ),
    );
    unbindEscape = () => ctx.ui.setEditorComponent(previous);
  };

  const ensureNickname = async (ctx: ExtensionContext): Promise<boolean> => {
    if (settings.nickname) return true;
    const raw = await ctx.ui.input(
      "Choose your Omeglecode nickname",
      "2–20 chars. Agents prefix the name with [ai], like [ai] wes",
    );
    const value = raw?.trim() ?? "";
    if (!validNickname(value)) {
      if (raw !== undefined) {
        ctx.ui.notify("That nickname is not valid", "warning");
      }
      return false;
    }
    settings.nickname = value;
    persist();
    connect();
    showWidget(ctx);
    return true;
  };

  const invite = async (ctx: ExtensionContext) => {
    if (!(await ensureNickname(ctx))) return;
    const assigned = currentRoom();
    if (!settings.room && validRoomCode(assigned)) {
      settings.room = assigned;
      persist();
      showWidget(ctx);
      refreshSendStatus(ctx);
    } else if (!settings.room) {
      settings.room = inviteCode();
      persist();
      connect();
      showWidget(ctx);
      refreshSendStatus(ctx);
    }
    const room = settings.room;
    await ctx.ui.custom<void>(
      (_tui, theme, _kb, done) =>
        new InviteDialog(theme, room, () => done()),
      {
        overlay: true,
        overlayOptions: { anchor: "center", width: 56, maxHeight: 16 },
      },
    );
  };

  const toggleSendMode = async (ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;
    if (sendMode) {
      exitSendMode(ctx);
      return;
    }
    if (!(await ensureNickname(ctx))) return;
    enterSendMode(ctx);
  };

  pi.on("session_start", async (_event, ctx) => {
    activeCtx = ctx;
    sessionID = await piSessionKey(ctx.cwd, ctx.sessionManager.getSessionFile());
    connect();
    showWidget(ctx);
    bindEscape(ctx);
  });

  pi.on("session_shutdown", (_event, ctx) => {
    if (activeCtx !== ctx) return;
    exitSendMode(ctx);
    unbindEscape = undefined;
    if (ctx.hasUI) ctx.ui.setWidget(WIDGET_ID, undefined);
    disconnect?.();
    disconnect = undefined;
    activeCtx = undefined;
    sessionID = undefined;
  });

  pi.on("input", (event, ctx) => {
    if (!sendMode) return;
    if (event.source === "extension") return;
    const text = event.text.trim();
    if (text && !hallway.chat.send(text)) {
      ctx.ui.notify("Could not send that message", "warning");
    }
    return { action: "handled" as const };
  });

  pi.registerShortcut("ctrl+shift+m", {
    description: "Send the next prompt to the Omeglecode room",
    handler: (ctx) => toggleSendMode(ctx),
  });

  pi.registerShortcut("ctrl+shift+c", {
    description: "Cycle Omeglecode widget density",
    handler: (ctx) => {
      settings.density = cycleDensity(settings.density);
      persist();
      showWidget(ctx);
    },
  });

  pi.registerCommand("omegle-toggle", {
    description: "Cycle Omeglecode widget expanded, compact, and hidden",
    handler: async (_args, ctx) => {
      settings.density = cycleDensity(settings.density);
      persist();
      showWidget(ctx);
    },
  });

  pi.registerCommand("omegle-nickname", {
    description: "Set your Omeglecode nickname",
    handler: async (_args, ctx) => {
      const raw = await ctx.ui.input(
        "Choose your Omeglecode nickname",
        settings.nickname || "2–20 chars. Agents prefix the name with [ai], like [ai] wes",
      );
      if (raw === undefined) return;
      const value = raw.trim();
      if (!validNickname(value)) {
        ctx.ui.notify("That nickname is not valid", "warning");
        return;
      }
      settings.nickname = value;
      persist();
      connect();
      showWidget(ctx);
    },
  });

  pi.registerCommand("omegle-connect", {
    description: "Join a named Omeglecode room (same Worker as OpenCode)",
    handler: async (args, ctx) => {
      const value = args.trim();
      if (!validRoomCode(value)) {
        ctx.ui.notify("Usage: /omegle-connect ROOM_ID", "warning");
        return;
      }
      if (!(await ensureNickname(ctx))) return;
      settings.room = value;
      persist();
      connect();
      showWidget(ctx);
      refreshSendStatus(ctx);
      ctx.ui.notify(`Connected to Omegle room ${value}`, "info");
    },
  });

  pi.registerCommand("omegle-invite", {
    description: "Invite someone to this Omeglecode room",
    handler: async (_args, ctx) => {
      await invite(ctx);
    },
  });
}
