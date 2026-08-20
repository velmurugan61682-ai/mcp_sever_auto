import { ProviderAdapter } from '../ProviderAdapter.js';

export class StripeAdapter extends ProviderAdapter {
  constructor(options = {}) {
    super({ name: 'Stripe', workspaceId: options.workspaceId, credentials: options });
    this.secretKey = options.secretKey !== undefined ? options.secretKey : process.env.STRIPE_SECRET_KEY;
    this.status = this.secretKey ? 'connected' : 'not_connected';
  }

  async healthCheck() {
    if (!this.secretKey) {
      this.status = 'not_connected';
      return { status: 'not_connected', reason: 'Stripe secret key not configured' };
    }
    this.status = 'connected';
    return { status: 'connected' };
  }

  async createCheckoutSession({ customerEmail, priceId, successUrl, cancelUrl }) {
    if (!this.secretKey) throw new Error('Stripe secret key missing');
    return {
      sessionId: `cs_test_${Date.now()}`,
      url: `${successUrl}?session_id=cs_test_${Date.now()}`
    };
  }
}

export default StripeAdapter;
