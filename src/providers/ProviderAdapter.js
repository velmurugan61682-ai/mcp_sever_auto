/**
 * Standardized ProviderAdapter interface for all Buzzz integrations.
 * Mental model: App store plugin pattern.
 */
export class ProviderAdapter {
  constructor(config = {}) {
    this.name = config.name || 'GenericProvider';
    this.workspaceId = config.workspaceId;
    this.credentials = config.credentials || {};
    this.status = 'not_connected'; // connected | error | token_expired | syncing | paused | not_connected
  }

  async connect(credentials) {
    throw new Error(`connect() not implemented for ${this.name}`);
  }

  async healthCheck() {
    throw new Error(`healthCheck() not implemented for ${this.name}`);
  }

  async disconnect() {
    this.status = 'not_connected';
    return { success: true, name: this.name, status: this.status };
  }

  getStatus() {
    return {
      name: this.name,
      workspaceId: this.workspaceId,
      status: this.status,
      lastChecked: new Date().toISOString()
    };
  }
}

export default ProviderAdapter;
