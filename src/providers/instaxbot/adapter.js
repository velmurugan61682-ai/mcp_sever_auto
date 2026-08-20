import axios from 'axios';
import { ProviderAdapter } from '../ProviderAdapter.js';

export class InstaxBotAdapter extends ProviderAdapter {
  constructor(options = {}) {
    super({ name: 'InstaxBot', workspaceId: options.workspaceId, credentials: options });
    this.apiKey = options.apiKey !== undefined ? options.apiKey : process.env.INSTAXBOT_API_KEY;
    this.baseUrl = options.baseUrl || process.env.INSTAXBOT_BASE_URL || 'https://api.instaxbot.com/v1';
    this.status = this.apiKey ? 'connected' : 'not_connected';
  }

  async healthCheck() {
    if (!this.apiKey) {
      this.status = 'not_connected';
      return { status: 'not_connected', reason: 'InstaxBot API key not configured' };
    }
    try {
      this.status = 'connected';
      return { status: 'connected' };
    } catch (err) {
      this.status = 'error';
      return { status: 'error', reason: err.message };
    }
  }

  async sendMessage({ recipientId, content }) {
    if (!this.apiKey) {
      throw new Error('InstaxBot Instagram API key not configured.');
    }
    const res = await axios.post(
      `${this.baseUrl}/direct/message`,
      { recipient_id: recipientId, text: content },
      { headers: { Authorization: `Bearer ${this.apiKey}` } }
    );
    return { success: true, messageId: res.data?.id || `instax-${Date.now()}` };
  }
}

export default InstaxBotAdapter;
