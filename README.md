# Zulip MCP Server

A Model Context Protocol (MCP) server that exposes Zulip REST API capabilities as tools for LLMs. This server allows AI assistants to interact with your Zulip workspace programmatically.

## Features

### 🔄 **Resources** (Contextual Data)
- **User Directory**: Browse organization members with roles and status
- **Stream Directory**: Explore available streams and permissions  
- **Message Formatting Guide**: Complete Zulip markdown syntax reference
- **Organization Info**: Server settings, policies, and custom emoji
- **User Groups**: Available groups for mentions and permissions

### 🛠️ **Tools** (25 Available Actions)

#### Helper Tools (LLM-Friendly Discovery)
- `search-users` - Find users by name/email before sending DMs
- `get-started` - Test connection and get workspace overview

#### Message Operations
- `send-message` - Send to streams or direct messages
- `get-messages` - Retrieve with advanced filtering and search
- `get-message` - Get detailed information about specific message
- `upload-file` - Share files and images
- `edit-message` - Modify content or move topics
- `delete-message` - Remove messages (admin permissions required)
- `get-message-read-receipts` - Check who read messages
- `add-emoji-reaction` - React with Unicode or custom emoji
- `remove-emoji-reaction` - Remove emoji reactions from messages

#### Scheduled Messages & Drafts
- `create-scheduled-message` - Schedule future messages
- `edit-scheduled-message` - Modify scheduled messages
- `create-draft` - Create new message drafts
- `get-drafts` - Retrieve saved drafts
- `edit-draft` - Update draft content

#### Stream Management
- `get-subscribed-streams` - List user's stream subscriptions
- `get-stream-id` - Get stream ID by name
- `get-stream-by-id` - Detailed stream information
- `get-topics-in-stream` - Browse recent topics

#### User Operations
- `get-users` - List organization members
- `get-user-by-email` - Find users by email
- `get-user` - Get detailed user information by ID
- `update-status` - Set status message and availability
- `get-user-groups` - List available user groups

## 📝 Zulip Terminology: Streams vs Channels

In Zulip, **"streams"** and **"channels"** refer to the same concept:
- **Stream** = Official Zulip terminology (used in API, tools, interface)
- **Channel** = Common term from Slack/Discord/Teams  
- **Same thing** = Conversation spaces where teams discuss topics

This MCP server uses "stream" to match Zulip's official documentation and API.

## Installation & Setup

