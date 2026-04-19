import axios, { AxiosInstance } from 'axios';
import { 
  ZulipConfig, 
  ZulipMessage, 
  ZulipStream, 
  ZulipUser, 
  ZulipUserGroup, 
  ZulipTopic,
  ZulipScheduledMessage,
  ZulipDraft
} from '../types.js';

/**
 * Debug logging utility - only logs in development.
 * Writes to stderr so it does not corrupt the stdio MCP transport on stdout.
 */
function debugLog(message: string, ...args: any[]) {
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
    console.error(message, ...args);
  }
}

export class ZulipClient {
  private client: AxiosInstance;
  private config: ZulipConfig;

  constructor(config: ZulipConfig) {
    this.config = config;

    let parsed: URL;
    try {
      parsed = new URL(config.url);
    } catch {
      throw new Error(`ZULIP_URL is not a valid URL: ${config.url}`);
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error(`ZULIP_URL must be http(s): got ${parsed.protocol}`);
    }
    if (parsed.protocol === 'http:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
      throw new Error(`ZULIP_URL uses http:// for non-local host ${parsed.hostname} — refusing to send Basic auth in the clear.`);
    }

    this.client = axios.create({
      baseURL: `${config.url}/api/v1`,
      auth: {
        username: config.email,
        password: config.apiKey
      },
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ZulipMCPServer/1.0.0'
      },
      timeout: 30000,
      maxRedirects: 0,
      maxContentLength: 50 * 1024 * 1024,
      maxBodyLength: 50 * 1024 * 1024
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          const { status, data } = error.response;
          const message = data.msg || data.message || 'Unknown error';
          
          // Provide helpful hints for common errors
          if (message.includes('No such user')) {
            throw new Error(`User not found: ${message}. Use the 'search-users' tool to find the correct email address.`);
          }
          if (message.includes('Stream does not exist') || message.includes('Invalid stream')) {
            throw new Error(`Channel not found: ${message}. Use 'get-subscribed-channels' to see available channels and check exact spelling.`);
          }
          if (message.includes('Invalid email')) {
            throw new Error(`Invalid email format: ${message}. Use actual email addresses from 'search-users' tool, not display names.`);
          }
          if (message.includes('Message not found') || message.includes('Invalid message')) {
            throw new Error(`Message not found: ${message}. The message may have been deleted or you may not have access to it.`);
          }
          
          throw new Error(`Zulip API Error (${status}): ${message}`);
        } else if (error.request) {
          throw new Error(`Network Error: Unable to reach Zulip server at ${config.url}. Check your ZULIP_URL environment variable.`);
        } else {
          throw new Error(`Request Error: ${error.message}`);
        }
      }
    );
  }

  // Message Operations
  async sendMessage(params: {
    type: 'stream' | 'direct';
    to: string;
    content: string;
    topic?: string;
  }): Promise<{ id: number }> {
    if (process.env.NODE_ENV === 'development') {
      debugLog('🔍 Debug - sendMessage called with:', JSON.stringify(params, null, 2));
    }
    
    // Use the type directly - newer API supports "direct" 
    const payload: any = {
      type: params.type,
      content: params.content
    };

    // Handle recipients based on message type
    if (params.type === 'direct') {
      // For direct messages, handle both single and multiple recipients
      const recipients = params.to.includes(',') 
        ? params.to.split(',').map(email => email.trim())
        : [params.to.trim()];
      
      // Try both formats to see which works
      payload.to = recipients;  // Array format first
      debugLog('🔍 Debug - Direct message recipients:', recipients);
    } else {
      // For stream messages, 'to' is the stream name
      payload.to = params.to;
      if (params.topic) {
        payload.topic = params.topic;
      }
    }

    debugLog('🔍 Debug - Final payload:', JSON.stringify(payload, null, 2));

    try {
      // Try JSON first (modern API)
      const response = await this.client.post('/messages', payload);
      debugLog('✅ Debug - Message sent successfully:', response.data);
      return response.data;
    } catch (jsonError) {
      debugLog('⚠️ Debug - JSON request failed, trying form-encoded...');
      if (jsonError instanceof Error) {
        debugLog('Error:', (jsonError as any).response?.data || jsonError.message);
      }
      
      // Fallback to form-encoded with different recipient format
      const formPayload = { ...payload };
      if (params.type === 'direct') {
        // Try JSON string format for recipients
        const recipients = params.to.includes(',') 
          ? params.to.split(',').map(email => email.trim())
          : [params.to.trim()];
        formPayload.to = JSON.stringify(recipients);
      }
      
      debugLog('🔍 Debug - Form payload:', JSON.stringify(formPayload, null, 2));
      
      const response = await this.client.post('/messages', formPayload, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        transformRequest: [(data) => {
          const params = new URLSearchParams();
          for (const key in data) {
            if (data[key] !== undefined) {
              params.append(key, String(data[key]));
            }
          }
          const formString = params.toString();
          debugLog('🔍 Debug - Form-encoded string:', formString);
          return formString;
        }]
      });
      
      debugLog('✅ Debug - Form-encoded message sent successfully:', response.data);
      return response.data;
    }
  }

  async getMessages(params: {
    anchor?: number | string;
    num_before?: number;
    num_after?: number;
    narrow?: string[][];
    message_id?: number;
  } = {}): Promise<{ messages: ZulipMessage[] }> {
    if (params.message_id) {
      const response = await this.client.get(`/messages/${params.message_id}`);
      return { messages: [response.data.message] };
    }

    const queryParams: any = {};
    
    // Only set parameters that are provided, with appropriate defaults
    queryParams.anchor = params.anchor !== undefined ? params.anchor : 'newest';
    queryParams.num_before = params.num_before !== undefined ? params.num_before : 20;
    queryParams.num_after = params.num_after !== undefined ? params.num_after : 0;

    if (params.narrow) {
      queryParams.narrow = JSON.stringify(params.narrow);
    }

    const response = await this.client.get('/messages', { params: queryParams });
    return response.data;
  }

  async updateMessage(messageId: number, params: {
    content?: string;
    topic?: string;
  }): Promise<void> {
    // Filter out undefined values
    const filteredParams = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined)
    );
    await this.client.patch(`/messages/${messageId}`, filteredParams);
  }

  async deleteMessage(messageId: number): Promise<void> {
    await this.client.delete(`/messages/${messageId}`);
  }

  async addReaction(messageId: number, params: {
    emoji_name: string;
    emoji_code?: string;
    reaction_type?: string;
  }): Promise<void> {
    const payload: any = {
      emoji_name: params.emoji_name,
      reaction_type: params.reaction_type || 'unicode_emoji'
    };
    if (params.emoji_code !== undefined) {
      payload.emoji_code = params.emoji_code;
    }
    await this.client.post(`/messages/${messageId}/reactions`, payload);
  }

  async removeReaction(messageId: number, params: {
    emoji_name: string;
    emoji_code?: string;
    reaction_type?: string;
  }): Promise<void> {
    const queryParams = new URLSearchParams();
    queryParams.append('emoji_name', params.emoji_name);
    if (params.emoji_code) {queryParams.append('emoji_code', params.emoji_code);}
    if (params.reaction_type) {queryParams.append('reaction_type', params.reaction_type);}
    
    await this.client.delete(`/messages/${messageId}/reactions?${queryParams.toString()}`);
  }

  async getMessageReadReceipts(messageId: number): Promise<{ user_ids: number[] }> {
    const response = await this.client.get(`/messages/${messageId}/read_receipts`);
    return response.data;
  }

  // File Operations
  async uploadFile(filename: string, content: string, contentType?: string): Promise<{ uri: string }> {
    // Convert base64 to buffer
    const buffer = Buffer.from(content, 'base64');
    
    const formData = new FormData();
    const blob = new Blob([buffer], { type: contentType });
    formData.append('file', blob, filename);

    const response = await this.client.post('/user_uploads', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }

  // Scheduled Messages
  async createScheduledMessage(params: {
    type: 'stream' | 'direct';
    to: string;
    content: string;
    topic?: string;
    scheduled_delivery_timestamp: number;
  }): Promise<{ scheduled_message_id: number }> {
    // Convert our types to Zulip API types
    const zulipType = params.type === 'direct' ? 'private' : 'stream';
    
    const payload: any = {
      type: zulipType,
      content: params.content,
      scheduled_delivery_timestamp: params.scheduled_delivery_timestamp
    };

    // Handle recipients based on message type
    if (params.type === 'direct') {
      // For private messages, 'to' should be JSON array of user emails/IDs
      const recipients = params.to.split(',').map(email => email.trim());
      payload.to = JSON.stringify(recipients);
    } else {
      // For stream messages, 'to' is the stream name
      payload.to = params.to;
      if (params.topic) {
        payload.topic = params.topic;
      }
    }

    const response = await this.client.post('/scheduled_messages', payload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      transformRequest: [(data) => {
        const params = new URLSearchParams();
        for (const key in data) {
          if (data[key] !== undefined) {
            params.append(key, String(data[key]));
          }
        }
        return params.toString();  // Return string, not URLSearchParams object
      }]
    });
    return response.data;
  }

  async editScheduledMessage(scheduledMessageId: number, params: {
    type?: 'stream' | 'direct';
    to?: string;
    content?: string;
    topic?: string;
    scheduled_delivery_timestamp?: number;
  }): Promise<void> {
    // Filter out undefined values
    const filteredParams = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined)
    );
    await this.client.patch(`/scheduled_messages/${scheduledMessageId}`, filteredParams);
  }

  async getScheduledMessages(): Promise<{ scheduled_messages: ZulipScheduledMessage[] }> {
    const response = await this.client.get('/scheduled_messages');
    return response.data;
  }

  // Drafts
  async getDrafts(): Promise<{ drafts: ZulipDraft[] }> {
    const response = await this.client.get('/drafts');
    return response.data;
  }

  async editDraft(draftId: number, params: {
    type: 'stream' | 'direct';
    to: number[];
    topic: string;
    content: string;
    timestamp?: number;
  }): Promise<void> {
    await this.client.patch(`/drafts/${draftId}`, params);
  }

  // Stream Operations
  async getSubscriptions(includeSubscribers?: boolean): Promise<{ subscriptions: ZulipStream[] }> {
    const params = includeSubscribers ? { include_subscribers: true } : {};
    const response = await this.client.get('/users/me/subscriptions', { params });
    return response.data;
  }

  async getAllStreams(params: {
    include_public?: boolean;
    include_subscribed?: boolean;
    include_all_active?: boolean;
    include_archived?: boolean;
  } = {}): Promise<{ streams: ZulipStream[] }> {
    const queryParams: any = {
      include_public: params.include_public ?? true,
      include_subscribed: params.include_subscribed ?? true,
      include_all_active: params.include_all_active ?? false,
      include_archived: params.include_archived ?? false
    };
    
    const response = await this.client.get('/streams', { params: queryParams });
    return response.data;
  }

  async getStreamId(streamName: string): Promise<{ stream_id: number }> {
    const response = await this.client.get('/get_stream_id', {
      params: { stream: streamName }
    });
    return response.data;
  }

  async getStream(streamId: number, includeSubscribers?: boolean): Promise<{ stream: ZulipStream }> {
    const params = includeSubscribers ? { include_subscribers: true } : {};
    const response = await this.client.get(`/streams/${streamId}`, { params });
    return response.data;
  }

  async getStreamTopics(streamId: number): Promise<{ topics: ZulipTopic[] }> {
    const response = await this.client.get(`/users/me/${streamId}/topics`);
    return response.data;
  }

  // User Operations
  async getUsers(params: {
    client_gravatar?: boolean;
    include_custom_profile_fields?: boolean;
  } = {}): Promise<{ members: ZulipUser[] }> {
    // Filter out undefined values
    const filteredParams = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined)
    );
    const response = await this.client.get('/users', { params: filteredParams });
    return response.data;
  }

  async getUserByEmail(email: string, params: {
    client_gravatar?: boolean;
    include_custom_profile_fields?: boolean;
  } = {}): Promise<{ user: ZulipUser }> {
    // Filter out undefined values
    const filteredParams = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined)
    );
    const response = await this.client.get(`/users/${encodeURIComponent(email)}`, { params: filteredParams });
    return response.data;
  }

  async updateStatus(params: {
    status_text?: string;
    away?: boolean;
    emoji_name?: string;
    emoji_code?: string;
    reaction_type?: string;
  }): Promise<void> {
    // Filter out undefined values and empty strings
    const filteredParams: any = {};
    if (params.status_text !== undefined && params.status_text !== null) {
      filteredParams.status_text = params.status_text;
    }
    if (params.away !== undefined) {filteredParams.away = params.away;}
    if (params.emoji_name !== undefined && params.emoji_name !== '') {
      filteredParams.emoji_name = params.emoji_name;
    }
    if (params.emoji_code !== undefined && params.emoji_code !== '') {
      filteredParams.emoji_code = params.emoji_code;
    }
    if (params.reaction_type !== undefined && params.reaction_type !== '') {
      filteredParams.reaction_type = params.reaction_type;
    }
    
    debugLog('🔍 Debug - updateStatus filtered params:', JSON.stringify(filteredParams, null, 2));
    
    // Zulip expects form-encoded data for this endpoint
    const response = await this.client.post('/users/me/status', filteredParams, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      transformRequest: [(data) => {
        const params = new URLSearchParams();
        Object.keys(data).forEach(key => {
          params.append(key, data[key]);
        });
        const formString = params.toString();
        debugLog('🔍 Debug - Form-encoded status update:', formString);
        return formString;
      }]
    });
    
    debugLog('✅ Debug - Status updated successfully:', response.data);
  }

  async getUserGroups(): Promise<{ user_groups: ZulipUserGroup[] }> {
    const response = await this.client.get('/user_groups');
    return response.data;
  }

  // Organization Operations
  async getServerSettings(): Promise<any> {
    const response = await this.client.get('/server_settings');
    return response.data;
  }

  async getRealmInfo(): Promise<any> {
    const response = await this.client.get('/realm');
    return response.data;
  }

  async getCustomEmoji(): Promise<any> {
    const response = await this.client.get('/realm/emoji');
    return response.data;
  }

  // New API Methods
  async createDraft(params: {
    type: 'stream' | 'private';
    to: number[];
    topic: string;
    content: string;
    timestamp?: number;
  }): Promise<{ ids: number[] }> {
    const draftObject: any = {
      type: params.type,
      to: params.to,
      topic: params.topic,
      content: params.content
    };
    
    // Only include timestamp if provided, otherwise let server set it
    if (params.timestamp !== undefined) {
      draftObject.timestamp = params.timestamp;
    }
    
    const payload = [draftObject];
    
    const response = await this.client.post('/drafts', {}, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      transformRequest: [() => {
        const params = new URLSearchParams();
        params.append('drafts', JSON.stringify(payload));
        return params.toString();
      }]
    });
    
    return response.data;
  }

  async getUser(userId: number, params: {
    client_gravatar?: boolean;
    include_custom_profile_fields?: boolean;
  } = {}): Promise<{ user: ZulipUser }> {
    debugLog('🔍 Debug - getUser called with:', { userId, ...params });
    
    const response = await this.client.get(`/users/${userId}`, { params });
    debugLog('✅ Debug - User retrieved successfully:', response.data);
    return response.data;
  }

  async getMessage(messageId: number, params: {
    apply_markdown?: boolean;
    allow_empty_topic_name?: boolean;
  } = {}): Promise<{ message: ZulipMessage }> {
    debugLog('🔍 Debug - getMessage called with:', { messageId, ...params });
    
    const response = await this.client.get(`/messages/${messageId}`, { params });
    debugLog('✅ Debug - Message retrieved successfully:', response.data);
    return response.data;
  }
}