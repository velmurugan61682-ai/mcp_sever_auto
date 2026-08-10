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
    { appId: 'tiktok', appName: 'TikTok', description: 'TikTok Content & Analytics Integration' },
    { appId: 'mongoose', appName: 'mongoose', description: 'MongoDB Direct Model Inspector & Data Query Engine' },
    { appId: 'custom_rest', appName: 'Custom REST API', description: 'Generic REST API Endpoints Connector' },
    { appId: 'custom_mcp', appName: 'Custom MCP Server', description: 'Built-in & Remote MCP Tools Connector' }
  ];

  const resultApps = defaultAppsList.map((app) => {
    const found = connections.find((c) => c.appId === app.appId);
    return {
      appId: app.appId,
      appName: app.appName,
      description: app.description,
      status: found ? found.status : (app.appId === 'mongoose' || app.appId === 'custom_mcp' ? 'connected' : 'disconnected'),
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
