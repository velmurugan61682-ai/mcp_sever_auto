import { ProviderAdapter } from '../ProviderAdapter.js';

export class HubSpotAdapter extends ProviderAdapter {
  constructor(options = {}) {
    super({ name: 'HubSpot', workspaceId: options.workspaceId, credentials: options });
    this.accessToken = options.accessToken !== undefined ? options.accessToken : process.env.HUBSPOT_ACCESS_TOKEN;
    this.status = this.accessToken ? 'connected' : 'not_connected';
  }

  async healthCheck() {
    if (!this.accessToken) {
      this.status = 'not_connected';
      return { status: 'not_connected', reason: 'HubSpot access token missing' };
    }
    this.status = 'connected';
    return { status: 'connected' };
  }

  async syncContacts(contacts = []) {
    if (!this.accessToken) throw new Error('HubSpot access token missing');
    return { syncedCount: contacts.length, timestamp: new Date().toISOString() };
  }
}

export default HubSpotAdapter;
