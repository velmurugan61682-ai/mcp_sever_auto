import {
  getUserAppConnections,
  getConnectedUserApps,
  getSingleAppConnection,
  connectApp,
  testAppConnection,
  disconnectApp,
  disconnectAllApps,
  syncApp,
  getAppItems,
  getAppTools,
  getUnifiedInbox
} from '../services/appConnectorService.js';
import { safeExecuteTool } from '../mcp/client/toolExecutor.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';

// @desc    Get all available connector apps
// @route   GET /api/apps
export const getApps = asyncWrapper(async (req, res) => {
  const apps = await getUserAppConnections(req.user._id);
  res.status(200).json({ success: true, count: apps.length, apps });
});

// @desc    Get connected apps only for far-left sidebar
// @route   GET /api/apps/connected
export const getConnectedApps = asyncWrapper(async (req, res) => {
  const connectedApps = await getConnectedUserApps(req.user._id);
  res.status(200).json({ success: true, count: connectedApps.length, apps: connectedApps });
});

// @desc    Get single app connection detail
// @route   GET /api/apps/:appId
export const getAppById = asyncWrapper(async (req, res) => {
  const { appId } = req.params;
  const app = await getSingleAppConnection(req.user._id, appId);
  res.status(200).json({ success: true, app });
});

// @desc    Connect or Reconnect app connector
// @route   POST /api/apps/:appId/connect, POST /api/apps/:appId/reconnect, POST /api/apps/connect
export const connectAppConnector = asyncWrapper(async (req, res) => {
  const appId = req.params.appId || req.body.appId || 'custom_rest';
  const configData = req.body || {};

  const connection = await connectApp(req.user._id, appId, configData);

  res.status(200).json({
    success: true,
    message: `App '${connection.appName || appId}' connected successfully`,
    connection
  });
});

// @desc    Test connection for app connector
// @route   POST /api/apps/:appId/test, POST /api/apps/test
export const testAppConnector = asyncWrapper(async (req, res) => {
  const appId = req.params.appId || 'preview';
  const result = await testAppConnection(req.user._id, appId);
  res.status(200).json({ success: true, message: result.message });
});

// @desc    Disconnect app connector
// @route   DELETE /api/apps/:appId/disconnect
export const disconnectAppConnector = asyncWrapper(async (req, res) => {
  const { appId } = req.params;
  const connection = await disconnectApp(req.user._id, appId);

  res.status(200).json({
    success: true,
    message: `App '${appId}' disconnected successfully`,
    connection
  });
});

// @desc    Disconnect all app connectors and reset integration data
// @route   DELETE /api/apps/disconnect-all, POST /api/dev/reset-integrations
export const disconnectAllAppsConnector = asyncWrapper(async (req, res) => {
  const summary = await disconnectAllApps(req.user._id);

  res.status(200).json({
    success: true,
    message: 'All apps disconnected and user integration test data reset successfully.',
    ...summary
  });
});

// @desc    Sync app connection
// @route   POST /api/apps/:appId/sync
export const syncAppConnector = asyncWrapper(async (req, res) => {
  const { appId } = req.params;
  const connection = await syncApp(req.user._id, appId);

  res.status(200).json({
    success: true,
    message: `App '${appId}' synced successfully`,
    connection
  });
});

// @desc    Get items/conversations for selected app
// @route   GET /api/apps/:appId/items
export const getAppItemsController = asyncWrapper(async (req, res) => {
  const { appId } = req.params;
  const items = await getAppItems(req.user._id, appId);
  res.status(200).json({ success: true, count: items.length, items });
});

// @desc    Get MCP tools associated with selected app
// @route   GET /api/apps/:appId/tools
export const getAppToolsController = asyncWrapper(async (req, res) => {
  const { appId } = req.params;
  const tools = await getAppTools(req.user._id, appId);
  res.status(200).json({ success: true, count: tools.length, tools });
});

