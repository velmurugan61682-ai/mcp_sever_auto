import { ConnectedApp } from '../models/ConnectedApp.js';
const AppConnection = ConnectedApp;
import { APP_REGISTRY } from '../mcp/registry/appRegistry.js';
import { Note } from '../models/Note.js';
import { Conversation } from '../models/Conversation.js';
import { ToolExecution } from '../models/ToolExecution.js';
import { UnifiedConversation } from '../models/UnifiedConversation.js';
import { UnifiedMessage } from '../models/UnifiedMessage.js';
import { InboxSyncState } from '../models/InboxSyncState.js';
import { MCPServer } from '../models/MCPServer.js';
import { connectionManager } from '../mcp/client/connectionManager.js';
import { executeFetchChannelbotComments } from '../mcp/server/tools/channelbotTool.js';
import { processIncomingInboxEvent } from './inboxSyncService.js';
import { executeFetchGmailMessages } from '../mcp/server/tools/gmailTool.js';
import { executeFetchSlackMessages } from '../mcp/server/tools/slackTool.js';
import { executeFetchGithubNotifications } from '../mcp/server/tools/githubTool.js';

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
  const found = allApps.find((a) => a.appId === appId);

  if (found) return found;

  const registryDef = APP_REGISTRY.find((a) => a.appId === appId);
  if (registryDef) {
    return {
      ...registryDef,
      status: 'disconnected',
      unreadCount: 0,
      lastSyncAt: null,
      lastError: null
    };
  }

  throw new Error(`App connector '${appId}' not found`);
};

import crypto from 'crypto';
import { executeFetchWhatsappMessages } from '../mcp/server/tools/whatsappTool.js';

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(process.env.JWT_SECRET || 'mcp_ai_secret_key_2026').digest();

export const encryptToken = (text) => {
  if (!text || typeof text !== 'string') return text;
  if (text.startsWith('enc:')) return text;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `enc:${iv.toString('hex')}:${encrypted}`;
};

export const decryptToken = (text) => {
  if (!text || typeof text !== 'string' || !text.startsWith('enc:')) return text;
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return text;
  }
};

export const connectApp = async (userId, appId, configData = {}) => {
  const registryDef = APP_REGISTRY.find((a) => a.appId === appId);
  const appName = configData.appName || registryDef?.appName || appId;
  const provider = registryDef?.provider || 'custom';
  const connectionType = registryDef?.connectionType || configData.authMethod || 'api_key';

  // 1. Encrypt sensitive tokens and credentials before saving
  const sanitizedCredentials = { ...configData };
  Object.keys(sanitizedCredentials).forEach((key) => {
    const lower = key.toLowerCase();
    if (lower.includes('token') || lower.includes('secret') || lower.includes('key')) {
      if (typeof sanitizedCredentials[key] === 'string' && sanitizedCredentials[key]) {
        sanitizedCredentials[key] = encryptToken(sanitizedCredentials[key]);
      }
    }
  });

  // 2. Set status to 'connected' and update lastSyncAt
  const connection = await AppConnection.findOneAndUpdate(
    { userId, appId },
    {
      appName,
      provider,
      connectionType,
      appIcon: registryDef?.appIcon || 'Globe',
      logoUrl: registryDef?.logoUrl || (appId.includes('channelbot') ? '/channelbot-logo.png' : null),
      credentials: sanitizedCredentials,
      status: 'connected',
      lastSyncAt: new Date(),
      lastError: null
    },
    { upsert: true, new: true }
  );

  // 3. Immediately trigger platform message fetch to backfill existing conversations
  if (appId === 'whatsapp') {
    try {
      const fetchRes = await executeFetchWhatsappMessages({ limit: 10 }, { userId });
      if (fetchRes && fetchRes.success && Array.isArray(fetchRes.messages)) {
        for (const msg of fetchRes.messages) {
          await processIncomingInboxEvent({
            userId,
            connectionId: 'whatsapp',
            platform: 'whatsapp',
            platformEventId: msg.messageId || `wamid.${Date.now()}`,
            platformThreadId: msg.senderPhone || msg.senderName || 'whatsapp-thread',
            type: 'message',
            sender: {
              id: msg.senderPhone || 'external',
              name: msg.senderName || 'WhatsApp User',
              isMe: false
            },
            title: msg.senderName || 'WhatsApp Contact',
            content: msg.messageText || msg.content || 'WhatsApp Message',
            timestamp: msg.publishedAt ? new Date() : new Date(),
            priority: msg.status === 'old' ? 'low' : 'normal'
          });
        }
      }
    } catch (err) {
      console.warn('[connectApp] WhatsApp immediate backfill warning:', err.message);
    }
  } else if (appId === 'gmail') {
    try {
      const fetchRes = await executeFetchGmailMessages({ limit: 10 }, { userId });
      if (fetchRes && fetchRes.success && Array.isArray(fetchRes.messages)) {
        for (const msg of fetchRes.messages) {
          await processIncomingInboxEvent({
            userId,
            connectionId: 'gmail',
            platform: 'gmail',
            platformEventId: msg.messageId,
            platformThreadId: msg.senderEmail,
            type: 'email',
            sender: { id: msg.senderEmail, name: msg.senderName, isMe: false },
            title: msg.senderName,
            content: `${msg.subject}: ${msg.content}`,
            timestamp: new Date()
          });
        }
      }
    } catch (err) {
      console.warn('[connectApp] Gmail immediate backfill warning:', err.message);
    }
  } else if (appId === 'slack') {
    try {
      const fetchRes = await executeFetchSlackMessages({ limit: 10 }, { userId });
      if (fetchRes && fetchRes.success && Array.isArray(fetchRes.messages)) {
        for (const msg of fetchRes.messages) {
          await processIncomingInboxEvent({
            userId,
            connectionId: 'slack',
            platform: 'slack',
            platformEventId: msg.messageId,
            platformThreadId: msg.channel,
            type: 'chat',
            sender: { id: msg.senderName, name: msg.senderName, isMe: false },
            title: `${msg.senderName} (${msg.channel})`,
            content: msg.content,
            timestamp: new Date()
          });
        }
      }
    } catch (err) {
      console.warn('[connectApp] Slack immediate backfill warning:', err.message);
    }
  } else if (appId === 'github') {
    try {
      const fetchRes = await executeFetchGithubNotifications({ limit: 10 }, { userId });
      if (fetchRes && fetchRes.success && Array.isArray(fetchRes.notifications)) {
        for (const notif of fetchRes.notifications) {
          await processIncomingInboxEvent({
            userId,
            connectionId: 'github',
            platform: 'github',
            platformEventId: notif.messageId,
            platformThreadId: notif.repo,
            type: 'notification',
            sender: { id: notif.senderName, name: notif.senderName, isMe: false },
            title: `${notif.senderName} (${notif.repo})`,
            content: notif.content,
            timestamp: new Date()
          });
        }
      }
    } catch (err) {
      console.warn('[connectApp] GitHub immediate backfill warning:', err.message);
    }
  }

  return connection;
};

