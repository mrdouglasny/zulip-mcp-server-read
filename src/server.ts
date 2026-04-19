#!/usr/bin/env node

/**
 * Zulip MCP Server - Clean version with improved code quality
 * Maintains full MCP compliance with better organization
 */

import 'dotenv/config';
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ZulipClient } from "./zulip/client.js";
import {
  ZulipConfig,
  SearchUsersSchema,
  GetMessagesSchema,
  GetUserByEmailSchema,
  GetUserSchema,
  GetMessageSchema,
  GetMessageReadReceiptsSchema,
  ListUsersSchema,
  GetStreamTopicsSchema,
  GetSubscribedStreamsSchema,
  GetStreamIdSchema,
  GetStreamByIdSchema
} from "./types.js";

/**
 * Environment validation
 */
function validateEnvironment(): ZulipConfig {
  const url = process.env.ZULIP_URL;
  const email = process.env.ZULIP_EMAIL;
  const apiKey = process.env.ZULIP_API_KEY;

  if (!url || !email || !apiKey) {
    throw new Error(
      `Missing required environment variables. Please set:
      - ZULIP_URL: Your Zulip server URL (e.g., https://your-org.zulipchat.com)
      - ZULIP_EMAIL: Your bot/user email address
      - ZULIP_API_KEY: Your API key from Zulip settings
      
      You can set these as environment variables or create a .env file in the project root.
      
      Missing: ${!url ? 'ZULIP_URL ' : ''}${!email ? 'ZULIP_EMAIL ' : ''}${!apiKey ? 'ZULIP_API_KEY ' : ''}`
    );
  }

  return { url, email, apiKey };
}

/**
 * Create success response in MCP format
 */
function createSuccessResponse(text: string) {
  return {
    content: [{
      type: "text" as const,
      text
    }]
  };
}

/**
 * Create error response in MCP format
 */
function createErrorResponse(message: string) {
  return {
    content: [{
      type: "text" as const,
      text: message
    }],
    isError: true
  };
}

// Initialize Zulip client
const config = validateEnvironment();
const zulipClient = new ZulipClient(config);

// Create MCP server
const server = new McpServer({
  name: "zulip-mcp-server",
  version: "1.5.0"
});

// Register Resources
server.resource(
  "users-directory",
  new ResourceTemplate("zulip://users?include_bots={include_bots}", { list: undefined }),
  async (uri, { include_bots }) => {
    try {
      const result = await zulipClient.getUsers({
        client_gravatar: true,
        include_custom_profile_fields: true
      });
      
      const users = result.members.filter(user => include_bots || !user.is_bot);
      
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({
            users: users.map(user => ({
              id: user.user_id,
              email: user.email,
              name: user.full_name,
              is_bot: user.is_bot,
              is_active: user.is_active,
              role: user.is_owner ? 'owner' : user.is_admin ? 'admin' : user.is_moderator ? 'moderator' : user.is_guest ? 'guest' : 'member'
            }))
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: `Error fetching users: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }
);

server.resource(
  "streams-directory", 
  new ResourceTemplate("zulip://streams?include_archived={include_archived}", { list: undefined }),
  async (uri, { include_archived }) => {
    try {
      const result = await zulipClient.getSubscriptions(false);
      const streams = include_archived 
        ? result.subscriptions 
        : result.subscriptions.filter(stream => !stream.is_archived);
      
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({
            streams: streams.map(stream => ({
              id: stream.stream_id,
              name: stream.name,
              description: stream.description,
              invite_only: stream.invite_only,
              is_archived: stream.is_archived,
              is_announcement_only: stream.is_announcement_only
            }))
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: `Error fetching streams: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }
);

server.resource(
  "message-formatting-guide",
  "zulip://formatting/guide",
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: `# Zulip Message Formatting Guide

## Basic Markdown
- **Bold text**: **bold** or __bold__
- *Italic text*: *italic* or _italic_
- \`Code\`: \`inline code\`
- Links: [text](URL)
- ~~Strikethrough~~: ~~strikethrough~~
- Quoted text: > quoted text

## Zulip-Specific Formatting

### Mentions
#### User Mentions
- \`@**Full Name**\` - Standard mention (notifies user)
- \`@_**Full Name**_\` - Silent mention (no notification)

#### Group Mentions  
- \`@**groupname**\` - Standard group mention
- \`@_*groupname*\` - Silent group mention

#### Wildcard Mentions
- \`@**all**\` - Mentions all users in organization
- \`@**everyone**\` - Mentions all users in organization
- \`@**stream**\` - Mentions all subscribers to current stream
- \`@**topic**\` - Mentions all participants in current topic

### Stream and Topic Links
- \`#**streamname**\` - Link to stream
- \`#**streamname>topicname**\` - Link to specific topic
- \`#**streamname>topicname@messageID**\` - Link to specific message

### Code Blocks
\`\`\`python
def hello():
    print("Hello, Zulip!")
\`\`\`

### Spoiler Text
\`\`\`spoiler Header text
Hidden content here
\`\`\`

### Global Time Mentions
- \`<time:timestamp>\` - Displays time in user's timezone
- Example: \`<time:2024-06-02T10:30:00Z>\`

### Best Practices
- Use mentions sparingly to avoid notification spam
- Format code blocks with appropriate language for syntax highlighting
- Use silent mentions when you don't need immediate attention
- Link to specific topics/messages for better context
- Images are automatically thumbnailed and support previews

### Supported Features
- Unicode emoji and custom emoji
- Image uploads with automatic thumbnailing
- File attachments
- LaTeX math rendering (if enabled)
- Message reactions
- Message editing history`
    }]
  })
);

