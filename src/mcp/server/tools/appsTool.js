import { z } from 'zod';
import { AppConnection } from '../../../models/AppConnection.js';

export const listConnectedAppsToolDefinition = {
  name: 'list_connected_apps',
  description: 'Returns all external apps connected by the authenticated user.',
  inputSchema: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'User ID context (automatically provided)' }
    }
  }
};

export const listAppsInputSchema = z.object({
  userId: z.string().optional()
});

export const executeListConnectedApps = async (args, contextUserId) => {
  const { userId } = listAppsInputSchema.parse(args || {});
  const targetUserId = userId || contextUserId;

  let connections = [];
  try {
    const filter = {};
    if (targetUserId) {
      filter.user = targetUserId;
    }
    connections = await AppConnection.find(filter);
  } catch (err) {
    console.warn('[executeListConnectedApps] DB query fallback:', err.message);
  }

  const defaultAppsList = [
    { appId: 'gmail', appName: 'Gmail', description: 'Read email threads, draft replies, and search inbox' },
    { appId: 'slack', appName: 'Slack', description: 'Interact with channels and send messages' },
    { appId: 'github', appName: 'GitHub', description: 'Inspect repositories, issues, and pull requests' },
    { appId: 'linkedin', appName: 'LinkedIn', description: 'Professional networking integration' },
    { appId: 'whatsapp', appName: 'WhatsApp', description: 'Automate WhatsApp conversations' },
    { appId: 'custom_rest', appName: 'Custom REST API', description: 'Generic REST API Endpoints Connector' },
    { appId: 'custom_mcp', appName: 'Custom MCP Server', description: 'Built-in & Remote MCP Tools Connector' }
  ];

  const resultApps = defaultAppsList.map((app) => {
    const found = connections.find((c) => c.appId === app.appId);
    return {
      appId: app.appId,
      appName: app.appName,
      description: app.description,
      status: found ? found.status : 'disconnected',
      lastSync: found ? found.lastSync : null,
      permissions: found ? found.permissions : ['read', 'execute']
    };
  });

  return {
    success: true,
    count: resultApps.length,
    apps: resultApps
  };
};
