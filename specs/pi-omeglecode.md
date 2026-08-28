# Pi Omeglecode

Best-possible recreation of the OpenCode hallway inside Pi. Interactive mock: [`prototypes/pi-omeglecode.html`](../prototypes/pi-omeglecode.html).

Steal the chrome from [pi-live-terminal](https://github.com/tanishqkancharla/pi-live-terminal), not from OpenCode's sidebar. That extension already proved the native slot: a bordered live pane **above the prompt**, `setWidget(..., { placement: "aboveEditor" })`. The Pi transcript shrinks. Nothing covers it. You keep typing to the agent while the pane updates.

Omeglecode is the same object with chat inside it.

## System flow

```mermaid
flowchart LR
    U[Pi user] --> E[Omeglecode extension]
    E -->|hash session file locally| W[Cloudflare Worker]
    W --> M[Matchmaker]
    M -->|stable room, capacity 8| R[ChatRoom]
    R --> E
    E --> V["aboveEditor widget"]
    E --> F["focus overlay to type"]
```

```mermaid
sequenceDiagram
    participant U as User
    participant E as Extension
    participant P as Pi TUI
    participant R as Chat room
    U->>E: session_start
    E->>E: SHA-256("pi:" + session file), 128 bits
    E->>P: setWidget aboveEditor (live pane)
    E->>R: WebSocket
    R-->>P: widget redraws in place
    U->>E: ctrl+shift+m
    E->>P: ui.custom overlay with input
    U->>R: type, Enter
    U->>E: Esc
    E->>P: close overlay, widget still there
    U->>P: keep prompting Pi
```

## What it looks like

Pi is vertical: transcript, **widget**, editor, footer. The hallway lives in the widget, the same place live-terminal puts tmux.

### Expanded — default

A boxed pane directly above the prompt. ~8 history rows, header, shortcut footer. Connection is already live. The Pi editor stays focused.

```
you
  the auth middleware is rejecting valid JWTs after refresh

pi
  I'll inspect the token refresh path next.

  [read] src/auth/middleware.ts

╭─ omegle  ·  4 online  ·  random ──────────── [ make invite ] ─╮
│ maya  12:05                                                   │
│ anyone using bun for this?                                    │
│                                                               │
│ nova  12:06                                                   │
│ yeah, 1.2 is fine                                             │
╰─ ctrl+shift+m focus · ctrl+shift+c compact ───────────────────╯
▌ also bump the tests_
~/acme  opus 4.6  18.2k  $0.04
```

This is the OpenCode sidebar, laid down. Same header (`omegle`, count, room, invite). Same transcript. No input row while the agent has the keyboard — that is what live-terminal does too.

Rules:

- Box-drawing borders via `theme.fg("border", ...)`, title in accent, hints in muted/dim. Truncate every line to `width`.
- History sticks to the bottom. Mouse wheel scrolls, same as live-terminal's widget `handleInput`.
- New messages restyle the count for ~1.2s. Do not toast every line.
- Height: 8 body rows, or `min(8, max(3, floor(terminalRows * 0.28)))`. Live-terminal uses 16 because a tty needs a screen. Chat does not.
- No nickname yet: body is `run /omegle-nickname to join`.

### Compact

`ctrl+shift+c` or `/omegle-toggle` collapses to one title line above the prompt. Socket stays up.

```
╭ omegle  ·  4 online  ·  random  ·  maya: anyone using bun?  ctrl+shift+m ╮
▌ also bump the tests_
```

Toggle again to expand. Hidden entirely is a third press, or `/omegle-toggle` cycling `expanded → compact → hidden → expanded`. Prefer compact over hidden so presence never disappears.

### Focus — type in the room

Widgets do not own the keyboard. live-terminal solves this with `ctrl+shift+f` → `ctx.ui.custom` overlay. Omeglecode does the same on **`ctrl+shift+m`** (keep OpenCode's chord).

The overlay is **not** full-screen. It is the same pane, with an input, anchored on the widget:

```
╭─ omegle  ·  4 online  ·  random ──────────── [ make invite ] ─╮
│ maya  12:05                                                   │
│ anyone using bun for this?                                    │
│                                                               │
│ kai  12:06                                                    │
│ yeah, 1.2 is fine                                             │
├───────────────────────────────────────────────────────────────┤
│ Message as kai                                          Enter │
╰─ esc back to pi ──────────────────────────────────────────────╯
▌
```

`overlayOptions`: `anchor: "bottom-center"`, `width: "100%"`, `maxHeight` ≈ widget height, `margin.bottom` = editor + footer. Visually it replaces the widget while you type. Enter sends. Esc calls `done()` and the widget is still there.

Do not use `ctx.ui.input()` as the main compose path. A one-shot prompt is a pager, not a hallway.

### Invite

`/omegle-invite` or `[ make invite ]` / `[ invite ]` uses a small centered `ctx.ui.custom` dialog. Random rooms mint a code, reconnect, then show:

```
Invite to Omegle

Room: weekend-test

Ask them to run:
/omegle-connect weekend-test

Works in OpenCode, Pi, or the companion TUI.
```

The widget title switches from `random` to `#weekend-test`.

## Why this is the ceiling

| OpenCode | Pi, following live-terminal | Gap |
| --- | --- | --- |
| Dedicated sidebar column | `aboveEditor` widget. Real layout. Transcript shrinks, nothing is covered | Vertical instead of right |
| Sidebar always visible while you prompt | Widget has no keyboard; editor stays focused | Same feeling |
| Inline input in the sidebar | Focus overlay on `ctrl+shift+m` | Extra chord to type; Esc still returns |
| Sidebar toggle | Compact/hide the widget | Same |
| Always-on socket | Connect on `session_start`, independent of widget height | Same |
| Session-sticky rooms | Hash `"pi:" + ctx.sessionManager.getSessionFile()` | Same |

A right-edge overlay was the previous proposal. Drop it. It covers the transcript, fights Pi's vertical layout, and ignores the slot this repo's author already uses for live panes.

Do not grow the widget to 16+ rows. That is a terminal. This is a hallway. Do not `sendMessage` / `appendEntry` chat into the Pi thread. Do not register an LLM tool that sends chat.

## Chrome and chords

OpenCode names, live-terminal shape.

| Action | Chord / command | live-terminal analog |
| --- | --- | --- |
| Focus hallway input | `ctrl+shift+m` | `ctrl+shift+f` |
| Compact / expand widget | `ctrl+shift+c` or `/omegle-toggle` | `ctrl+shift+v` detach |
| Nickname | `/omegle-nickname` | — |
| Join named room | `/omegle-connect CODE` | `/live-terminal:attach` |
| Invite / mint code | `/omegle-invite` | — |
| Send | Enter (while focused) | — |
| Return to Pi editor | Esc | close focus modal |

## Session, privacy, matchmaking

On `session_start`:

1. Read nickname + last room from `~/.pi/agent/omeglecode.json`.
2. Session key = SHA-256 of `pi:` plus the session file path, truncated to 32 hex chars. Ephemeral sessions hash `pi:ephemeral:` plus cwd plus process start time.
3. Connect to the existing Worker. Same protocol, 8-person cap, 50-line history, 280-char messages.
4. `setWidget("omeglecode", factory, { placement: "aboveEditor" })`.

On `session_shutdown`: `setWidget("omeglecode", undefined)`, close the socket.

Prefixing `pi:` avoids colliding with OpenCode session IDs. Random rooms still mix hosts.

## Pi API mapping

Copy the live-terminal attach pattern.

```ts
pi.on("session_start", (_event, ctx) => {
  if (!ctx.hasUI) return;
  connectSocket(sessionKey(ctx));
  ctx.ui.setWidget(
    "omeglecode",
    (tui, theme) => new OmegleWidget(tui, theme, store),
    { placement: "aboveEditor" },
  );
});

pi.registerShortcut("ctrl+shift+m", {
  handler: async (ctx) => {
    await ctx.ui.custom(
      (tui, theme, _kb, done) => new OmegleFocus(tui, theme, store, done),
      {
        overlay: true,
        overlayOptions: {
          anchor: "bottom-center",
          width: "100%",
          maxHeight: 14,
          margin: { bottom: editorChrome(ctx) },
        },
      },
    );
  },
});

pi.registerShortcut("ctrl+shift+c", { handler: cycleDensity });
pi.registerCommand("omegle-toggle", { handler: cycleDensity });
pi.registerCommand("omegle-nickname", { handler: promptNickname });
pi.registerCommand("omegle-connect", { handler: connectRoom, getArgumentCompletions });
pi.registerCommand("omegle-invite", { handler: invite });
```

`OmegleWidget.render(width)` returns a `string[]` of boxed lines, same structure as `LiveTerminalWidget`. Incoming events call `tui.requestRender()`. Theme only through `theme.fg(...)`.

Install: `npx omeglecode install pi` writes `~/.pi/agent/extensions/omeglecode/index.ts` (jiti). Or `pi install` once the package is an extension.

## Goals

- Recreate the hallway in Pi's native live-pane slot.
- Keep the socket up while the widget is compact or hidden.
- Preserve OpenCode slash names and `ctrl+shift+m`.
- Mix with OpenCode users in random and invite rooms.

## Non-goals

- A right sidebar clone.
- Full-screen focus (live-terminal needs that for a tty; chat does not).
- Agent-mediated send/receive.
- Replacing Pi's footer.

## Implementation

### Phase 1: Shared client

Extract connect, hash, reconnect, send, subscribe from `packages/plugin/src/Chat.ts`. Pi hashes `"pi:" + session file`; OpenCode keeps hashing the raw session ID.

### Phase 2: Pi extension

- [x] `session_start` / `session_shutdown`.
- [x] `OmegleWidget` above the editor, expanded + compact.
- [x] Focus overlay with input; Esc returns to the editor.
- [x] Shortcuts and slash commands.
- [x] Nickname + room in `~/.pi/agent/omeglecode.json`.
- [x] Invite dialog.
- [x] Installer target `pi`.

### Phase 3: Feel

- [ ] Editor keeps keys while the widget is visible.
- [ ] Focused overlay: Enter sends, Esc closes, history sticks to bottom.
- [ ] `/reload` reconnects instead of leaking sockets.
- [ ] Sit next to pi-live-terminal: two `aboveEditor` widgets stack. Keep Omegle compact by default if a live terminal is already using height — if we cannot detect that, 8 rows is the cap.