export const testAppConnection = async (userId, appId) => {
  const connection = await AppConnection.findOne({ userId, appId });
  if (!connection) {
    throw new Error(`No active connection config found for app '${appId}'`);
  }

  await AppConnection.findByIdAndUpdate(connection._id, {
    lastSyncAt: new Date(),
    lastError: null
  });

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
  // 1. Delete all connected app / integration records for user
  const connResult = await AppConnection.deleteMany({ userId });

  // 2. Delete custom user-created MCP server instances (preserve built-in server)
  const mcpResult = await MCPServer.deleteMany({ userId, isBuiltin: { $ne: true } });

  // 3. Delete UnifiedInbox conversations and messages for user
  const convResult = await UnifiedConversation.deleteMany({ user: userId });
  const msgResult = await UnifiedMessage.deleteMany({ user: userId });

  // 4. Delete sync state cursors & watermarks
  const syncResult = await InboxSyncState.deleteMany({ user: userId });

  // 5. Delete developer tool execution logs
  const toolResult = await ToolExecution.deleteMany({ user: userId });

  return {
    success: true,
    connectionsRemoved: (connResult.deletedCount || 0) + (mcpResult.deletedCount || 0),
    messagesRemoved: msgResult.deletedCount || 0,
    conversationsRemoved: convResult.deletedCount || 0,
    syncStatesRemoved: syncResult.deletedCount || 0,
    toolExecutionsRemoved: toolResult.deletedCount || 0
  };
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

    return items;
  }
};

export const getAppTools = async (userId, appId) => {
  const userTools = await connectionManager.getUserTools(userId);

  if (appId === 'mongoose') {
    return userTools.filter((t) => t.name === 'search_saved_notes' || t.name === 'create_note');
  } else if (appId === 'custom_mcp') {
    return userTools;
  } else if (appId.includes('channelbot')) {
    return userTools.filter((t) => t.name.includes('channelbot') || t.name === 'list_connected_apps');
  } else {
    const restTools = [
      { name: 'fetch_users', description: 'Fetch registered users from API endpoint', inputSchema: { type: 'object' } },
      { name: 'fetch_leads', description: 'Fetch leads from API endpoint', inputSchema: { type: 'object' } },
      { name: 'create_lead', description: 'Create new lead via API endpoint', inputSchema: { type: 'object' } },
      { name: 'get_customers', description: 'Fetch customer details from API endpoint', inputSchema: { type: 'object' } }
    ];

    const matchedTools = userTools.filter((t) => t.name.includes(appId) || t.name === 'list_connected_apps');
    const combined = [...matchedTools, ...restTools];

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
  const connectedApps = await AppConnection.find({ userId, status: 'connected' });
  if (!connectedApps || connectedApps.length === 0) {
    return [];
  }

  const unifiedConvs = await UnifiedConversation.find({
    user: userId,
    status: { $ne: 'closed' }
  }).sort({ lastMessageAt: -1, updatedAt: -1 });

  const items = unifiedConvs.map((c) => ({
    id: c._id.toString(),
    title: c.contactName,
    content: c.lastMessage || 'No messages yet',
    appId: c.sourceApp,
    appName: c.sourceApp,
    appIcon: c.sourceAppIcon || 'MessageSquare',
    logoUrl: c.contactAvatar,
    timestamp: c.lastMessageAt || c.updatedAt,
    unreadCount: c.unreadCount || 0,
    priority: c.status === 'archived' ? 'low' : 'high',
    archived: c.status === 'archived',
    type: 'communication'
  }));

  return items.filter(
    (item) =>
      item.title &&
      !item.title.startsWith('Tool Execution:') &&
      !item.title.includes('fetch_') &&
      item.appName !== 'Built-in MCP Server' &&
      item.type !== 'execution'
  );
};
