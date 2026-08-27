#!/bin/sh
set -eu

mkdir -p .opencode/plugins/tui
cp packages/plugin/dist/tui.js .opencode/plugins/tui/omeglecode.js
cat > .opencode/cli.json <<'EOF'
{
  "plugins": [
    {
      "package": "./plugins/tui/omeglecode.js",
      "options": {
        "endpoint": "ws://127.0.0.1:8787/connect?development=true"
      }
    }
  ]
}
EOF
