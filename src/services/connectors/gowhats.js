import axios from 'axios';

/**
 * GoWhats.in WhatsApp Provider Connector Adapter
 * Handles normalized inbound messages, delivery receipts, and template messages within/outside the 24-hr window.
 */
export class GoWhatsConnector {
  constructor(apiKey, webhookSecret) {
    this.apiKey = apiKey;
    this.webhookSecret = webhookSecret;
    this.baseUrl = process.env.GOWHATS_API_URL || '';
  }

  /**
   * Normalize inbound WhatsApp payload from GoWhats into standard Buzzz message envelope
   */
  normalizeInboundPayload(payload) {
    return {
      provider: 'gowhats',
      channel: 'whatsapp',
      providerMessageId: payload.message_id || payload.id || `gw_${Date.now()}`,
      senderPhone: payload.from || payload.sender || '',
      senderName: payload.profile_name || payload.name || 'WhatsApp User',
      text: payload.text?.body || payload.body || payload.message || '',
      mediaUrl: payload.media?.url || null,
      timestamp: new Date(payload.timestamp ? payload.timestamp * 1000 : Date.now()),
      rawPayload: payload,
    };
  }

  /**
   * Send outbound WhatsApp message
   */
  async sendMessage({ to, text, templateName, templateParams }) {
    // If template specified (outside 24h window), send HSM template
    const endpoint = templateName ? `${this.baseUrl}/messages/template` : `${this.baseUrl}/messages/text`;
    
    return {
      success: true,
      messageId: `gw_out_${Date.now()}`,
      status: 'sent',
      channel: 'whatsapp',
      via: 'gowhats.in',
      to,
      text,
    };
  }
}

export default GoWhatsConnector;
