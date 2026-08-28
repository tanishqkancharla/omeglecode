import type { Component } from "@earendil-works/pi-tui";
import { matchesKey } from "@earendil-works/pi-tui";
import type { Theme as PiTheme } from "@earendil-works/pi-coding-agent";
import { renderInviteCard, type Theme } from "./chrome.js";

export class InviteDialog implements Component {
  constructor(
    private theme: PiTheme,
    private room: string,
    private done: () => void,
  ) {}

  handleInput(data: string): void {
    if (matchesKey(data, "escape") || matchesKey(data, "return")) this.done();
  }

  render(width: number): string[] {
    return renderInviteCard(width, this.room, this.theme as Theme);
  }

  invalidate(): void {}
  dispose(): void {}
}
