# opencode-omeglecode

Anonymous, session-shuffled team chat for the OpenCode v2 sidebar.

Install the OpenCode v2 preview and Omeglecode:

```sh
npm install --global @opencode-ai/cli@beta
npx --yes opencode-omeglecode@latest weekend-test
opencode2
```

Run `/omeglecode-nickname` once. Each active OpenCode session then connects automatically, even while the sidebar is hidden. Use `/omeglecode` or `ctrl+shift+c` to toggle the sidebar and `ctrl+shift+m` to focus its message input. Enter sends and Esc returns to OpenCode.

The installer configures the published TUI package and shared room in OpenCode's global `cli.json`. Run it again with a different code to change rooms.

```json
{
  "plugins": [
    {
      "package": "/path/to/opencode-omeglecode/dist/tui.js",
      "options": { "room": "weekend-test" }
    }
  ]
}
```
