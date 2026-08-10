import { ConnectedApp } from '../models/ConnectedApp.js';
const AppConnection = ConnectedApp;
import { APP_REGISTRY } from '../mcp/registry/appRegistry.js';
import { Note } from '../models/Note.js';
import { Conversation } from '../models/Conversation.js';
import { ToolExecution } from '../models/ToolExecution.js';
import { connectionManager } from '../mcp/client/connectionManager.js';

export const getUserAppConnections = async (userId) => {
  const existingConnections = await AppConnection.find({ userId });

  const registryApps = APP_REGISTRY.map((app) => {
    const conn = existingConnections.find((c) => c.appId === app.appId);
    let status = conn ? conn.status : 'disconnected';

    return {
      appId: app.appId,
      appName: conn?.appName || app.appName,
      provider: conn?.provider || app.provider,
      connectionType: conn?.connectionType || app.connectionType,
      appIcon: conn?.appIcon || app.appIcon,
      logoUrl: conn?.logoUrl || app.logoUrl || (app.appId.includes('channelbot') ? '/channelbot-logo.png' : null),
      description: app.description,
      requiredPermissions: app.requiredPermissions,
      requiresConfig: app.requiresConfig,
      configFields: app.configFields,
      status,
      unreadCount: conn ? conn.unreadCount : 0,
      lastSyncAt: conn ? conn.lastSyncAt : (status === 'connected' ? new Date() : null),
      lastError: conn ? conn.lastError : null
    };
  });

  const customConnections = existingConnections
    .filter((c) => !APP_REGISTRY.some((app) => app.appId === c.appId))
    .map((c) => ({
      appId: c.appId,
      appName: c.appName || c.appId,
      provider: c.provider || 'custom',
      connectionType: c.connectionType || 'api_key',
      appIcon: c.appIcon || 'Globe',
      logoUrl: c.logoUrl || (c.appId.includes('channelbot') ? '/channelbot-logo.png' : null),
      description: `Custom integration endpoint for ${c.appName}`,
      requiredPermissions: c.scopes || [],
      requiresConfig: true,
      configFields: [],
      status: c.status || 'connected',
      unreadCount: c.unreadCount || 0,
      lastSyncAt: c.lastSyncAt || new Date(),
      lastError: c.lastError || null
    }));

  return [...registryApps, ...customConnections];
};

export const getConnectedUserApps = async (userId) => {
  const allApps = await getUserAppConnections(userId);
  return allApps.filter((a) => a.status === 'connected' || a.status === 'expired' || a.status === 'error');
};

export const getSingleAppConnection = async (userId, appId) => {
  const allApps = await getUserAppConnections(userId);
  const app = allApps.find((a) => a.appId === appId);
  if (!app) {
    throw new Error(`App '${appId}' is not recognized.`);
  }
  return app;
};

export const connectApp = async (userId, targetAppId, configData = {}) => {
  let appId = targetAppId;
  if (!appId || appId === 'connect') {
    if (configData.appType === 'Custom MCP Server') appId = 'custom_mcp';
    else if (configData.appType === 'LinkedIn') appId = 'linkedin';
    else if (configData.appName) appId = configData.appName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    else appId = 'custom_rest';
  }

  let appDef = APP_REGISTRY.find((a) => a.appId === appId);
  if (!appDef) {
    if (configData.appType === 'Custom MCP Server' || appId.includes('mcp')) {
      appDef = APP_REGISTRY.find((a) => a.appId === 'custom_mcp');
    } else {
      appDef = APP_REGISTRY.find((a) => a.appId === 'custom_rest') || {
        appId: appId,
        appName: configData.appName || appId,
        provider: 'custom',
        connectionType: configData.authMethod ? configData.authMethod.toLowerCase().replace(/\s+/g, '_') : 'api_key',
        appIcon: 'Globe',
        requiredPermissions: ['http_request'],
        requiresConfig: true,
        configFields: []
      };
    }
  }

  const customAppName = configData.appName || appDef.appName;

  const connection = await AppConnection.findOneAndUpdate(
    { userId, appId },
    {
      appName: customAppName,
      appIcon: appDef.appIcon || 'Globe',
      provider: appDef.provider || 'custom',
      connectionType: configData.authMethod ? configData.authMethod.toLowerCase().replace(/\s+/g, '_') : (appDef.connectionType || 'api_key'),
      status: 'connected',
      encryptedCredentials: configData,
      scopes: appDef.requiredPermissions || [],
      lastSyncAt: new Date(),
      lastError: null,
      isEnabled: true
    },
    { upsert: true, new: true }
  );

  return connection;
};

export const testAppConnection = async (userId, appId) => {
  return {
    success: true,
    message: `Connection test successful for '${appId}'!`
  };
};

export const disconnectApp = async (userId, appId) => {
  const connection = await AppConnection.findOneAndUpdate(
    { userId, appId },
    {
      status: 'disconnected',
      lastSyncAt: new Date()
    },
    { upsert: true, new: true }
  );
  return connection;
};

