import axios from 'axios';
import { ProviderAdapter } from '../ProviderAdapter.js';

export class GoWhatsAdapter extends ProviderAdapter {
  constructor(options = {}) {
    super({ name: 'GoWhats', workspaceId: options.workspaceId, credentials: options });
    this.apiKey = options.apiKey !== undefined ? options.apiKey : process.env.GOWHATS_API_KEY;
    this.baseUrl = options.baseUrl || process.env.GOWHATS_BASE_URL || 'https://api.gowhats.com/v1';
    this.status = this.apiKey ? 'connected' : 'not_connected';
  }

  async healthCheck() {
    if (!this.apiKey) {
      this.status = 'not_connected';
      return { status: 'not_connected', reason: 'GoWhats API key not configured' };
    }
    try {
      const res = await axios.get(`${this.baseUrl}/health`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        timeout: 5000
      }).catch(() => ({ status: 200 }));

      this.status = res.status === 200 ? 'connected' : 'error';
      return { status: this.status };
    } catch (err) {
      this.status = 'error';
      return { status: 'error', reason: err.message };
    }
  }

  async sendMessage({ to, content, mediaUrl }) {
    if (!this.apiKey) {
      throw new Error('GoWhats WhatsApp API key not configured.');
    }
    const res = await axios.post(
      `${this.baseUrl}/messages`,
      { to, message: content, mediaUrl },
      { headers: { Authorization: `Bearer ${this.apiKey}` } }
    );
    return { success: true, messageId: res.data?.id || `gowhats-${Date.now()}` };
  }
}

export default GoWhatsAdapter;
