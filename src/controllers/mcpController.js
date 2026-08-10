import { MCPServer } from '../models/MCPServer.js';
import { MCPTool } from '../models/MCPTool.js';
import { connectionManager } from '../mcp/client/connectionManager.js';
import { safeExecuteTool } from '../mcp/client/toolExecutor.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';
import { validateServerUrl } from '../utils/urlValidator.js';
import { AuditLog } from '../models/AuditLog.js';

// Safe helper to parse headers input into an object
const parseHeaders = (val) => {
  if (!val) return {};
  if (typeof val === 'object' && !Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (typeof parsed === 'object' && parsed !== null) return parsed;
    } catch (e) {
      return {};
    }
  }
  return {};
};

// GET /api/mcp/servers
export const getServers = asyncWrapper(async (req, res) => {
  await connectionManager.ensureBuiltinServerForUser(req.user._id);
  const servers = await MCPServer.find({ user: req.user._id }).sort({ createdAt: -1 });

  res.status(200).json({ success: true, count: servers.length, servers });
});

// POST /api/mcp/servers
export const addServer = asyncWrapper(async (req, res) => {
  const { name, description, transportType, url, command, args, headers, autoReconnect, apiKey } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Server name is required' });
  }

  // Validate server URL for HTTP transports
  if (transportType !== 'stdio' && url) {
    const urlValidation = validateServerUrl(url);
    if (!urlValidation.valid) {
      return res.status(400).json({ success: false, message: urlValidation.message });
    }
  }

  const parsedHeaders = parseHeaders(headers);
  if (apiKey) {
    parsedHeaders['Authorization'] = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
  }

  const server = await MCPServer.create({
    user: req.user._id,
    name,
    description: description || '',
    transportType: transportType || 'http',
    url: url || '',
    command: command || '',
    args: args || [],
    headers: parsedHeaders,
    autoReconnect: autoReconnect !== undefined ? autoReconnect : true,
    status: 'disconnected',
    enabled: true
  });

  await AuditLog.create({
    userId: req.user._id,
    action: 'MCP_SERVER_ADDED',
    category: 'mcp_connection',
    details: { serverId: server._id, name: server.name }
  });

  // Attempt initial connection test & discovery asynchronously
  connectionManager.testConnection(server).catch(() => {});

  res.status(201).json({ success: true, server });
});

// PATCH /api/mcp/servers/:id
export const updateServer = asyncWrapper(async (req, res) => {
  const { name, description, transportType, url, command, args, enabled, headers, apiKey } = req.body;

  const server = await MCPServer.findOne({ _id: req.params.id, user: req.user._id });
  if (!server) {
    return res.status(404).json({ success: false, message: 'MCP server not found' });
  }

  if (server.isBuiltin) {
    return res.status(400).json({ success: false, message: 'Cannot modify built-in MCP server core configurations' });
  }

  if (url && transportType !== 'stdio') {
    const urlValidation = validateServerUrl(url);
    if (!urlValidation.valid) {
      return res.status(400).json({ success: false, message: urlValidation.message });
    }
  }

  if (name !== undefined) server.name = name;
  if (description !== undefined) server.description = description;
  if (transportType !== undefined) server.transportType = transportType;
  if (url !== undefined) server.url = url;
  if (command !== undefined) server.command = command;
  if (args !== undefined) server.args = args;
  if (enabled !== undefined) server.enabled = enabled;

  if (headers !== undefined || apiKey !== undefined) {
    const existingHeaders = parseHeaders(server.headers);
    const newHeaders = headers !== undefined ? parseHeaders(headers) : existingHeaders;
    if (apiKey) {
      newHeaders['Authorization'] = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
    }
    server.headers = newHeaders;
  }

  await server.save();

  res.status(200).json({ success: true, server });
});

