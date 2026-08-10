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

// @desc    Disconnect all app connectors
// @route   DELETE /api/apps/disconnect-all
export const disconnectAllAppsConnector = asyncWrapper(async (req, res) => {
  await disconnectAllApps(req.user._id);

  res.status(200).json({
    success: true,
    message: 'All apps disconnected successfully'
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
