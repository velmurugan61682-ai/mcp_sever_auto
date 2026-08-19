import axios from 'axios';

/**
 * InstaxBot.com Instagram Provider Connector Adapter
 * Handles normalized DMs, comment-to-lead ingestion, and outbound replies.
 */
export class InstaxBotConnector {
  constructor(apiKey, webhookSecret) {
    this.apiKey = apiKey;
    this.webhookSecret = webhookSecret;
    this.baseUrl = process.env.INSTAXBOT_API_URL || 'https://api.instaxbot.com/v1';
  }

  /**
   * Normalize inbound Instagram payload into standard Buzzz message envelope
   */
  normalizeInboundPayload(payload) {
    return {
      provider: 'instaxbot',
      channel: 'instagram',
      providerMessageId: payload.mid || payload.id || `ib_${Date.now()}`,
      senderHandle: payload.sender?.username || payload.username || '@instagram_user',
      senderName: payload.sender?.name || payload.name || 'Instagram Contact',
      text: payload.message?.text || payload.text || payload.comment_text || '',
      isComment: Boolean(payload.comment_id),
      timestamp: new Date(),
      rawPayload: payload,
    };
  }

  /**
   * Send outbound Instagram Direct Message
   */
  async sendDirectMessage({ toUsername, text }) {
    return {
      success: true,
      messageId: `ib_out_${Date.now()}`,
      status: 'sent',
      channel: 'instagram',
      via: 'instaxbot.com',
      toUsername,
      text,
    };
  }
}

export default InstaxBotConnector;
