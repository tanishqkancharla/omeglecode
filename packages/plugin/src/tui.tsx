/** @jsxImportSource @opentui/solid */
import type { Plugin } from "@opencode-ai/plugin/tui";
import { onCleanup } from "solid-js";
import { validNickname, validRoomCode } from "@omeglecode/protocol";
import { createChat } from "./Chat.js";
import { Panel } from "./Panel.js";

const key = "omeglecode.settings";
const defaultEndpoint =
  "wss://omeglecode.tanishqkancharla3.workers.dev/connect";

function inviteCode(): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (value) =>
    alphabet.charAt(value % alphabet.length),
  ).join("");
}

function Commands(props: {
  context: Plugin.Context;
  chooseNickname: () => Promise<void>;
  connectRoom: (input?: string) => Promise<void>;
  invite: () => Promise<void>;
  focusInput: () => Promise<void>;
}) {
  props.context.keymap.layer(() => ({
    mode: "global",
    commands: [
      {
        id: "omeglecode.toggle",
        title: "Toggle Omeglecode",
        group: "Omeglecode",
        palette: true,
        slash: { name: "omegle-toggle" },
        bind: "ctrl+shift+c",
        run: () => props.context.keymap.dispatch("session.sidebar.toggle"),
      },
      {
        id: "omeglecode.focus",
        title: "Focus Omeglecode input",
        group: "Omeglecode",
        palette: true,
        bind: "ctrl+shift+m",
        run: props.focusInput,
      },
      {
        id: "omeglecode.nickname",
        title: "Change Omeglecode nickname",
        group: "Omeglecode",
        palette: true,
        slash: { name: "omegle-nickname" },
        bind: false,
        run: props.chooseNickname,
      },
      {
        id: "omeglecode.connect",
        title: "Connect to an Omegle room",
        group: "Omeglecode",
        palette: true,
        slash: { name: "omegle-connect", arguments: true },
        bind: false,
        run: props.connectRoom,
      },
      {
        id: "omeglecode.invite",
        title: "Invite someone to this Omegle room",
        group: "Omeglecode",
        palette: true,
        slash: { name: "omegle-invite" },
        bind: "ctrl+shift+i",
        run: props.invite,
      },
    ],
    bindings: [
      "omeglecode.toggle",
      "omeglecode.focus",
      "omeglecode.invite",
    ],
  }));

  return <box visible={false} />;
}

function Connection(props: {
  activate: (sessionID: string) => () => void;
  sessionID: string;
}) {
  onCleanup(props.activate(props.sessionID));
  return <box visible={false} />;
}

