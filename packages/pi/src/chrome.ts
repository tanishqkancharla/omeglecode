import { splitAiNickname } from "@omeglecode/protocol";

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

export function sendingStatus(room: string): string {
  return `sending to ${roomLabel(room)}`;
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
  for (const message of messages) {
    const stamp = formatTime(message.sentAt);
    const agent = splitAiNickname(message.nickname);
    lines.push(
      agent
        ? `${theme.fg("warning", agent.prefix)} ${theme.fg("muted", `${agent.name}  ${stamp}`)}`
        : theme.fg("muted", `${message.nickname}  ${stamp}`),
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
  theme: Theme,
  open = "╭─",
  close = "╮",
): string {
  const border = (s: string) => theme.fg("border", s);
  const inner = Math.max(0, width - visibleWidth(open) - visibleWidth(close));
  const fittedLeft = truncateToWidth(left, Math.max(0, inner - 1));
  const fill = Math.max(1, inner - visibleWidth(fittedLeft));
  return `${border(open)}${fittedLeft}${border("─".repeat(fill))}${border(close)}`;
}

function boxBottom(width: number, theme: Theme): string {
  const border = (s: string) => theme.fg("border", s);
  if (width <= 0) return "";
  if (width === 1) return border("╰");
  if (width === 2) return border("╰╯");
  return `${border("╰")}${border("─".repeat(width - 2))}${border("╯")}`;
}

export type PaneMode = "expanded" | "compact";

export function renderPane(options: {
  width: number;
  mode: PaneMode;
  online: number;
  room: string;
  pulse?: boolean;
  body: string[];
  bodyRows: number;
  preview?: string;
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

  if (options.mode === "compact") {
    const preview = options.preview
      ? ` ·  ${options.preview}`
      : "";
    return [titleLine(width, `${left}${theme.fg("muted", preview)} `, theme, "╭", "╮")];
  }

  const lines = [titleLine(width, left, theme)];
  const rows = Math.max(1, options.bodyRows);
  const body = options.body.slice(-rows);
  const pad = Math.max(0, rows - body.length);
  for (let index = 0; index < rows; index++) {
    const line = index < pad ? "" : (body[index - pad] ?? "");
    lines.push(boxedRow(` ${line}`, width, border));
  }
  lines.push(boxBottom(width, theme));
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
