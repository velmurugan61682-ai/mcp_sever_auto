import { ProviderAdapter } from '../ProviderAdapter.js';

export class GoogleCalendarAdapter extends ProviderAdapter {
  constructor(options = {}) {
    super({ name: 'Google Calendar', workspaceId: options.workspaceId, credentials: options });
    this.accessToken = options.accessToken !== undefined ? options.accessToken : process.env.GOOGLE_CALENDAR_ACCESS_TOKEN;
    this.status = this.accessToken ? 'connected' : 'not_connected';
  }

  async healthCheck() {
    if (!this.accessToken) {
      this.status = 'not_connected';
      return { status: 'not_connected', reason: 'Google Calendar token missing' };
    }
    this.status = 'connected';
    return { status: 'connected' };
  }

  async createEvent({ summary, startTime, endTime }) {
    if (!this.accessToken) throw new Error('Google Calendar access token missing');
    return { eventId: `gcal_${Date.now()}`, summary, startTime, endTime };
  }
}

export default GoogleCalendarAdapter;
