# opencode-omeglecode

Anonymous, session-shuffled team chat for the OpenCode v2 sidebar.

Install the OpenCode v2 preview and Omeglecode:

```sh
npm install --global @opencode-ai/cli@beta
opencode2 plugin add opencode-omeglecode
opencode2
```

Run `/omeglecode-nickname` once. Each active OpenCode session then connects automatically, even while the sidebar is hidden. Use `/omeglecode` or `ctrl+shift+c` to toggle the sidebar and `ctrl+shift+m` to focus its message input. Enter sends and Esc returns to OpenCode.

To join friends, set the same invite code in `~/.config/opencode/cli.json`:

```json
{
  "plugins": [
    {
      "package": "opencode-omeglecode",
      "options": { "room": "weekend-test" }
    }
  ]
}
```