server.resource(
  "common-patterns",
  "zulip://patterns/common",
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: `# Common Zulip MCP Usage Patterns for LLMs

## Zulip Terminology Note
**Streams = Channels**: In Zulip, "streams" and "channels" refer to the same thing - conversation spaces for teams. This server uses "stream" to match Zulip's official terminology, but if you're familiar with Slack/Discord "channels", they're identical concepts.

## Getting Started Workflow
1. **Always start with**: \`get-started\` - Tests connection and shows available streams
2. **For user discovery**: \`search-users\` to explore users by name/email
3. **For exact user lookup**: \`get-user-by-email\` when you have their email
4. **For detailed user info**: \`get-user\` when you have their user ID
5. **Before sending to streams**: \`get-subscribed-streams\` to see exact stream names

## Sending Direct Messages
\`\`\`
Step 1: search-users with query="John Doe"
Step 2: send-message with type="direct", to="john.doe@example.com", content="Hello!"
\`\`\`

## Sending to Streams
\`\`\`
Step 1: get-subscribed-streams (to see exact names)
Step 2: send-message with type="stream", to="general", topic="Hello", content="Hi everyone!"
\`\`\`

## Common Mistakes to Avoid
- ❌ Using display names for DMs (use emails from search-users)
- ❌ Wrong case for stream names (they're case-sensitive)
- ❌ Forgetting topic for stream messages (always required)
- ❌ Assuming stream/user exists (always search first)

## Tool Selection Guide
**User Tools - When to use which:**
- 🔍 \`search-users\` → Exploring, don't know exact details, want multiple options
- 📧 \`get-user-by-email\` → Have exact email, need profile information  
- 🆔 \`get-user\` → Have user ID from search results, need complete details

**Message Tools - When to use which:**
- 📋 \`get-messages\` → Browse conversations, search content, get message history
- 🔍 \`get-message\` → Analyze one specific message, check reactions/edit history

## Debugging Tips
- "User not found" → You used a name instead of email address, try search-users first
- "Stream not found" → Check exact spelling with get-subscribed-streams
- "Topic required" → You forgot to include topic for stream messages
- "Invalid email" → Use actual email addresses, not display names

## Best Practices
- Always use helper tools (search-users, get-started) before main actions
- Test connection with get-started if other tools fail
- Use exact values returned by search/list tools
- Include descriptive topics for stream messages`
    }]
  })
);

