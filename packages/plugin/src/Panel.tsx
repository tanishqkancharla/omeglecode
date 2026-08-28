/** @jsxImportSource @opentui/solid */
import type { Plugin } from "@opencode-ai/plugin/tui";
import { StyledText, fg } from "@opentui/core";
import type {
  ScrollBoxRenderable,
  TextareaRenderable,
  TextRenderable,
} from "@opentui/core";
import { Show, createSignal, onCleanup, onMount } from "solid-js";
import type { Chat } from "./Chat.js";

function time(value: number): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Panel(props: {
  chat: Chat;
  context: Plugin.Context;
  nickname: () => string | undefined;
  room: () => string | undefined;
  invite: () => Promise<void>;
  registerInput: (focus: (() => void) | undefined) => void;
}) {
  let history: ScrollBoxRenderable | undefined;
  let count: TextRenderable | undefined;
  let transcript: TextRenderable | undefined;
  const theme = () => props.context.theme;
  const roomLabel = () => {
    const room = props.room();
    if (!room) return "random room";
    const shortened = room.length > 18 ? `${room.slice(0, 17)}…` : room;
    return `room #${shortened}`;
  };

  const render = () => {
    if (count) count.content = `${props.chat.online()} online`;
    if (transcript) {
      const messages = props.chat.messages();
      transcript.content = messages.length
        ? new StyledText(
            messages.flatMap((message, index) => [
              fg(theme().text.subdued)(
                `${message.nickname} ${time(message.sentAt)}\n`,
              ),
              fg(theme().text.default)(
                `${message.text}${index === messages.length - 1 ? "" : "\n\n"}`,
              ),
            ]),
          )
        : new StyledText([
            fg(theme().text.subdued)(props.chat.status()),
          ]);
    }
    setTimeout(() => history?.scrollTo(Number.MAX_SAFE_INTEGER), 50);
  };

  onMount(() => {
    const unsubscribe = props.chat.subscribe(render);
    onCleanup(unsubscribe);
  });

  return (
    <box flexDirection="column" gap={1}>
      <box flexDirection="column">
        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme().text.default}>
            <b>Omegle</b>
          </text>
          <text
            ref={(value: TextRenderable) => {
              count = value;
            }}
            fg={theme().text.subdued}
          >
            {props.chat.online()} online
          </text>
        </box>
        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme().text.subdued}>{roomLabel()}</text>
          <text
            fg={theme().text.action.primary.default}
            onMouseUp={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              void props.invite();
            }}
          >
            {props.room() ? "[ invite ]" : "[ make invite ]"}
          </text>
        </box>
      </box>
      <scrollbox
        ref={(value: ScrollBoxRenderable) => {
          history = value;
        }}
        height={Math.min(
          14,
          Math.max(3, props.context.renderer.height - 21),
        )}
        focusable
        stickyScroll
        stickyStart="bottom"
        contentOptions={{ flexDirection: "column", gap: 1 }}
      >
        <text
          ref={(value: TextRenderable) => {
            transcript = value;
          }}
          fg={theme().text.subdued}
        >
          {props.chat.status()}
        </text>
      </scrollbox>
      <Input
        chat={props.chat}
        context={props.context}
        nickname={props.nickname}
        registerInput={props.registerInput}
      />
    </box>
  );
}

export function Input(props: {
  chat: Chat;
  context: Plugin.Context;
  nickname: () => string | undefined;
  registerInput: (focus: (() => void) | undefined) => void;
}) {
  let input: TextareaRenderable | undefined;
  let hint: TextRenderable | undefined;
  const [revision, setRevision] = createSignal(0);
  const nickname = () => {
    revision();
    return props.nickname();
  };

  onMount(() => {
    const unsubscribe = props.chat.subscribe(() =>
      setRevision((value) => value + 1),
    );
    props.registerInput(() => {
      input?.focus();
      if (hint) hint.content = "Enter / Esc";
      props.context.renderer.requestRender();
    });
    onCleanup(() => {
      unsubscribe();
      props.registerInput(undefined);
    });
  });

  const send = () => {
    const text = input?.plainText.trim();
    if (!text || !props.chat.send(text)) return;
    input?.clear();
  };

  const theme = () => props.context.theme;
  return (
    <box flexDirection="column" minHeight={2} flexShrink={0}>
      <Show
        when={nickname()}
        fallback={
          <text fg={theme().text.feedback.warning.default}>
            Run /omegle-nickname to join
          </text>
        }
      >
        <box
          border={["top"]}
          borderColor={theme().border.default}
          minHeight={2}
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <textarea
            ref={(value: TextareaRenderable) => {
              input = value;
            }}
            flexGrow={1}
            minHeight={1}
            maxHeight={1}
            keyBindings={[
              { name: "return", action: "submit" },
              { name: "kpenter", action: "submit" },
              { name: "linefeed", action: "submit" },
            ]}
            placeholder={`Message as ${nickname()}`}
            placeholderColor={theme().text.subdued}
            textColor={theme().text.default}
            focusedTextColor={theme().text.default}
            cursorColor={theme().text.default}
            cursorStyle={{
              style: "block",
              blinking: true,
              color: theme().text.default,
            }}
            onSubmit={send}
            onKeyDown={(event) => {
              if (event.name === "escape") {
                input?.blur();
                if (hint) hint.content = "ctrl-shift-m";
                props.context.renderer.requestRender();
                return;
              }
              if (hint) hint.content = "Enter / Esc";
            }}
          />
          <text
            ref={(value: TextRenderable) => {
              hint = value;
            }}
            fg={theme().text.subdued}
          >
            ctrl-shift-m
          </text>
        </box>
      </Show>
    </box>
  );
}
