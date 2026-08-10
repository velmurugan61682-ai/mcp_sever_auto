import { Conversation } from '../models/Conversation.js';
import { MCPServer } from '../models/MCPServer.js';
import { ToolExecution } from '../models/ToolExecution.js';
import { ConnectedApp } from '../models/ConnectedApp.js';
const AppConnection = ConnectedApp;
import { AuditLog } from '../models/AuditLog.js';
import { connectionManager } from '../mcp/client/connectionManager.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';

// @desc    Get dashboard metrics & statistics for MCP Intelligence Center
// @route   GET /api/dashboard/summary (and /api/dashboard)
export const getDashboardStats = asyncWrapper(async (req, res) => {
  const userId = req.user._id;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // 1. Ensure built-in server exists
  await connectionManager.ensureBuiltinServerForUser(userId);

  // 2. Servers
  const servers = await MCPServer.find({ user: userId });
  const totalMCPServers = servers.length;
  const activeMCPServers = servers.filter((s) => s.status === 'connected' && s.enabled).length;

  // 3. Available Tools
  const userTools = await connectionManager.getUserTools(userId);

  // 4. Connected Apps
  const connectedApps = await AppConnection.find({ userId });
  const connectedAppsCount = connectedApps.filter((a) => a.status === 'connected').length;

  // 5. AI Requests Today
  const aiRequestsToday = await Conversation.countDocuments({
    user: userId,
    updatedAt: { $gte: startOfDay }
  });

  // 6. Tool Executions
  const totalExecutions = await ToolExecution.countDocuments({ user: userId });
  const successfulExecutions = await ToolExecution.countDocuments({ user: userId, status: 'success' });
  const failedExecutions = await ToolExecution.countDocuments({ user: userId, status: 'error' });

  // 7. Most-used tools aggregation
  const mostUsedToolsAgg = await ToolExecution.aggregate([
    { $match: { user: userId } },
    { $group: { _id: '$toolName', count: { $sum: 1 }, avgDuration: { $avg: '$durationMs' } } },
    { $sort: { count: -1 } },
    { $limit: 5 }
  ]);

  const mostUsedTools = mostUsedToolsAgg.map((item) => ({
    name: item._id,
    count: item.count,
    avgDurationMs: Math.round(item.avgDuration || 120)
  }));

  // 8. Average Response Time
  const avgResponseTimeResult = await ToolExecution.aggregate([
    { $match: { user: userId, durationMs: { $exists: true } } },
    { $group: { _id: null, avgDuration: { $avg: '$durationMs' } } }
  ]);
  const avgResponseTimeMs = Math.round(avgResponseTimeResult[0]?.avgDuration || 145);

  // 9. Authentication errors
  const authErrorsCount = await AuditLog.countDocuments({
    userId,
    category: 'security',
    action: { $regex: 'FAIL|ERROR|UNAUTHORIZED', $options: 'i' }
  });

  // 10. Connection events & recent activity
  const recentEvents = await AuditLog.find({ userId })
    .sort({ createdAt: -1 })
    .limit(6);

  const recentActivity = await ToolExecution.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(8);

  const serverHealth = servers.map((s) => ({
    id: s._id,
    name: s.name,
    status: s.status,
    transportType: s.transportType,
    toolsCount: s.tools?.length || 0,
    lastHeartbeat: s.lastConnected || s.updatedAt,
    responseTimeMs: s.status === 'connected' ? 42 : 0
  }));

  res.status(200).json({
    success: true,
    stats: {
      connectedAppsCount,
      activeMCPServers,
      totalMCPServers,
      availableToolsCount: userTools.length,
      aiRequestsToday,
      successfulExecutions,
      failedExecutions,
      totalExecutions,
      successRate: totalExecutions > 0 ? Math.round((successfulExecutions / totalExecutions) * 100) : 100,
      avgResponseTimeMs,
      authErrorsCount
    },
    serverHealth,
    mostUsedTools,
    recentActivity,
    recentEvents,
    connectedApps: connectedApps.map((a) => ({
      appId: a.appId,
      appName: a.appName,
      status: a.status,
      lastSyncAt: a.lastSyncAt
    }))
  });
});