// Register Tools

// Helper tool for finding users - makes LLM usage much easier.
// @ts-expect-error TS2589: McpServer accumulates tool types across all registrations,
// and with >10 tools the inferred type exceeds TS's depth limit. Runtime behaviour
// is unaffected. Upstream tracking: modelcontextprotocol/typescript-sdk#390.
server.tool(
  "search-users",
  "🔍 DISCOVERY: Search for users by partial name or email. Returns multiple matching results with basic info (name, email, ID).",
  SearchUsersSchema.shape,
  async ({ query, limit }) => {
    try {
      const usersResponse = await zulipClient.getUsers();
      const lowerQuery = query.toLowerCase();
      
      const filtered = usersResponse.members.filter((user: any) => 
        user.full_name.toLowerCase().includes(lowerQuery) ||
        user.email.toLowerCase().includes(lowerQuery)
      ).slice(0, limit);
      
      if (filtered.length === 0) {
        return createSuccessResponse(`No users found matching "${query}". Try a shorter search term or check spelling.`);
      }
      
      const results = filtered.map((user: any) => ({
        name: user.full_name,
        email: user.email,
        id: user.id,
        active: user.is_active
      }));
      
      return createSuccessResponse(JSON.stringify({
        query,
        found: filtered.length,
        users: results
      }, null, 2));
    } catch (error) {
      return createErrorResponse(`Error searching users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

// Quick connection test and orientation tool
server.tool(
  "get-started",
  "🚀 START HERE: Test connection and get workspace overview. Use this first to verify everything is working and see available streams. Perfect for orientation and troubleshooting.",
  {},
  async () => {
    try {
      const [streams, recentMessages] = await Promise.all([
        zulipClient.getSubscriptions().catch(() => ({ subscriptions: [] })),
        zulipClient.getMessages({ anchor: "newest", num_before: 3 }).catch(() => ({ messages: [] }))
      ]);
      
      const info = {
        status: "✅ Connected to Zulip",
        streams_available: streams.subscriptions?.length || 0,
        sample_streams: streams.subscriptions?.slice(0, 5).map((s: any) => s.name) || [],
        recent_activity: recentMessages.messages?.length > 0,
        quick_tips: [
          "This is a read-only client — no message sending, editing, or reacting.",
          "Use 'search-users' to find users by name or email.",
          "Stream names are case-sensitive.",
          "Use 'get-messages' with a 'narrow' filter to scope searches by stream, topic, sender, or keyword."
        ]
      };
      
      return createSuccessResponse(JSON.stringify(info, null, 2));
    } catch (error) {
      return createErrorResponse(`Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

server.tool(
  "get-messages",
  "📋 BULK RETRIEVAL: Get multiple messages with filtering, pagination, and search. Use this to browse conversations, search for content, or get message history. Returns array of messages with basic details.",
  GetMessagesSchema.shape,
  async ({ anchor, num_before, num_after, narrow, message_id }) => {
    try {
      const result = await zulipClient.getMessages({
        anchor,
        num_before,
        num_after,
        narrow,
        message_id
      });
      
      return createSuccessResponse(JSON.stringify({
        message_count: result.messages.length,
        messages: result.messages.map(msg => ({
          id: msg.id,
          sender: msg.sender_full_name,
          timestamp: new Date(msg.timestamp * 1000).toISOString(),
          content: msg.content,
          type: msg.type,
          topic: msg.topic || msg.subject,
          stream_id: msg.stream_id,
          reactions: msg.reactions
        }))
      }, null, 2));
    } catch (error) {
      return createErrorResponse(`Error retrieving messages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

server.tool(
  "get-users",
  "👥 ALL USERS: Get complete list of all users in the organization with their profile information. Use this to see everyone at once or when you need the full user directory.",
  ListUsersSchema.shape,
  async ({ client_gravatar, include_custom_profile_fields }) => {
    try {
      const result = await zulipClient.getUsers({
        client_gravatar,
        include_custom_profile_fields
      });
      
      return createSuccessResponse(JSON.stringify({
        user_count: result.members.length,
        users: result.members.map(user => ({
          id: user.user_id,
          email: user.email,
          full_name: user.full_name,
          is_active: user.is_active,
          is_bot: user.is_bot,
          role: user.is_owner ? 'owner' : 
                user.is_admin ? 'admin' : 
                user.is_moderator ? 'moderator' : 
                user.is_guest ? 'guest' : 'member',
          date_joined: user.date_joined,
          timezone: user.timezone,
          avatar_url: user.avatar_url
        }))
      }, null, 2));
    } catch (error) {
      return createErrorResponse(`Error listing users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

server.tool(
  "get-user-by-email",
  "📧 EXACT LOOKUP: Find a user when you have their exact email address. Use this when you know the specific email and need detailed profile information. Returns single user with complete details.",
  GetUserByEmailSchema.shape,
  async ({ email, client_gravatar, include_custom_profile_fields }) => {
    try {
      const result = await zulipClient.getUserByEmail(email, {
        client_gravatar,
        include_custom_profile_fields
      });
      
      return createSuccessResponse(JSON.stringify({
        user: {
          id: result.user.user_id,
          email: result.user.email,
          full_name: result.user.full_name,
          is_active: result.user.is_active,
          is_bot: result.user.is_bot,
          role: result.user.is_owner ? 'owner' : 
                result.user.is_admin ? 'admin' : 
                result.user.is_moderator ? 'moderator' : 
                result.user.is_guest ? 'guest' : 'member',
          date_joined: result.user.date_joined,
          timezone: result.user.timezone,
          avatar_url: result.user.avatar_url,
          profile_data: result.user.profile_data
        }
      }, null, 2));
    } catch (error) {
      return createErrorResponse(`Error getting user by email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

server.tool(
  "get-topics-in-stream",
  "💬 STREAM TOPICS: Get all recent topics (conversation threads) in a specific stream (channel). Use this to browse what's being discussed in a stream.",
  GetStreamTopicsSchema.shape,
  async ({ stream_id }) => {
    try {
      const result = await zulipClient.getStreamTopics(stream_id);
      
      return createSuccessResponse(JSON.stringify({
        stream_id,
        topic_count: result.topics.length,
        topics: result.topics.map(topic => ({
          name: topic.name,
          max_id: topic.max_id
        }))
      }, null, 2));
    } catch (error) {
      return createErrorResponse(`Error getting stream topics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

server.tool(
  "get-message-read-receipts",
  "Get list of users who have read a specific message.",
  GetMessageReadReceiptsSchema.shape,
  async ({ message_id }) => {
    try {
      const result = await zulipClient.getMessageReadReceipts(message_id);
      return createSuccessResponse(JSON.stringify({
        message_id,
        read_by_count: result.user_ids.length,
        user_ids: result.user_ids
      }, null, 2));
    } catch (error) {
      return createErrorResponse(`Error getting read receipts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

server.tool(
  "get-subscribed-streams",
  "📺 USER STREAMS: Get all streams you're subscribed to. Use this to see what streams are available before sending messages. Note: In Zulip, 'streams' and 'channels' refer to the same thing - conversation spaces for teams.",
  GetSubscribedStreamsSchema.shape,
  async ({ include_subscribers }) => {
    try {
      const result = await zulipClient.getSubscriptions(include_subscribers);
      return createSuccessResponse(JSON.stringify({
        subscription_count: result.subscriptions.length,
        subscriptions: result.subscriptions.map(stream => ({
          id: stream.stream_id,
          name: stream.name,
          description: stream.description,
          invite_only: stream.invite_only,
          is_archived: stream.is_archived,
          is_announcement_only: stream.is_announcement_only
        }))
      }, null, 2));
    } catch (error) {
      return createErrorResponse(`Error getting subscribed streams: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

server.tool(
  "get-stream-id",
  "🔢 STREAM ID LOOKUP: Get the numeric ID of a stream (channel) when you know its name. Use this to get the stream ID needed for other operations.",
  GetStreamIdSchema.shape,
  async ({ stream_name }) => {
    try {
      const result = await zulipClient.getStreamId(stream_name);
      return createSuccessResponse(JSON.stringify({
        stream_name,
        stream_id: result.stream_id
      }, null, 2));
    } catch (error) {
      return createErrorResponse(`Error getting stream ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

server.tool(
  "get-stream-by-id",
  "📊 STREAM DETAILS: Get comprehensive information about a stream (channel) when you have its numeric ID. Returns stream settings, description, subscriber count, etc.",
  GetStreamByIdSchema.shape,
  async ({ stream_id, include_subscribers }) => {
    try {
      const result = await zulipClient.getStream(stream_id, include_subscribers);
      return createSuccessResponse(JSON.stringify({
        stream: {
          id: result.stream.stream_id,
          name: result.stream.name,
          description: result.stream.description,
          invite_only: result.stream.invite_only,
          is_web_public: result.stream.is_web_public,
          is_archived: result.stream.is_archived,
          is_announcement_only: result.stream.is_announcement_only,
          date_created: new Date(result.stream.date_created * 1000).toISOString()
        }
      }, null, 2));
    } catch (error) {
      return createErrorResponse(`Error getting stream by ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

server.tool(
  "get-user",
  "🆔 DETAILED LOOKUP: Get comprehensive user profile when you have their user ID (from search-users results). Returns complete user information including role, timezone, avatar, and custom profile fields.",
  GetUserSchema.shape,
  async ({ user_id, client_gravatar, include_custom_profile_fields }) => {
    try {
      const result = await zulipClient.getUser(user_id, {
        client_gravatar,
        include_custom_profile_fields
      });
      
      return createSuccessResponse(JSON.stringify({
        user: {
          id: result.user.user_id,
          email: result.user.email,
          full_name: result.user.full_name,
          is_active: result.user.is_active,
          is_bot: result.user.is_bot,
          role: result.user.is_owner ? 'owner' : 
                result.user.is_admin ? 'admin' : 
                result.user.is_moderator ? 'moderator' : 
                result.user.is_guest ? 'guest' : 'member',
          date_joined: result.user.date_joined,
          timezone: result.user.timezone,
          avatar_url: result.user.avatar_url,
          profile_data: result.user.profile_data
        }
      }, null, 2));
    } catch (error) {
      return createErrorResponse(`Error getting user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

server.tool(
  "get-message",
  "🔍 SINGLE MESSAGE: Get complete details about one specific message when you have its ID. Use this for in-depth analysis, checking edit history, reactions, or metadata. Returns single message with full details.",
  GetMessageSchema.shape,
  async ({ message_id, apply_markdown, allow_empty_topic_name }) => {
    try {
      const result = await zulipClient.getMessage(message_id, {
        apply_markdown,
        allow_empty_topic_name
      });
      
      return createSuccessResponse(JSON.stringify({
        message: {
          id: result.message.id,
          sender: result.message.sender_full_name,
          timestamp: new Date(result.message.timestamp * 1000).toISOString(),
          content: result.message.content,
          type: result.message.type,
          topic: result.message.topic || result.message.subject,
          stream_id: result.message.stream_id,
          reactions: result.message.reactions,
          edit_history: result.message.edit_history
        }
      }, null, 2));
    } catch (error) {
      return createErrorResponse(`Error getting message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

server.tool(
  "get-user-groups",
  "Get all user groups in the organization.",
  {},
  async () => {
    try {
      const result = await zulipClient.getUserGroups();
      return createSuccessResponse(JSON.stringify({
        group_count: result.user_groups.length,
        user_groups: result.user_groups.map(group => ({
          id: group.id,
          name: group.name,
          description: group.description,
          member_count: group.members.length,
          is_system_group: group.is_system_group
        }))
      }, null, 2));
    } catch (error) {
      return createErrorResponse(`Error getting user groups: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Use stderr for logging to avoid interfering with stdio transport
  console.error("Zulip MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});