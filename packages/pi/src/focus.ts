import type { Chat } from "@omeglecode/client";
import { limits } from "@omeglecode/protocol";
import type { Component, TUI } from "@earendil-works/pi-tui";
import { matchesKey } from "@earendil-works/pi-tui";
import type { Theme as PiTheme } from "@earendil-works/pi-coding-agent";
import {
  bodyRows,
  historyLines,
  renderPane,
  type Theme,
} from "./chrome.js";

export class OmegleFocus implements Component {
  private unsubscribe: () => void;
  private draft = "";
  private cursor = 0;
  private scrollOffset = 0;
  private disposed = false;

  constructor(
    private tui: TUI,
    private theme: PiTheme,
    private chat: Chat,
    private nickname: string,
    private room: string,
    private done: () => void,
  ) {
    this.unsubscribe = chat.subscribe(() => {
      if (this.disposed) return;
      const lines = this.lines();
      const rows = bodyRows(this.tui.terminal.rows);
      this.scrollOffset = Math.max(0, lines.length - rows);
      this.tui.requestRender();
    });
  }

  private lines(): string[] {
    return historyLines(
      this.chat.messages(),
      this.chat.status(),
      this.nickname,
      this.theme as Theme,
    );
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape")) {
      this.done();
      return;
    }
    if (matchesKey(data, "return")) {
      const text = this.draft.trim();
      if (text && this.chat.send(text)) this.draft = "";
      this.cursor = 0;
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, "backspace")) {
      if (this.cursor > 0) {
        this.draft =
          this.draft.slice(0, this.cursor - 1) + this.draft.slice(this.cursor);
        this.cursor -= 1;
        this.tui.requestRender();
      }
      return;
    }
    if (matchesKey(data, "left")) {
      this.cursor = Math.max(0, this.cursor - 1);
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, "right")) {
      this.cursor = Math.min(this.draft.length, this.cursor + 1);
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, "up")) {
      this.scrollOffset = Math.max(0, this.scrollOffset - 1);
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, "down")) {
      const rows = bodyRows(this.tui.terminal.rows);
      const maxOffset = Math.max(0, this.lines().length - rows);
      this.scrollOffset = Math.min(maxOffset, this.scrollOffset + 1);
      this.tui.requestRender();
      return;
    }
    if (data.length === 1 && data.charCodeAt(0) >= 32) {
      if (this.draft.length >= limits.message) return;
      this.draft =
        this.draft.slice(0, this.cursor) + data + this.draft.slice(this.cursor);
      this.cursor += 1;
      this.tui.requestRender();
    }
  }

  render(width: number): string[] {
    const rows = bodyRows(this.tui.terminal.rows);
    const lines = this.lines();
    const maxOffset = Math.max(0, lines.length - rows);
    const offset = Math.min(this.scrollOffset, maxOffset);
    this.scrollOffset = offset;
    return renderPane({
      width,
      mode: "focus",
      online: this.chat.online(),
      room: this.room,
      body: lines.slice(offset, offset + rows),
      bodyRows: rows,
      draft: this.draft,
      nickname: this.nickname,
      theme: this.theme as Theme,
    });
  }

  invalidate(): void {}

  dispose(): void {
    this.disposed = true;
    this.unsubscribe();
  }
}