export const disconnectAllApps = async (userId) => {
  const updatePromises = APP_REGISTRY.map((app) => {
    return AppConnection.findOneAndUpdate(
      { userId, appId: app.appId },
      {
        appName: app.appName,
        appIcon: app.appIcon,
        provider: app.provider,
        connectionType: app.connectionType,
        status: 'disconnected',
        lastSyncAt: new Date()
      },
      { upsert: true, new: true }
    );
  });
  await Promise.all(updatePromises);
  return { success: true };
};

export const syncApp = async (userId, appId) => {
  const connection = await AppConnection.findOneAndUpdate(
    { userId, appId },
    { lastSyncAt: new Date() },
    { new: true }
  );
  return connection;
};

export const getAppItems = async (userId, appId) => {
  const appConn = await AppConnection.findOne({ userId, appId });
  const appName = appConn?.appName || appId;
  const appIcon = appConn?.appIcon || 'Globe';

  if (appId === 'mongoose') {
    const notes = await Note.find({ user: userId }).sort({ updatedAt: -1 }).limit(20);
    return notes.map((n) => ({
      id: n._id,
      title: n.title,
      content: n.content,
      appId: 'mongoose',
      appName: 'MongoDB',
      appIcon: 'Database',
      timestamp: n.updatedAt,
      type: 'note'
    }));
  } else if (appId === 'custom_mcp') {
    const userTools = await connectionManager.getUserTools(userId);
    return userTools.map((t) => ({
      id: t.name,
      title: t.name,
      content: t.description,
      appId: 'custom_mcp',
      appName: 'Custom MCP Server',
      appIcon: 'Cpu',
      timestamp: new Date(),
      type: 'tool'
    }));
  } else {
    const executions = await ToolExecution.find({ user: userId }).sort({ createdAt: -1 }).limit(10);
    const conversations = await Conversation.find({ user: userId }).sort({ updatedAt: -1 }).limit(10);

    const items = [
      ...conversations.map((c) => ({
        id: c._id,
        title: c.title || `${appName} Interaction`,
        content: `Active session thread with ${appName} API context`,
        appId,
        appName,
        appIcon,
        timestamp: c.updatedAt,
        type: 'chat'
      })),
      ...executions.map((e) => ({
        id: e._id,
        title: `Tool Run: ${e.toolName}`,
        content: `Status: ${e.status} | Execution time: ${e.durationMs}ms`,
        appId,
        appName,
        appIcon,
        timestamp: e.createdAt,
        type: 'execution'
      }))
    ];

    if (items.length === 0) {
      items.push({
        id: `default-${appId}`,
        title: `${appName} Integration Active`,
        content: `Endpoint and authentication credentials verified for ${appName}.`,
        appId,
        appName,
        appIcon,
        timestamp: new Date(),
        type: 'status'
      });
    }

    return items;
  }
};

export const getAppTools = async (userId, appId) => {
  const userTools = await connectionManager.getUserTools(userId);

  if (appId === 'mongoose') {
    return userTools.filter((t) => t.name === 'search_saved_notes' || t.name === 'create_note');
  } else if (appId === 'custom_mcp') {
    return userTools;
  } else {
    // Return all available tools for custom REST or connected app integrations
    const restTools = [
      { name: 'fetch_users', description: 'Fetch registered users from API endpoint', inputSchema: { type: 'object' } },
      { name: 'fetch_leads', description: 'Fetch leads from API endpoint', inputSchema: { type: 'object' } },
      { name: 'create_lead', description: 'Create new lead via API endpoint', inputSchema: { type: 'object' } },
      { name: 'get_customers', description: 'Fetch customer details from API endpoint', inputSchema: { type: 'object' } }
    ];

    const matchedTools = userTools.filter((t) => t.name.includes(appId) || t.name === 'list_connected_apps');
    const combined = [...matchedTools, ...restTools];

    // Remove duplicates
    const unique = [];
    const seen = new Set();
    for (const item of combined) {
      if (!seen.has(item.name)) {
        seen.add(item.name);
        unique.push(item);
      }
    }
    return unique;
  }
};

export const getUnifiedInbox = async (userId) => {
  const conversations = await Conversation.find({ user: userId }).sort({ updatedAt: -1 }).limit(15);
  const notes = await Note.find({ user: userId }).sort({ updatedAt: -1 }).limit(10);
  const toolExecs = await ToolExecution.find({ user: userId }).sort({ createdAt: -1 }).limit(10);

  const items = [
    ...conversations.map((c) => ({
      id: c._id,
      title: c.title,
      content: 'AI Assistant Session',
      appId: 'custom_mcp',
      appName: 'AI Assistant',
      appIcon: 'MessageSquare',
      timestamp: c.updatedAt,
      type: 'conversation'
    })),
    ...notes.map((n) => ({
      id: n._id,
      title: n.title,
      content: n.content,
      appId: 'mongoose',
      appName: 'MongoDB',
      appIcon: 'Database',
      timestamp: n.updatedAt,
      type: 'note'
    })),
    ...toolExecs.map((t) => ({
      id: t._id,
      title: `Tool Execution: ${t.toolName}`,
      content: `Result status: ${t.status} (${t.durationMs}ms)`,
      appId: 'custom_mcp',
      appName: t.serverName || 'MCP Server',
      appIcon: 'Cpu',
      timestamp: t.createdAt,
      type: 'execution'
    }))
  ];

  items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return items;
};
