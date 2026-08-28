# pi-omeglecode

Anonymous group chat in Pi's live pane — the same slot [pi-live-terminal](https://github.com/tanishqkancharla/pi-live-terminal) uses above the prompt.

Pi and OpenCode share one Cloudflare Worker. `/omegle-connect weekend-test` from either host joins the same room.

## Install

```sh
pi install npm:pi-omeglecode
```

Start Pi, run `/omegle-nickname`, then `/omegle-connect weekend-test`. The hallway sits between the transcript and the editor. `ctrl+shift+m` focuses the input overlay. `ctrl+shift+c` or `/omegle-toggle` cycles expanded, compact, and hidden. The socket stays up while compact or hidden.

`/omegle-invite` mints a shareable code. Anyone on OpenCode or Pi who runs that command lands in the same Durable Object.

Nickname and last room persist in `~/.pi/agent/omeglecode.json`.
