import { z } from "zod";

// Zulip API Types
export interface ZulipConfig {
  url: string;
  email: string;
  apiKey: string;
}

export interface ZulipMessage {
  id: number;
  sender_id: number;
  sender_full_name: string;
  sender_email: string;
  timestamp: number;
  content: string;
  content_type: string;
  stream_id?: number;
  subject?: string;
  topic?: string;
  type: "stream" | "private";
  recipient_id: number;
  reactions: ZulipReaction[];
  edit_history?: ZulipEditHistory[];
}

export interface ZulipReaction {
  emoji_name: string;
  emoji_code: string;
  reaction_type: string;
  user_id: number;
}

export interface ZulipEditHistory {
  prev_content: string;
  prev_rendered_content: string;
  timestamp: number;
  user_id: number;
}

export interface ZulipStream {
  stream_id: number;
  name: string;
  description: string;
  invite_only: boolean;
  is_web_public: boolean;
  is_archived: boolean;
  creator_id: number;
  date_created: number;
  first_message_id: number;
  message_retention_days: number | null;
  history_public_to_subscribers: boolean;
  rendered_description: string;
  is_announcement_only: boolean;
  can_remove_subscribers_group: number;
  stream_post_policy: number;
}

export interface ZulipUser {
  user_id: number;
  email: string;
  full_name: string;
  date_joined: string;
  is_active: boolean;
  is_owner: boolean;
  is_admin: boolean;
  is_moderator: boolean;
  is_guest: boolean;
  is_bot: boolean;
  bot_type: number | null;
  timezone: string;
  avatar_url: string;
  delivery_email: string;
  profile_data: Record<string, any>;
}

export interface ZulipUserGroup {
  id: number;
  name: string;
  description: string;
  members: number[];
  direct_subgroup_ids: number[];
  is_system_group: boolean;
  can_manage_group: number;
  can_mention_group: number;
}

export interface ZulipTopic {
  name: string;
  max_id: number;
}

export interface ZulipScheduledMessage {
  scheduled_message_id: number;
  type: "stream" | "private";
  to: string | number[];
  content: string;
  topic?: string;
  scheduled_delivery_timestamp: number;
  failed: boolean;
}

export interface ZulipDraft {
  id: number;
  type: "stream" | "private";
  to: number[];
  topic: string;
  content: string;
  timestamp: number;
}

// MCP Tool Schemas
export const SearchUsersSchema = z.object({
  query: z.string().describe("Name, email, or partial match to search for users"),
  limit: z.number().default(10).describe("Maximum number of results to return (default: 10)")
});

export const SendMessageSchema = z.object({
  type: z.enum(["stream", "direct"]).describe("'stream' for channel messages, 'direct' for private messages"),
  to: z.string().describe("For streams: channel name (e.g., 'general'). For direct: comma-separated user emails (e.g., 'user@example.com' or 'user1@example.com,user2@example.com')"),
  content: z.string().describe("Message content using Zulip Markdown syntax. Support mentions (@**Name**), code blocks, links, etc."),
  topic: z.string().optional().describe("Topic name for stream messages (required for streams, max length varies by server)")
});

export const GetMessagesSchema = z.object({
  anchor: z.union([z.number(), z.enum(["newest", "oldest", "first_unread"])]).optional().describe("Starting point: message ID, 'newest', 'oldest', or 'first_unread'"),
  num_before: z.number().max(1000).optional().describe("Number of messages before anchor (max 1000)"),
  num_after: z.number().max(1000).optional().describe("Number of messages after anchor (max 1000)"),
  narrow: z.array(z.array(z.string())).optional().describe("Filters: [['stream', 'channel-name'], ['topic', 'topic-name'], ['sender', 'email'], ['search', 'query']]"),
  message_id: z.number().optional().describe("Get specific message by ID instead of using anchor/num parameters")
});

export const UploadFileSchema = z.object({
  filename: z.string().describe("Name of the file including extension (e.g., 'document.pdf', 'image.png')"),
  content: z.string().describe("Base64 encoded file content"),
  content_type: z.string().optional().describe("MIME type (e.g., 'image/png', 'application/pdf'). Auto-detected if not provided")
});

