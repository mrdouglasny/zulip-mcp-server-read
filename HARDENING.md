# Read-only hardening notes

This fork of `avisekrath/zulip-mcp-server` is trimmed to a read-only tool
surface and patched against the findings of the security review in
`../REVIEW.md`.

## Changes from upstream

### Write tools removed
- `send-message`
- `edit-message` / `delete-message`
- `add-emoji-reaction` / `remove-emoji-reaction`
- `upload-file`
- `update-status`
- `create-scheduled-message` / `edit-scheduled-message`
- `create-draft` / `get-drafts` / `edit-draft`

### Read tools retained
- `search-users`, `get-users`, `get-user`, `get-user-by-email`, `get-user-groups`
- `get-messages`, `get-message`, `get-message-read-receipts`
- `get-subscribed-streams`, `get-stream-id`, `get-stream-by-id`, `get-topics-in-stream`
- `get-started`

### Security patches applied
- **A1**: `debugLog` infinite-recursion bug → replaced recursive call with
  `console.error` so debug mode no longer blows the stack
  (`src/zulip/client.ts`).
- **A2**: removed the two unconditional `🔍 SERVER DEBUG` prints that leaked
  `status_text` to stderr (they were in the now-deleted `update-status`
  handler).
- **A3/A4**: bumped `@modelcontextprotocol/sdk` to `^1.25.3` (patches the
  ReDoS advisory GHSA-8r9q-7v3j-jr4g) and `axios` to `^1.15.0` (patches the
  DoS-via-no-size-check advisory and pulls in a patched `form-data`).
- **A5**: `ZulipConfig`'s `url` is validated at `ZulipClient` construction
  time: must be a parseable URL with `http:` or `https:` scheme, and `http:`
  is only allowed for `localhost` / `127.0.0.1`.
- **A4/A6**: axios client configured with `maxRedirects: 0`,
  `maxContentLength: 50 MiB`, `maxBodyLength: 50 MiB`.
- **A8**: `get-started` no longer echoes `ZULIP_EMAIL` / `ZULIP_URL` back to
  the caller.

### Residual advisories
- `@modelcontextprotocol/sdk` still carries the "cross-client data leak via
  shared server/transport instance reuse" advisory
  (GHSA-345p-7cg4-v4c7). This affects `StreamableHttpServerTransport` with
  multiple clients. This server uses `StdioServerTransport` bound to a
  single local client, so the advisory is not applicable.
- The DNS rebinding advisory (GHSA-w48q-cv73-mx4w) similarly applies only
  to HTTP transports. Not applicable here.

### Build note
`src/server.ts` has one `@ts-expect-error TS2589` suppression at the first
`server.tool` call. The MCP SDK's `McpServer` accumulates tool types
across every registration, and with ~13 tools the inferred type exceeds
TypeScript 5.x's default instantiation-depth limit. Runtime behaviour is
unaffected; the suppression is scoped to a single line.

## Deployment

```bash
npm install
npm run build
# Set env:
#   ZULIP_URL=https://leanprover.zulipchat.com
#   ZULIP_EMAIL=<bot-or-user>@…
#   ZULIP_API_KEY=<from Zulip settings>
node dist/server.js   # run under stdio MCP transport
```

Register with Claude Code (or any MCP client) by pointing at
`dist/server.js` as the command, or via `npx zulip-mcp-server-read` after
`npm link`.
