import { ConnectedApp } from '../models/ConnectedApp.js';
const AppConnection = ConnectedApp;
import { APP_REGISTRY } from '../mcp/registry/appRegistry.js';
import { Note } from '../models/Note.js';
import { Conversation } from '../models/Conversation.js';
import { ToolExecution } from '../models/ToolExecution.js';
import { connectionManager } from '../mcp/client/connectionManager.js';

export const getUserAppConnections = async (userId) => {
  const existingConnections = await AppConnection.find({ userId });

  return APP_REGISTRY.map((app) => {
    const conn = existingConnections.find((c) => c.appId === app.appId);
    let status = conn ? conn.status : 'disconnected';

    // Native immediate built-in connections
    if (!conn && (app.appId === 'mongoose' || app.appId === 'custom_mcp')) {
      status = 'connected';
    }

    return {
      appId: app.appId,
      appName: app.appName,
      provider: app.provider,
      connectionType: app.connectionType,
      appIcon: app.appIcon,
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

export const connectApp = async (userId, appId, configData = {}) => {
  const appDef = APP_REGISTRY.find((a) => a.appId === appId);
  if (!appDef) {
    throw new Error(`App connector '${appId}' is invalid`);
  }

  let status = 'connected';
  if (appDef.requiresConfig) {
    const hasKeys = Object.keys(configData).some((k) => configData[k] && configData[k].toString().trim().length > 0);
    if (!hasKeys) {
      status = 'configuration_required';
    }
  }

  const connection = await AppConnection.findOneAndUpdate(
    { userId, appId },
    {
      appName: appDef.appName,
      appIcon: appDef.appIcon,
      provider: appDef.provider,
      connectionType: appDef.connectionType,
      status,
      encryptedCredentials: configData,
      scopes: appDef.requiredPermissions,
      lastSyncAt: new Date(),
      lastError: null,
      isEnabled: true
    },
    { upsert: true, new: true }
  );

  return connection;
};

export const disconnectApp = async (userId, appId) => {
  const connection = await AppConnection.findOneAndUpdate(
    { userId, appId },
    {
      status: 'disconnected',
      lastSyncAt: new Date()
    },
    { new: true }
  );
  return connection;
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
    // For specific chat/external app connectors, fetch recent tool executions or conversations
    const executions = await ToolExecution.find({ user: userId }).sort({ createdAt: -1 }).limit(10);
    const conversations = await Conversation.find({ user: userId }).sort({ updatedAt: -1 }).limit(10);

    const appDef = APP_REGISTRY.find((a) => a.appId === appId);
    const appName = appDef ? appDef.appName : appId;
    const appIcon = appDef ? appDef.appIcon : 'Globe';

    return conversations.map((c) => ({
      id: c._id,
      title: c.title,
      content: `Conversation thread with ${appName} tool context`,
      appId,
      appName,
      appIcon,
      timestamp: c.updatedAt,
      type: 'chat'
    }));
  }
};

export const getAppTools = async (userId, appId) => {
  const userTools = await connectionManager.getUserTools(userId);

  if (appId === 'mongoose') {
    return userTools.filter((t) => t.name === 'search_saved_notes' || t.name === 'create_note');
  } else if (appId === 'custom_mcp') {
    return userTools;
  } else {
    // General app tools matching app context
    return userTools.filter((t) => t.name.includes(appId) || t.name === 'list_connected_apps');
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
