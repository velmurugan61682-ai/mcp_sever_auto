import { ProviderAdapter } from '../ProviderAdapter.js';

export class ShopifyAdapter extends ProviderAdapter {
  constructor(options = {}) {
    super({ name: 'Shopify', workspaceId: options.workspaceId, credentials: options });
    this.shopDomain = options.shopDomain !== undefined ? options.shopDomain : process.env.SHOPIFY_SHOP_DOMAIN;
    this.accessToken = options.accessToken !== undefined ? options.accessToken : process.env.SHOPIFY_ACCESS_TOKEN;
    this.status = this.accessToken ? 'connected' : 'not_connected';
  }

  async healthCheck() {
    if (!this.accessToken || !this.shopDomain) {
      this.status = 'not_connected';
      return { status: 'not_connected', reason: 'Shopify credentials missing' };
    }
    this.status = 'connected';
    return { status: 'connected', shopDomain: this.shopDomain };
  }
}

export default ShopifyAdapter;