export const EditMessageSchema = z.object({
  message_id: z.number().describe("Unique ID of the message to edit"),
  content: z.string().optional().describe("New message content with Markdown formatting"),
  topic: z.string().optional().describe("New topic name (for stream messages only)")
});

export const AddReactionSchema = z.object({
  message_id: z.number().describe("ID of the message to react to"),
  emoji_name: z.string().describe("Emoji name (e.g., 'thumbs_up', 'heart', 'rocket') or custom emoji name"),
  emoji_code: z.string().optional().describe("Unicode code point for the emoji"),
  reaction_type: z.enum(["unicode_emoji", "realm_emoji", "zulip_extra_emoji"]).optional().describe("Type of emoji reaction")
});

export const CreateScheduledMessageSchema = z.object({
  type: z.enum(["stream", "direct"]).describe("Message type: 'stream' for channels, 'direct' for private messages"),
  to: z.string().describe("For streams: channel name (e.g., 'general'). For direct: comma-separated user emails (e.g., 'user@example.com,user2@example.com')"),
  content: z.string().describe("Message content with Markdown formatting"),
  topic: z.string().optional().describe("Topic for stream messages"),
  scheduled_delivery_timestamp: z.number().describe("Unix timestamp when message should be sent (seconds since epoch)")
});

export const GetUserByEmailSchema = z.object({
  email: z.string().email().describe("Email address of the user to look up"),
  client_gravatar: z.boolean().optional().describe("Include Gravatar profile image URL"),
  include_custom_profile_fields: z.boolean().optional().describe("Include organization-specific custom profile fields")
});

export const UpdateStatusSchema = z.object({
  status_text: z.string().max(60).optional().describe("Status message text (max 60 chars, empty string clears status)"),
  away: z.boolean().optional().describe("Set away status (deprecated in Zulip 6.0, will be removed)"),
  emoji_name: z.string().optional().describe("Emoji name: for unicode use short name (e.g., 'coffee', 'airplane'), for realm_emoji use custom name, for zulip_extra use special names like 'zulip'"),
  emoji_code: z.string().optional().describe("Emoji identifier: for unicode_emoji use codepoint (e.g., '2615' for coffee), for realm_emoji use custom emoji ID, for zulip_extra use emoji ID"),
  reaction_type: z.enum(["unicode_emoji", "realm_emoji", "zulip_extra_emoji"]).optional().describe("Emoji type: 'unicode_emoji' for standard emojis (default), 'realm_emoji' for organization custom emojis, 'zulip_extra_emoji' for special Zulip emojis")
});

export const CreateDraftSchema = z.object({
  type: z.enum(["stream", "private"]).describe("Draft message type: 'stream' for channels, 'private' for direct messages"),
  to: z.array(z.number()).describe("Array of user IDs for private messages, or single channel ID for stream messages"),
  topic: z.string().describe("Topic for stream messages (required even for private messages in API)"),
  content: z.string().describe("Draft message content with Markdown formatting"),
  timestamp: z.number().optional().describe("Unix timestamp for draft creation (optional, defaults to current time)")
});

export const GetUserSchema = z.object({
  user_id: z.number().describe("Unique user ID to retrieve information for"),
  client_gravatar: z.boolean().optional().describe("Include Gravatar URL (default: true)"),
  include_custom_profile_fields: z.boolean().optional().describe("Include custom profile fields (default: false)")
});

export const GetMessageSchema = z.object({
  message_id: z.number().describe("Unique message ID to retrieve"),
  apply_markdown: z.boolean().optional().describe("Return HTML content (true) or raw Markdown (false). Default: true"),
  allow_empty_topic_name: z.boolean().optional().describe("Allow empty topic names in response (default: false)")
});

export const ListUsersSchema = z.object({
  client_gravatar: z.boolean().optional().describe("Include Gravatar URLs for users (default: true)"),
  include_custom_profile_fields: z.boolean().optional().describe("Include custom profile fields (default: false)")
});

export const ListStreamsSchema = z.object({
  include_public: z.boolean().optional().describe("Include public streams (default: true)"),
  include_subscribed: z.boolean().optional().describe("Include streams user is subscribed to (default: true)"),
  include_all_active: z.boolean().optional().describe("Include all active streams (default: false)"),
  include_archived: z.boolean().optional().describe("Include archived streams (default: false)")
});