// DELETE /api/mcp/servers/:id
export const deleteServer = asyncWrapper(async (req, res) => {
  const server = await MCPServer.findOne({ _id: req.params.id, user: req.user._id });
  if (!server) {
    return res.status(404).json({ success: false, message: 'MCP server not found' });
  }

  if (server.isBuiltin) {
    return res.status(400).json({ success: false, message: 'Cannot delete built-in MCP server' });
  }

  await connectionManager.removeConnection(server._id.toString());
  await MCPServer.findByIdAndDelete(server._id);
  await MCPTool.deleteMany({ serverId: server._id });

  await AuditLog.create({
    userId: req.user._id,
    action: 'MCP_SERVER_DELETED',
    category: 'mcp_connection',
    details: { serverId: req.params.id, name: server.name }
  });

  res.status(200).json({ success: true, message: 'MCP server removed successfully' });
});

// POST /api/mcp/servers/:id/test
export const testServerConnection = asyncWrapper(async (req, res) => {
  const server = await MCPServer.findOne({ _id: req.params.id, user: req.user._id });
  if (!server) {
    return res.status(404).json({ success: false, message: 'MCP server not found' });
  }

  const testResult = await connectionManager.testConnection(server);
  res.status(200).json({ success: true, ...testResult });
});

// POST /api/mcp/servers/:id/connect
export const connectServer = asyncWrapper(async (req, res) => {
  const server = await MCPServer.findOne({ _id: req.params.id, user: req.user._id });
  if (!server) {
    return res.status(404).json({ success: false, message: 'MCP server not found' });
  }

  const testResult = await connectionManager.testConnection(server);
  server.status = testResult.connected ? 'connected' : 'error';
  server.lastConnected = testResult.connected ? new Date() : server.lastConnected;
  if (!testResult.connected) server.lastError = testResult.message;
  await server.save();

  res.status(200).json({ success: true, connected: testResult.connected, server });
});

// POST /api/mcp/servers/:id/discover
export const discoverTools = asyncWrapper(async (req, res) => {
  const server = await MCPServer.findOne({ _id: req.params.id, user: req.user._id });
  if (!server) {
    return res.status(404).json({ success: false, message: 'MCP server not found' });
  }

  const testResult = await connectionManager.testConnection(server);
  const tools = server.tools || [];
  const resources = server.resources || [];

  // Sync to MCPTool collection
  for (const t of tools) {
    await MCPTool.findOneAndUpdate(
      { userId: req.user._id, serverId: server._id, name: t.name },
      {
        userId: req.user._id,
        serverId: server._id,
        serverName: server.name,
        name: t.name,
        description: t.description || '',
        inputSchema: t.inputSchema || {},
        requiredParams: t.inputSchema?.required || []
      },
      { upsert: true, new: true }
    );
  }

  res.status(200).json({
    success: true,
    message: `Discovered ${tools.length} tools and ${resources.length} resources from ${server.name}`,
    toolsCount: tools.length,
    resourcesCount: resources.length,
    tools,
    resources
  });
});

// GET /api/mcp/servers/:id/tools
export const getServerTools = asyncWrapper(async (req, res) => {
  const server = await MCPServer.findOne({ _id: req.params.id, user: req.user._id });
  if (!server) {
    return res.status(404).json({ success: false, message: 'MCP server not found' });
  }

  res.status(200).json({
    success: true,
    serverName: server.name,
    tools: server.tools || [],
    resources: server.resources || [],
    prompts: server.prompts || []
  });
});

// POST /api/mcp/tools/:toolId/execute or /api/mcp/tools/call
export const executeToolById = asyncWrapper(async (req, res) => {
  const { toolId } = req.params;
  const { toolName, args } = req.body;

  let targetName = toolName;
  if (toolId && toolId !== 'call') {
    const dbTool = await MCPTool.findById(toolId);
    if (dbTool) targetName = dbTool.name;
  }

  if (!targetName) {
    return res.status(400).json({ success: false, message: 'Tool name is required' });
  }

  const result = await safeExecuteTool({
    userId: req.user._id,
    toolName: targetName,
    args: args || {}
  });

  res.status(200).json({ success: true, ...result });
});
