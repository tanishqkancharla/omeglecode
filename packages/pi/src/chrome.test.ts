import { splitAiNickname, validNickname } from "@omeglecode/protocol";
import { describe, expect, test } from "vitest";
import {
  bodyRows,
  historyLines,
  lastPreview,
  plainTheme,
  renderInviteCard,
  renderPane,
  roomLabel,
  sendingStatus,
  stripAnsi,
  visibleWidth,
} from "./chrome.js";

function stripInner(line: string): string {
  return stripAnsi(line).replace(/^[│╰╭].|[│╯╮]$/g, "").trim();
}

describe("hallway chrome", () => {
  test("caps expanded body height", () => {
    expect(bodyRows(40)).toBe(8);
    expect(bodyRows(20)).toBe(5);
    expect(bodyRows(8)).toBe(3);
  });

  test("labels random vs named rooms", () => {
    expect(roomLabel("")).toBe("random");
    expect(roomLabel("weekend-test")).toBe("#weekend-test");
    expect(roomLabel("k7nmpwx2q4")).toBe("#k7nmpwx2q4");
    expect(sendingStatus("")).toBe("sending to random");
    expect(sendingStatus("weekend-test")).toBe("sending to #weekend-test");
    expect(sendingStatus("k7nmpwx2q4")).toBe("sending to #k7nmpwx2q4");
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
    expect(lines[0]).toContain("omegle");
    expect(lines.some((line) => line.includes("4 online"))).toBe(true);
    expect(lines.some((line) => line.includes("random"))).toBe(true);
    expect(lines.some((line) => line.includes("anyone using bun"))).toBe(true);
    expect(lines.some((line) => line.includes("invite"))).toBe(false);
    expect(lines.some((line) => line.includes("ctrl+shift"))).toBe(false);
    expect(lines[0]?.startsWith("╭")).toBe(true);
    expect(lines.at(-1)?.startsWith("╰")).toBe(true);
    const widths = new Set(lines.map((line) => visibleWidth(line)));
    expect(widths.size).toBe(1);
    expect(widths.has(72)).toBe(true);
  });

  test("pins short history to the bottom of the box", () => {
    const lines = renderPane({
      width: 40,
      mode: "expanded",
      online: 1,
      room: "",
      body: ["hello"],
      bodyRows: 4,
      theme: plainTheme,
    });
    expect(lines).toHaveLength(6);
    expect(stripInner(lines[1] ?? "")).toBe("");
    expect(stripInner(lines[2] ?? "")).toBe("");
    expect(stripInner(lines[3] ?? "")).toBe("");
    expect(stripInner(lines[4] ?? "")).toBe("hello");
    expect(lines[5]?.startsWith("╰")).toBe(true);
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
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("#weekend-test");
    expect(lines[0]).toContain("maya:");
    expect(lines[0]).not.toContain("ctrl+shift");
  });

  test("stacks messages without blank separators", () => {
    const lines = historyLines(
      [
        { nickname: "maya", text: "hi", sentAt: 0 },
        { nickname: "nova", text: "hey", sentAt: 0 },
      ],
      "connected",
      "kai",
      plainTheme,
    );
    expect(lines.filter((line) => line === "")).toHaveLength(0);
    expect(lines).toEqual([
      expect.stringMatching(/^maya {2}/),
      "hi",
      expect.stringMatching(/^nova {2}/),
      "hey",
    ]);
  });

  test("highlights the [ai] nickname prefix", () => {
    const tagged = {
      fg: (name: string, text: string) =>
        name === "warning" ? `[${text}]` : text,
    };
    const lines = historyLines(
      [{ nickname: "[ai] wes", text: "boohoo svelte", sentAt: 0 }],
      "connected",
      "kai",
      tagged,
    );
    expect(lines[0]).toContain("[[ai]]");
    expect(lines[0]).toContain("wes");
    expect(lines[1]).toBe("boohoo svelte");
  });

  test("accepts agent nicknames with an [ai] prefix", () => {
    expect(validNickname("maya")).toBe(true);
    expect(validNickname("[ai] wes")).toBe(true);
    expect(validNickname("[ai] scott")).toBe(true);
    expect(validNickname("[ai] Wes Bos")).toBe(true);
    expect(validNickname("[ai]wes")).toBe(false);
    expect(splitAiNickname("[ai] wes")).toEqual({
      prefix: "[ai]",
      name: "wes",
    });
    expect(splitAiNickname("maya")).toBeUndefined();
  });
  test("invite card tells both hosts to use the same command", () => {
    const card = renderInviteCard(56, "weekend-test", plainTheme).join("\n");
    expect(card).toContain("/omegle-connect weekend-test");
    expect(card).toContain("Works in OpenCode, Pi, or the companion TUI.");
  });
});