### Prerequisites
- Node.js 18+ with npm
- TypeScript 5+
- Access to a Zulip instance (e.g., https://your-organization.zulipchat.com)
- Zulip API credentials (bot token or API key)

### Quick Start

One-liner (clones, installs, builds, prints the MCP config to paste):

```bash
git clone https://github.com/mrdouglasny/zulip-mcp-server-read.git \
  && cd zulip-mcp-server-read \
  && ./install.sh
```

Then edit `.env` (created for you from `.env.example`) to add your
`ZULIP_URL`, `ZULIP_EMAIL`, and `ZULIP_API_KEY`.

Manual steps if you prefer:

1. **Clone and install dependencies:**
```bash
git clone https://github.com/mrdouglasny/zulip-mcp-server-read.git
cd zulip-mcp-server-read
npm install
```

2. **Configure environment variables:**
```bash
cp .env.example .env
# Edit .env with your Zulip credentials
```

3. **Build and run:**
```bash
npm run build
npm start
```

### Environment Configuration

Create a `.env` file with your Zulip credentials:

```env
ZULIP_URL=https://your-organization.zulipchat.com
ZULIP_EMAIL=your-bot-email@yourcompany.com
ZULIP_API_KEY=your-api-key-here
NODE_ENV=production
```

#### Getting Zulip API Credentials

1. **For Bot Access** (Recommended):
   - Go to your Zulip organization settings
   - Navigate to "Bots" section
   - Create a new bot or use existing one
   - Copy the bot email and API key

2. **For Personal Access**:
   - Go to Personal Settings → Account & Privacy
   - Find "API key" section
   - Generate or reveal your API key

### Claude Desktop Integration

To use this MCP server with Claude Desktop, add the following configuration to your Claude Desktop config file:

#### Option 1: Using Environment Variables (Recommended)

Add to your Claude Desktop configuration:
```json
{
  "mcpServers": {
    "zulip": {
      "command": "node",
      "args": ["/path/to/zulip-mcp-server/dist/server.js"],
      "env": {
        "ZULIP_URL": "https://your-organization.zulipchat.com",
        "ZULIP_EMAIL": "your-bot-email@yourcompany.com", 
        "ZULIP_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

#### Option 2: Using .env File

If you prefer using a `.env` file, ensure it's in the project directory and use:
```json
{
  "mcpServers": {
    "zulip": {
      "command": "node",
      "args": ["/path/to/zulip-mcp-server/dist/server.js"],
      "cwd": "/path/to/zulip-mcp-server"
    }
  }
}
```

**Claude Desktop Config Location:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### Cursor Integration

To use this MCP server with Cursor IDE, add the following to your Cursor MCP settings:

#### Cursor MCP Configuration

Add to Cursor's MCP settings file (`.cursor-mcp/config.json` in your workspace or global settings):

```json
{
  "mcpServers": {
    "zulip": {
      "command": "node",
      "args": ["/path/to/zulip-mcp-server/dist/server.js"],
      "env": {
        "ZULIP_URL": "https://your-organization.zulipchat.com",
        "ZULIP_EMAIL": "your-bot-email@yourcompany.com",
        "ZULIP_API_KEY": "your-api-key-here"
      },
      "capabilities": {
        "tools": true,
        "resources": true
      }
    }
  }
}
```

**Cursor MCP Config Location:**
- **Workspace**: `.cursor-mcp/config.json` in your project root
- **Global**: Platform-specific Cursor settings directory

### Raycast MCP Extension

To use this MCP server with Raycast, configure it in the MCP extension settings:

#### Raycast MCP Configuration

Add to Raycast MCP extension configuration:

```json
{
  "servers": {
    "zulip": {
      "name": "Zulip Integration",
      "description": "Send messages and interact with Zulip workspace",
      "command": "node",
      "args": ["/path/to/zulip-mcp-server/dist/server.js"],
      "env": {
        "ZULIP_URL": "https://your-organization.zulipchat.com",
        "ZULIP_EMAIL": "your-bot-email@yourcompany.com",
        "ZULIP_API_KEY": "your-api-key-here"
      },
      "icon": "💬",
      "categories": ["communication", "productivity"]
    }
  }
}
```

**Raycast Setup Steps:**
1. Install the Raycast MCP extension
2. Open Raycast preferences → Extensions → MCP
3. Add new server configuration
4. Paste the JSON configuration above
5. Update paths and credentials accordingly

**Raycast Usage:**
- Use `⌘ + Space` to open Raycast
- Search for "Zulip" commands
- Execute MCP tools directly from Raycast interface

### Supported MCP Clients

This server is compatible with any MCP-compliant client. Here are the verified integrations:

| Platform | Config Type | Status | Usage |
|----------|-------------|---------|-------|
| **Claude Desktop** | JSON config | ✅ Verified | AI conversations with Zulip integration |
| **Cursor IDE** | Workspace/Global config | ✅ Verified | Code editor with Zulip notifications |
| **Raycast** | Extension config | ✅ Verified | Quick commands and automation |
| **Other MCP Clients** | Standard MCP protocol | 🔄 Compatible | Any MCP-compliant application |

**Universal MCP Command:**
```bash
node /path/to/zulip-mcp-server/dist/server.js
```

## Development

### Scripts
```bash
npm run dev          # Development with hot reload
npm run build        # Build for production
npm test            # Run tests
npm run lint        # Lint TypeScript
npm run typecheck   # Type checking
```

### Project Structure
```
src/
├── server.ts        # Main MCP server
├── zulip/
│   └── client.ts    # Zulip API client
└── types.ts         # TypeScript definitions
```

### Testing

Test the server using MCP Inspector:
```bash
npx @modelcontextprotocol/inspector npm start
```

## Usage Examples

### Sending Messages
```typescript
// Send to a stream
await callTool("send-message", {
  type: "stream",
  to: "general",
  topic: "Daily Standup",
  content: "Good morning team! 👋\n\n**Today's Goals:**\n- Review PR #123\n- Deploy feature X"
});

// Direct message
await callTool("send-message", {
  type: "direct",
  to: "user@example.com",
  content: "Hey! Can you review the latest changes when you have a moment?"
});
```

### Getting Messages
```typescript
// Get recent messages from a stream
await callTool("get-messages", {
  narrow: [["stream", "general"], ["topic", "announcements"]],
  num_before: 50
});

// Search messages
await callTool("get-messages", {
  narrow: [["search", "deployment"], ["sender", "admin@example.com"]]
});
```

### Stream Management
```typescript
// List subscribed streams
await callTool("get-subscribed-streams", {
  include_subscribers: true
});

// Get stream topics
await callTool("get-topics-in-stream", {
  stream_id: 123
});
```

## Markdown Formatting Support

The server includes a comprehensive formatting guide resource. Zulip supports:

- **Standard Markdown**: Bold, italic, code, links, lists
- **Mentions**: `@**Full Name**` (notify), `@_**Name**_` (silent)
- **Stream Links**: `#**stream-name**`
- **Code Blocks**: With syntax highlighting
- **Math**: LaTeX expressions with `$$math$$`
- **Spoilers**: `||hidden content||`
- **Custom Emoji**: Organization-specific emoji

## Error Handling

The server provides comprehensive error handling:
- Network connectivity issues
- Authentication failures
- Permission errors
- Rate limiting
- Invalid parameters
- Zulip API errors

All errors include helpful messages for debugging.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure TypeScript compilation passes
5. Submit a pull request

## Support

For issues and questions:
- Check Zulip API documentation: https://zulip.com/api/
- Review MCP specification: https://modelcontextprotocol.io/
- Open GitHub issues for bugs or feature requests