// @desc    Call tool for specific app
// @route   POST /api/apps/:appId/tools/:toolName/call
export const callAppToolController = asyncWrapper(async (req, res) => {
  const { toolName } = req.params;
  const { args } = req.body || {};

  const result = await safeExecuteTool({
    userId: req.user._id,
    toolName,
    args: args || {}
  });

  res.status(200).json({ success: true, ...result });
});

// @desc    Get unified activity inbox across all apps
// @route   GET /api/unified-inbox
export const getUnifiedInboxController = asyncWrapper(async (req, res) => {
  const items = await getUnifiedInbox(req.user._id);
  res.status(200).json({ success: true, count: items.length, items });
});

import { processIncomingInboxEvent, markConversationAsRead, syncConnectedUserAppsBackground } from '../services/inboxSyncService.js';

// @desc    Handle incoming webhook for connected platforms (WhatsApp, YouTube, ChannelBot, Slack, Gmail, GitHub, Custom MCP)
// @route   POST /api/apps/webhook, POST /api/apps/:appId/webhook
export const handleIncomingAppWebhook = asyncWrapper(async (req, res) => {
  const platform = req.params.appId || req.body.platform || req.body.appId || 'custom_mcp';
  const userId = req.user?._id || req.body.userId || req.query.userId;

  if (!userId) {
    return res.status(400).json({ success: false, message: 'User ID context required for webhook processing' });
  }

  const {
    eventId,
    platformEventId,
    threadId,
    platformThreadId,
    type,
    sender,
    title,
    content,
    message,
    commentText,
    timestamp,
    priority
  } = req.body || {};

  const resultMessage = await processIncomingInboxEvent({
    userId,
    connectionId: platform,
    platform,
    platformEventId: eventId || platformEventId || `evt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    platformThreadId: threadId || platformThreadId || sender?.id || 'default-thread',
    type: type || 'message',
    sender: sender || { name: title || `${platform.toUpperCase()} Contact`, id: 'external' },
    title: title || sender?.name || `${platform.toUpperCase()} User`,
    content: content || message || commentText || 'New incoming event received',
    timestamp: timestamp ? new Date(timestamp) : new Date(),
    priority: priority || 'normal'
  });

  res.status(200).json({
    success: true,
    message: `Event for ${platform} processed and synchronized to Unified Inbox`,
    data: resultMessage
  });
});

// @desc    Mark conversation as read and update badges
// @route   PATCH /api/inbox/conversations/:id/read
export const markInboxConversationAsReadController = asyncWrapper(async (req, res) => {
  const conversationId = req.params.id;
  const conversation = await markConversationAsRead(req.user._id, conversationId);
  res.status(200).json({ success: true, conversation });
});

// @desc    Trigger background auto-sync for connected apps
// @route   POST /api/inbox/sync
export const triggerInboxAutoSyncController = asyncWrapper(async (req, res) => {
  await syncConnectedUserAppsBackground(req.user._id);
  res.status(200).json({ success: true, message: 'Background inbox sync completed' });
});

import { UnifiedMessage } from '../models/UnifiedMessage.js';

// @desc    Get REAL stored messages for a specific conversation ordered oldest -> newest
// @route   GET /api/inbox/conversations/:conversationId/messages
export const getInboxConversationMessagesController = asyncWrapper(async (req, res) => {
  const { conversationId } = req.params;
  const messages = await UnifiedMessage.find({
    user: req.user._id,
    conversationId
  }).sort({ sentAt: 1, createdAt: 1 });

  const formatted = messages.map((m) => ({
    _id: m._id,
    platformMessageId: m.externalMessageId || m._id.toString(),
    conversationId: m.conversationId,
    senderId: m.senderExternalId || 'external',
    senderName: m.direction === 'outgoing' ? 'You' : 'Contact',
    direction: m.direction,
    content: m.content,
    timestamp: m.sentAt || m.createdAt,
    platform: m.sourceApp
  }));

  res.status(200).json({
    success: true,
    count: formatted.length,
    messages: formatted
  });
});
