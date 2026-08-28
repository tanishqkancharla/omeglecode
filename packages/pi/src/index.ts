import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import { createChat, inviteCode } from "@omeglecode/client";
import { validNickname, validRoomCode } from "@omeglecode/protocol";
import { OmegleFocus } from "./focus.js";
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
  let focusOpen = false;
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

  const ensureNickname = async (ctx: ExtensionContext): Promise<boolean> => {
    if (settings.nickname) return true;
    const raw = await ctx.ui.input(
      "Choose your Omeglecode nickname",
      "2–20 letters, numbers, spaces, dots, dashes, or underscores",
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
    if (!settings.room) {
      settings.room = inviteCode();
      persist();
      connect();
      showWidget(ctx);
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

  const openFocus = async (ctx: ExtensionContext) => {
    if (!ctx.hasUI || focusOpen) return;
    if (!(await ensureNickname(ctx))) return;
    focusOpen = true;
    try {
      await ctx.ui.custom<void>(
        (tui: TUI, theme: Theme, _kb, done) =>
          new OmegleFocus(
            tui,
            theme,
            hallway.chat,
            settings.nickname,
            settings.room,
            () => done(),
          ),
        {
          overlay: true,
          overlayOptions: {
            anchor: "bottom-center",
            width: "100%",
            maxHeight: 14,
            margin: { bottom: 5 },
          },
        },
      );
    } finally {
      focusOpen = false;
      showWidget(ctx);
    }
  };

  pi.on("session_start", async (_event, ctx) => {
    activeCtx = ctx;
    sessionID = await piSessionKey(ctx.cwd, ctx.sessionManager.getSessionFile());
    connect();
    showWidget(ctx);
  });

  pi.on("session_shutdown", (_event, ctx) => {
    if (activeCtx !== ctx) return;
    if (ctx.hasUI) ctx.ui.setWidget(WIDGET_ID, undefined);
    disconnect?.();
    disconnect = undefined;
    activeCtx = undefined;
    sessionID = undefined;
  });

  pi.registerShortcut("ctrl+shift+m", {
    description: "Focus the Omeglecode hallway input",
    handler: (ctx) => openFocus(ctx),
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
        settings.nickname || "2–20 letters, numbers, spaces, dots, dashes, or underscores",
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
