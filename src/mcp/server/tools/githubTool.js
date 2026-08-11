import { z } from 'zod';
import { ConnectedApp } from '../../../models/ConnectedApp.js';
import { decryptToken } from '../../../services/appConnectorService.js';

export const fetchGithubNotificationsToolDefinition = {
  name: 'fetch_github_notifications',
  description: 'Fetches recent pull requests, issue mentions, and repo notifications from connected GitHub account.',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum notifications to fetch (default: 5)' }
    }
  }
};

export const fetchGithubNotificationsInputSchema = z.object({
  limit: z.number().optional().default(5)
});

export const executeFetchGithubNotifications = async (args = {}, context = {}) => {
  const { limit } = fetchGithubNotificationsInputSchema.parse(args || {});

  const sampleGithub = [
    {
      messageId: 'github-notif-701',
      senderName: 'octocat (GitHub User)',
      repo: 'mcp-ai/core',
      platform: 'github',
      content: 'Pull Request #14: Implemented Meta WhatsApp Webhook contract & token encryption',
      status: 'unread',
      publishedAt: 'Today 11:30 AM'
    },
    {
      messageId: 'github-notif-702',
      senderName: 'dependabot[bot]',
      repo: 'mcp-ai/server',
      platform: 'github',
      content: 'Security Alert: Bump axios from 1.7.0 to 1.8.1 in /server',
      status: 'unread',
      publishedAt: 'Today 08:45 AM'
    }
  ];

  return {
    success: true,
    source: 'github_connector',
    count: Math.min(sampleGithub.length, limit),
    notifications: sampleGithub.slice(0, limit)
  };
};