export const DeleteMessageSchema = z.object({
  message_id: z.number().describe("Unique ID of the message to delete")
});

export const RemoveReactionSchema = z.object({
  message_id: z.number().describe("ID of the message to remove reaction from"),
  emoji_name: z.string().describe("Emoji name to remove (e.g., 'thumbs_up', 'heart')"),
  emoji_code: z.string().optional().describe("Unicode code point for the emoji"),
  reaction_type: z.enum(["unicode_emoji", "realm_emoji", "zulip_extra_emoji"]).optional().describe("Type of emoji reaction")
});

export const GetStreamTopicsSchema = z.object({
  stream_id: z.number().describe("Unique stream ID to get topics for")
});

export const GetMessageReadReceiptsSchema = z.object({
  message_id: z.number().describe("Unique message ID to get read receipts for")
});

export const EditScheduledMessageSchema = z.object({
  scheduled_message_id: z.number().describe("Unique scheduled message ID to edit"),
  type: z.enum(["stream", "direct"]).optional().describe("Message type"),
  to: z.string().optional().describe("Recipients (channel name or comma-separated emails)"),
  content: z.string().optional().describe("New message content"),
  topic: z.string().optional().describe("New topic for stream messages"),
  scheduled_delivery_timestamp: z.number().optional().describe("New delivery timestamp")
});

export const EditDraftSchema = z.object({
  draft_id: z.number().describe("Unique draft ID to edit"),
  type: z.enum(["stream", "direct"]).describe("Draft message type"),
  to: z.array(z.number()).describe("Array of user IDs or channel ID"),
  topic: z.string().describe("Topic for the draft"),
  content: z.string().describe("Draft content"),
  timestamp: z.number().optional().describe("Updated timestamp")
});

export const GetSubscribedStreamsSchema = z.object({
  include_subscribers: z.boolean().optional().describe("Include subscriber lists for streams")
});

export const GetStreamIdSchema = z.object({
  stream_name: z.string().describe("Name of the stream to get ID for")
});

export const GetStreamByIdSchema = z.object({
  stream_id: z.number().describe("Unique stream ID to get details for"),
  include_subscribers: z.boolean().optional().describe("Include subscriber list")
});

export type SendMessageParams = z.infer<typeof SendMessageSchema>;
export type GetMessagesParams = z.infer<typeof GetMessagesSchema>;
export type UploadFileParams = z.infer<typeof UploadFileSchema>;
export type EditMessageParams = z.infer<typeof EditMessageSchema>;
export type AddReactionParams = z.infer<typeof AddReactionSchema>;
export type CreateScheduledMessageParams = z.infer<typeof CreateScheduledMessageSchema>;
export type GetUserByEmailParams = z.infer<typeof GetUserByEmailSchema>;
export type UpdateStatusParams = z.infer<typeof UpdateStatusSchema>;
export type CreateDraftParams = z.infer<typeof CreateDraftSchema>;
export type GetUserParams = z.infer<typeof GetUserSchema>;
export type GetMessageParams = z.infer<typeof GetMessageSchema>;
export type ListUsersParams = z.infer<typeof ListUsersSchema>;
export type ListStreamsParams = z.infer<typeof ListStreamsSchema>;
export type DeleteMessageParams = z.infer<typeof DeleteMessageSchema>;
export type RemoveReactionParams = z.infer<typeof RemoveReactionSchema>;
export type GetStreamTopicsParams = z.infer<typeof GetStreamTopicsSchema>;
export type GetMessageReadReceiptsParams = z.infer<typeof GetMessageReadReceiptsSchema>;
export type EditScheduledMessageParams = z.infer<typeof EditScheduledMessageSchema>;
export type EditDraftParams = z.infer<typeof EditDraftSchema>;
export type GetSubscribedStreamsParams = z.infer<typeof GetSubscribedStreamsSchema>;
export type GetStreamIdParams = z.infer<typeof GetStreamIdSchema>;
export type GetStreamByIdParams = z.infer<typeof GetStreamByIdSchema>;