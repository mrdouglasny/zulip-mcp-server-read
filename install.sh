#!/usr/bin/env bash
# Install script for zulip-mcp-server-read.
#
# Runs npm install + build, then prints a ready-to-paste MCP config
# snippet with absolute paths so it works from any install location.

set -euo pipefail

cd "$(dirname "$0")"
REPO_DIR="$(pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "error: node is not on PATH. Install Node.js 18+ first." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "error: npm is not on PATH. Install Node.js 18+ first." >&2
  exit 1
fi

echo "==> npm install"
npm install

echo "==> npm run build"
npm run build

if [ ! -f "$REPO_DIR/dist/server.js" ]; then
  echo "error: build did not produce dist/server.js" >&2
  exit 1
fi

if [ ! -f "$REPO_DIR/.env" ]; then
  if [ -f "$REPO_DIR/.env.example" ]; then
    cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
    chmod 600 "$REPO_DIR/.env"
    echo
    echo "Created $REPO_DIR/.env from .env.example — edit it to add your"
    echo "ZULIP_URL, ZULIP_EMAIL, and ZULIP_API_KEY before first use."
  fi
fi

cat <<EOF

==============================================================
Build complete.

Add the following to ~/.claude/mcp.json (or merge into an existing
"mcpServers" block):

  "zulip": {
    "command": "node",
    "args": ["$REPO_DIR/dist/server.js"],
    "env": {
      "ZULIP_URL": "https://your-org.zulipchat.com",
      "ZULIP_EMAIL": "your-bot@your-org.zulipchat.com",
      "ZULIP_API_KEY": "your_api_key_here"
    }
  }

Alternatively, leave env out and rely on $REPO_DIR/.env (already
loaded by the server via dotenv).

Restart Claude Code for the config change to take effect.
==============================================================
EOF
