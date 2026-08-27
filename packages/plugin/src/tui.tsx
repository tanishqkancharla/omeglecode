/** @jsxImportSource @opentui/solid */
import type { Plugin } from "@opencode-ai/plugin/tui";
import { onCleanup } from "solid-js";
import { validNickname, validRoomCode } from "@omeglecode/protocol";
import { createChat } from "./Chat.js";
import { Panel } from "./Panel.js";

const key = "omeglecode.settings";
const defaultEndpoint =
  "wss://omeglecode.tanishqkancharla3.workers.dev/connect";

function Commands(props: {
  context: Plugin.Context;
  nickname: () => string | undefined;
  chooseNickname: () => Promise<void>;
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
        slash: { name: "omeglecode" },
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
        slash: { name: "omeglecode-nickname" },
        bind: false,
        run: props.chooseNickname,
      },
    ],
    bindings: ["omeglecode.toggle", "omeglecode.focus"],
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
      initial: { nickname: initialNickname },
    });
    const nickname = () => settings.nickname || undefined;
    const chat = createChat(context, endpoint, configuredRoom);
    let focusInput: (() => void) | undefined;
    let focusPending = false;
    let activeSession: string | undefined;
    let disconnect: (() => void) | undefined;

    const connect = (sessionID: string, value: string) => {
      disconnect?.();
      disconnect = chat.connect(sessionID, value);
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

    const focusChat = async () => {
      if (!nickname()) {
        await chooseNickname();
        if (!nickname()) return;
      }
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
            nickname={nickname}
            chooseNickname={chooseNickname}
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
              nickname={nickname}
              chooseNickname={chooseNickname}
              focusInput={focusChat}
            />
            <Panel
              chat={chat}
              context={context}
              nickname={nickname}
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
              nickname={nickname}
              chooseNickname={chooseNickname}
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
