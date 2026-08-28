import { describe, expect, test } from "vitest";
import {
  bodyRows,
  inviteLabel,
  lastPreview,
  plainTheme,
  renderInviteCard,
  renderPane,
  roomLabel,
  visibleWidth,
} from "./chrome.js";

describe("hallway chrome", () => {
  test("caps expanded body height", () => {
    expect(bodyRows(40)).toBe(8);
    expect(bodyRows(20)).toBe(5);
    expect(bodyRows(8)).toBe(3);
  });

  test("labels random vs named rooms", () => {
    expect(roomLabel("")).toBe("random");
    expect(roomLabel("weekend-test")).toBe("#weekend-test");
    expect(inviteLabel("")).toBe("[ make invite ]");
    expect(inviteLabel("weekend-test")).toBe("[ invite ]");
  });

  test("renders an expanded box with matching line widths", () => {
    const lines = renderPane({
      width: 72,
      mode: "expanded",
      online: 4,
      room: "",
      body: ["maya  12:05", "anyone using bun for this?"],
      bodyRows: 4,
      theme: plainTheme,
    });
    expect(lines.some((line) => line.includes("omegle"))).toBe(true);
    expect(lines.some((line) => line.includes("4 online"))).toBe(true);
    expect(lines.some((line) => line.includes("random"))).toBe(true);
    expect(lines.some((line) => line.includes("[ make invite ]"))).toBe(true);
    expect(lines.some((line) => line.includes("anyone using bun"))).toBe(true);
    const boxed = lines.filter((line) => line.trim().length > 0);
    const widths = new Set(boxed.map((line) => visibleWidth(line)));
    expect(widths.size).toBe(1);
    expect(widths.has(72)).toBe(true);
  });

  test("collapses to a single title line", () => {
    const lines = renderPane({
      width: 80,
      mode: "compact",
      online: 4,
      room: "weekend-test",
      body: [],
      bodyRows: 4,
      preview: lastPreview([
        { nickname: "maya", text: "anyone using bun?", sentAt: 0 },
      ]),
      theme: plainTheme,
    });
    const boxed = lines.filter((line) => line.trim().length > 0);
    expect(boxed).toHaveLength(1);
    expect(boxed[0]).toContain("#weekend-test");
    expect(boxed[0]).toContain("maya:");
    expect(boxed[0]).toContain("ctrl+shift+m");
  });

  test("focus mode adds a compose row", () => {
    const lines = renderPane({
      width: 72,
      mode: "focus",
      online: 2,
      room: "weekend-test",
      body: ["hello"],
      bodyRows: 3,
      draft: "hi",
      nickname: "kai",
      theme: plainTheme,
    });
    expect(lines.some((line) => line.includes("Message as kai"))).toBe(true);
    expect(lines.some((line) => line.includes("esc"))).toBe(true);
  });

  test("invite card tells both hosts to use the same command", () => {
    const card = renderInviteCard(56, "weekend-test", plainTheme).join("\n");
    expect(card).toContain("/omegle-connect weekend-test");
    expect(card).toContain("Works in OpenCode, Pi, or the companion TUI.");
  });
});
