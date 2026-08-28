import type { Chat } from "@omeglecode/client";
import type { Component, TUI } from "@earendil-works/pi-tui";
import type { Theme as PiTheme } from "@earendil-works/pi-coding-agent";
import {
  bodyRows,
  historyLines,
  lastPreview,
  renderPane,
  type Theme,
} from "./chrome.js";
import type { Density } from "./settings.js";

const WHEEL_SCROLL_LINES = 3;

function wheelDelta(data: string): number | undefined {
  const match = data.match(/^\x1b\[<(\d+);(\d+);(\d+)[Mm]$/);
  if (!match) return;
  const button = Number(match[1]);
  if ((button & 64) === 0) return;
  if ((button & 3) === 0) return -WHEEL_SCROLL_LINES;
  if ((button & 3) === 1) return WHEEL_SCROLL_LINES;
}

export type Hallway = {
  chat: Chat;
  nickname: string;
  room: string;
  density: Density;
};

export class OmegleWidget implements Component {
  private unsubscribe: () => void;
  private scrollOffset = 0;
  private pulseUntil = 0;
  private lastCount = 0;
  private disposed = false;
  private pulseTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private tui: TUI,
    private theme: PiTheme,
    private hallway: Hallway,
  ) {
    this.lastCount = hallway.chat.messages().length;
    this.unsubscribe = hallway.chat.subscribe(() => {
      if (this.disposed) return;
      const count = hallway.chat.messages().length;
      if (count > this.lastCount) {
        this.pulseUntil = Date.now() + 1200;
        if (this.pulseTimer) clearTimeout(this.pulseTimer);
        this.pulseTimer = setTimeout(() => {
          if (!this.disposed) this.tui.requestRender();
        }, 1200);
      }
      this.lastCount = count;
      const lines = this.lines();
      const rows = bodyRows(this.tui.terminal.rows);
      const maxOffset = Math.max(0, lines.length - rows);
      if (this.scrollOffset >= maxOffset - WHEEL_SCROLL_LINES) {
        this.scrollOffset = maxOffset;
      }
      this.tui.requestRender();
    });
  }

  private lines(): string[] {
    return historyLines(
      this.hallway.chat.messages(),
      this.hallway.chat.status(),
      this.hallway.nickname,
      this.theme as Theme,
    );
  }

  handleInput(data: string): void {
    const delta = wheelDelta(data);
    if (delta === undefined) return;
    const rows = bodyRows(this.tui.terminal.rows);
    const maxOffset = Math.max(0, this.lines().length - rows);
    this.scrollOffset = Math.min(
      maxOffset,
      Math.max(0, this.scrollOffset + delta),
    );
    this.tui.requestRender();
  }

  render(width: number): string[] {
    const rows = bodyRows(this.tui.terminal.rows);
    const lines = this.lines();
    const maxOffset = Math.max(0, lines.length - rows);
    const offset = Math.min(this.scrollOffset, maxOffset);
    this.scrollOffset = offset;
    const body = lines.slice(offset, offset + rows);
    return renderPane({
      width,
      mode: this.hallway.density === "compact" ? "compact" : "expanded",
      online: this.hallway.chat.online(),
      room: this.hallway.chat.room() || this.hallway.room,
      pulse: Date.now() < this.pulseUntil,
      body,
      bodyRows: rows,
      preview: lastPreview(this.hallway.chat.messages()),
      theme: this.theme as Theme,
    });
  }

  invalidate(): void {}

  dispose(): void {
    this.disposed = true;
    this.unsubscribe();
    if (this.pulseTimer) clearTimeout(this.pulseTimer);
  }
}
