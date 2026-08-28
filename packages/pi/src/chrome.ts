export type Theme = {
  fg: (name: string, text: string) => string;
};

export const plainTheme: Theme = {
  fg: (_name, text) => text,
};

const ansi = /\x1b\[[0-9;]*m/g;

export function stripAnsi(value: string): string {
  return value.replace(ansi, "");
}

export function visibleWidth(value: string): number {
  return stripAnsi(value).length;
}

export function truncateToWidth(
  value: string,
  width: number,
  ellipsis = "…",
): string {
  const plain = stripAnsi(value);
  if (width <= 0) return "";
  if (plain.length <= width) return value;
  if (width <= ellipsis.length) return ellipsis.slice(0, width);
  return `${plain.slice(0, width - ellipsis.length)}${ellipsis}`;
}

export function padVisible(value: string, width: number): string {
  const vis = visibleWidth(value);
  if (vis === width) return value;
  if (vis > width) return truncateToWidth(value, width);
  return `${value}${" ".repeat(width - vis)}`;
}

export function bodyRows(terminalRows: number): number {
  return Math.min(8, Math.max(3, Math.floor(terminalRows * 0.28)));
}

export function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function roomLabel(room: string): string {
  if (!room) return "random";
  return room.length > 18 ? `#${room.slice(0, 17)}…` : `#${room}`;
}

export function inviteLabel(room: string): string {
  return room ? "[ invite ]" : "[ make invite ]";
}

export type HistoryMessage = {
  nickname: string;
  text: string;
  sentAt: number;
};

export function historyLines(
  messages: HistoryMessage[],
  status: string,
  nickname: string,
  theme: Theme,
): string[] {
  if (!nickname) return [theme.fg("warning", "run /omegle-nickname to join")];
  if (!messages.length) return [theme.fg("muted", status)];
  const lines: string[] = [];
  for (const [index, message] of messages.entries()) {
    if (index > 0) lines.push("");
    lines.push(
      theme.fg("muted", `${message.nickname}  ${formatTime(message.sentAt)}`),
    );
    lines.push(theme.fg("text", message.text));
  }
  return lines;
}

export function lastPreview(messages: HistoryMessage[]): string {
  const message = messages.at(-1);
  if (!message) return "";
  return `${message.nickname}: ${message.text}`;
}

function boxedRow(inner: string, width: number, border: (s: string) => string) {
  return `${border("│")}${padVisible(inner, Math.max(0, width - 2))}${border("│")}`;
}

function titleLine(
  width: number,
  left: string,
  right: string,
  theme: Theme,
  open = "╭─",
  close = "╮",
): string {
  const border = (s: string) => theme.fg("border", s);
  const inner = Math.max(0, width - visibleWidth(open) - visibleWidth(close));
  const rightPart = right ? `${right} ` : "";
  const maxLeft = Math.max(0, inner - visibleWidth(rightPart) - 1);
  const fittedLeft = truncateToWidth(left, maxLeft);
  const fill = Math.max(1, inner - visibleWidth(fittedLeft) - visibleWidth(rightPart));
  return `${border(open)}${fittedLeft}${border("─".repeat(fill))}${rightPart}${border(close)}`;
}

export function footerLine(
  width: number,
  hints: string,
  theme: Theme,
): string {
  const border = (s: string) => theme.fg("border", s);
  if (width <= 0) return "";
  if (width === 1) return border("╰");
  if (width === 2) return border("╰╯");
  if (width === 3) return border("╰─╯");
  const inner = width - 2;
  const fitted = truncateToWidth(hints, Math.max(0, inner - 2));
  const leftRule = Math.max(1, inner - visibleWidth(fitted) - 1);
  return `${border("╰")}${border("─".repeat(leftRule))}${fitted}${border("─╯")}`;
}

export type PaneMode = "expanded" | "compact" | "focus";

export function renderPane(options: {
  width: number;
  mode: PaneMode;
  online: number;
  room: string;
  pulse?: boolean;
  body: string[];
  bodyRows: number;
  preview?: string;
  draft?: string;
  nickname?: string;
  theme: Theme;
}): string[] {
  const width = Math.max(8, options.width);
  const theme = options.theme;
  const border = (s: string) => theme.fg("border", s);
  const count = theme.fg(
    options.pulse ? "accent" : "muted",
    `${options.online} online`,
  );
  const room = theme.fg("muted", roomLabel(options.room));
  const brand = theme.fg("accent", "omegle");
  const left = ` ${brand}  ·  ${count}  ·  ${room} `;
  const invite = theme.fg("accent", inviteLabel(options.room));

  if (options.mode === "compact") {
    const preview = options.preview
      ? ` ·  ${truncateToWidth(options.preview, Math.max(8, width - 48))}  `
      : " ";
    const hints = theme.fg("dim", "ctrl+shift+m");
    return [
      "",
      titleLine(
        width,
        `${left}${theme.fg("muted", preview)}`,
        hints,
        theme,
        "╭",
        "╮",
      ),
    ];
  }

  const compose =
    options.mode === "focus"
      ? padVisible(
          ` ${theme.fg("muted", options.nickname ? `Message as ${options.nickname}` : "run /omegle-nickname")} ${options.draft ?? ""}`,
          Math.max(0, width - 10),
        ) + theme.fg("dim", "Enter")
      : undefined;
  const hints =
    options.mode === "focus"
      ? ` ${theme.fg("muted", "ctrl+shift+m")} ${theme.fg("dim", "focus")} ${border(" · ")} ${theme.fg("muted", "esc")} ${theme.fg("dim", "back to pi")} `
      : ` ${theme.fg("muted", "ctrl+shift+m")} ${theme.fg("dim", "focus")} ${border(" · ")} ${theme.fg("muted", "ctrl+shift+c")} ${theme.fg("dim", "compact")} `;

  const lines = [""];
  lines.push(titleLine(width, left, invite, theme));
  const rows = Math.max(1, options.bodyRows);
  for (let index = 0; index < rows; index++) {
    const line = options.body[index] ?? "";
    lines.push(boxedRow(` ${line}`, width, border));
  }
  if (compose !== undefined) {
    lines.push(border(`├${"─".repeat(Math.max(0, width - 2))}┤`));
    lines.push(boxedRow(compose, width, border));
  }
  lines.push(footerLine(width, hints, theme));
  return lines;
}

export function renderInviteCard(
  width: number,
  room: string,
  theme: Theme,
): string[] {
  const inner = Math.min(52, Math.max(28, width));
  const border = (s: string) => theme.fg("border", s);
  const row = (content: string) =>
    `${border("│")}${padVisible(` ${content}`, inner - 2)}${border("│")}`;
  return [
    border(`╭${"─".repeat(inner - 2)}╮`),
    row(theme.fg("accent", "Invite to Omegle")),
    row(""),
    row(`Room: ${room}`),
    row(""),
    row("Ask them to run:"),
    row(theme.fg("success", `/omegle-connect ${room}`)),
    row(""),
    row(theme.fg("muted", "Works in OpenCode, Pi, or the companion TUI.")),
    row(""),
    row(theme.fg("dim", "esc to close")),
    border(`╰${"─".repeat(inner - 2)}╯`),
  ];
}
