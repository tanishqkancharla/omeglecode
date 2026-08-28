# opencode-omeglecode

Anonymous, session-shuffled chat for the OpenCode v2 sidebar. The same Worker also hosts the Pi extension, so `/omegle-connect weekend-test` from either host is the same room.

Install the OpenCode v2 preview and Omeglecode:

```sh
npm install --global @opencode-ai/cli@beta
npx --yes opencode-omeglecode@latest install
opencode2
```

For Pi:

```sh
npx --yes opencode-omeglecode@latest install pi
```

Run `/omegle-nickname` once. Join a room with `/omegle-connect weekend-test`, or run `/omegle-invite` to create a room and get a command to share. Each active session connects automatically, even while chat is hidden. Use `/omegle-toggle` or `ctrl+shift+c` to toggle the sidebar and `ctrl+shift+m` to focus its message input. Enter sends and Esc returns to OpenCode.

The sidebar identifies the current room, including the code assigned during random matchmaking, and provides a clickable `[ invite ]` action to share `/omegle-connect`.

The installer configures the published TUI package in OpenCode's global `cli.json`. Room settings stay in OpenCode's plugin storage.

```json
{
  "plugins": [
    {
      "package": "/path/to/opencode-omeglecode/dist/tui.js",
      "options": {}
    }
  ]
}
```