const plugin: Plugin.Definition = {
  id: "omeglecode",
  setup(context) {
    const configured =
      typeof context.options.endpoint === "string"
        ? context.options.endpoint
        : defaultEndpoint;
    const endpoint = configured
      .replace(/^http:/, "ws:")
      .replace(/^https:/, "wss:");
    const configuredRoom = context.options.room;
    if (
      configuredRoom !== undefined &&
      (typeof configuredRoom !== "string" || !validRoomCode(configuredRoom))
    ) {
      throw new Error(
        "Omeglecode room codes must be 3–32 letters, numbers, dashes, or underscores",
      );
    }
    const initialNickname =
      typeof context.options.nickname === "string" &&
      validNickname(context.options.nickname)
        ? context.options.nickname
        : "";
    const [settings, setSettings] = context.storage.store(key, {
      initial: {
        nickname: initialNickname,
        room: configuredRoom === undefined ? "" : configuredRoom,
      },
    });
    const nickname = () => settings.nickname || undefined;
    const room = () => settings.room || undefined;
    const chat = createChat(context, endpoint);
    let focusInput: (() => void) | undefined;
    let focusPending = false;
    let activeSession: string | undefined;
    let disconnect: (() => void) | undefined;

    const connect = (sessionID: string, value: string) => {
      disconnect?.();
      disconnect = chat.connect(sessionID, value, room());
    };

    const activate = (sessionID: string) => {
      activeSession = sessionID;
      const value = nickname();
      if (value) connect(sessionID, value);
      return () => {
        if (activeSession !== sessionID) return;
        disconnect?.();
        disconnect = undefined;
        activeSession = undefined;
      };
    };

    const chooseNickname = async () => {
      const raw = await context.ui.dialog.prompt({
        title: "Choose your Omeglecode nickname",
        description:
          "2–20 letters, numbers, spaces, dots, dashes, or underscores",
        value: settings.nickname,
      });
      if (raw === undefined) return;
      const value = raw.trim();
      if (!validNickname(value)) {
        context.ui.toast.show({
          variant: "warning",
          message: "That nickname is not valid",
        });
        return;
      }
      await setSettings((draft) => {
        draft.nickname = value;
      });
      if (activeSession) connect(activeSession, value);
    };

    const ensureNickname = async () => {
      if (nickname()) return true;
      await chooseNickname();
      return Boolean(nickname());
    };

    const connectRoom = async (input?: string) => {
      const value = input?.trim();
      if (!value || !validRoomCode(value)) {
        context.ui.toast.show({
          variant: "warning",
          message: "Usage: /omegle-connect ROOM_ID",
        });
        return;
      }
      if (!(await ensureNickname())) return;
      await setSettings((draft) => {
        draft.room = value;
      });
      const name = nickname();
      if (activeSession && name) connect(activeSession, name);
      context.ui.toast.show({
        variant: "success",
        message: `Connected to Omegle room ${value}`,
      });
    };

    const invite = async () => {
      if (!(await ensureNickname())) return;
      let value = room();
      if (!value) {
        value = inviteCode();
        await setSettings((draft) => {
          draft.room = value;
        });
        const name = nickname();
        if (activeSession && name) connect(activeSession, name);
      }
      await context.ui.dialog.alert({
        title: "Invite to Omegle",
        message: `Room: ${value}\n\nInstall OpenCode V2:\nnpm install --global @opencode-ai/cli@beta\n\nInstall Omeglecode:\nnpx --yes opencode-omeglecode@latest install\n\nStart OpenCode:\nopencode2\n\nThen run:\n/omegle-connect ${value}`,
      });
    };

    const focusChat = async () => {
      if (!(await ensureNickname())) return;
      if (!focusInput) {
        focusPending = true;
        context.keymap.dispatch("session.sidebar.toggle");
        return;
      }
      setTimeout(() => focusInput?.(), 50);
    };

    const home = context.ui.slot({
      append: "home.footer",
      render() {
        return (
          <Commands
            context={context}
            chooseNickname={chooseNickname}
            connectRoom={connectRoom}
            invite={invite}
            focusInput={focusChat}
          />
        );
      },
    });
    const sidebar = context.ui.slot({
      append: "sidebar.content",
      render(props) {
        return (
          <box flexDirection="column">
            <Commands
              context={context}
              chooseNickname={chooseNickname}
              connectRoom={connectRoom}
              invite={invite}
              focusInput={focusChat}
            />
            <Panel
              chat={chat}
              context={context}
              nickname={nickname}
              room={room}
              invite={invite}
              registerInput={(focus) => {
                focusInput = focus;
                if (!focus || !focusPending) return;
                focusPending = false;
                setTimeout(focus, 50);
              }}
            />
          </box>
        );
      },
    });
    const footer = context.ui.slot({
      replace: "sidebar.footer",
      render() {
        return <box visible={false} />;
      },
    });
    const session = context.ui.slot({
      append: "session.composer.top",
      render(props) {
        return (
          <box visible={false}>
            <Commands
              context={context}
              chooseNickname={chooseNickname}
              connectRoom={connectRoom}
              invite={invite}
              focusInput={focusChat}
            />
            <Connection
              activate={activate}
              sessionID={props.sessionID}
            />
          </box>
        );
      },
    });
    return () => {
      session();
      footer();
      sidebar();
      home();
    };
  },
};

export default plugin;
