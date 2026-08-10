import { MCPServer } from '../../models/MCPServer.js';
import { MCPClientWrapper } from './mcpClient.js';
import { BUILTIN_TOOLS, BUILTIN_RESOURCES, BUILTIN_PROMPTS } from '../server/mcpServer.js';

class MCPConnectionManager {
  constructor() {
    this.activeConnections = new Map(); // serverId -> MCPClientWrapper
  }

  // Ensures built-in MCP server record exists for user atomically
  async ensureBuiltinServerForUser(userId) {
    const builtin = await MCPServer.findOneAndUpdate(
      { user: userId, isBuiltin: true },
      {
        $setOnInsert: {
          name: 'Built-in MCP Server',
          description: 'Native custom MCP tools (Current Time, Calculator, Notes Search/Create, App Inspector)',
          transportType: 'http',
          url: 'http://localhost:5000/mcp',
          enabled: true,
          isBuiltin: true
        },
        $set: {
          status: 'connected',
          lastConnected: new Date(),
          tools: BUILTIN_TOOLS,
          resources: BUILTIN_RESOURCES,
          prompts: BUILTIN_PROMPTS
        }
      },
      { upsert: true, new: true }
    );
    return builtin;
  }

  // Fetch all active tools available for a given user across enabled servers
  async getUserTools(userId) {
    await this.ensureBuiltinServerForUser(userId);
    const enabledServers = await MCPServer.find({ user: userId, enabled: true });

    const aggregatedTools = [];

    for (const server of enabledServers) {
      if (server.isBuiltin) {
        for (const tool of BUILTIN_TOOLS) {
          aggregatedTools.push({
            ...tool,
            serverId: server._id.toString(),
            serverName: server.name,
            isBuiltin: true
          });
        }
      } else {
        // External server tools
        try {
          const client = await this.getOrConnectClient(server);
          const tools = client.tools && client.tools.length > 0 ? client.tools : server.tools || [];
          for (const tool of tools) {
            aggregatedTools.push({
              ...tool,
              serverId: server._id.toString(),
              serverName: server.name,
              isBuiltin: false
            });
          }
        } catch (err) {
          console.warn(`[ConnectionManager] Failed to get tools from server ${server.name}:`, err.message);
        }
      }
    }

    return aggregatedTools;
  }

  async getOrConnectClient(serverDoc) {
    const serverId = serverDoc._id.toString();

    if (this.activeConnections.has(serverId)) {
      const existing = this.activeConnections.get(serverId);
      if (existing.isConnected) return existing;
    }

    const wrapper = new MCPClientWrapper(serverDoc);
    try {
      await wrapper.connect();
      this.activeConnections.set(serverId, wrapper);
      await MCPServer.findByIdAndUpdate(serverDoc._id, {
        status: 'connected',
        lastConnected: new Date(),
        lastError: null,
        tools: wrapper.tools,
        resources: wrapper.resources,
        prompts: wrapper.prompts
      });
    } catch (err) {
      await MCPServer.findByIdAndUpdate(serverDoc._id, {
        status: 'error',
        lastError: err.message
      });
      throw err;
    }

    return wrapper;
  }

  async testConnection(serverDoc) {
    if (serverDoc.isBuiltin) {
      await MCPServer.findByIdAndUpdate(serverDoc._id, {
        status: 'connected',
        lastConnected: new Date()
      });
      return {
        success: true,
        status: 'connected',
        toolsCount: BUILTIN_TOOLS.length,
        resourcesCount: BUILTIN_RESOURCES.length,
        promptsCount: BUILTIN_PROMPTS.length
      };
    }

    const wrapper = new MCPClientWrapper(serverDoc);
    try {
      await wrapper.connect();
      await MCPServer.findByIdAndUpdate(serverDoc._id, {
        status: 'connected',
        lastConnected: new Date(),
        lastError: null,
        tools: wrapper.tools,
        resources: wrapper.resources,
        prompts: wrapper.prompts
      });
      await wrapper.disconnect();

      return {
        success: true,
        status: 'connected',
        toolsCount: wrapper.tools.length,
        resourcesCount: wrapper.resources.length,
        promptsCount: wrapper.prompts.length
      };
    } catch (err) {
      await MCPServer.findByIdAndUpdate(serverDoc._id, {
        status: 'error',
        lastError: err.message
      });
      return {
        success: false,
        status: 'error',
        error: err.message
      };
    }
  }

  async removeConnection(serverId) {
    if (this.activeConnections.has(serverId)) {
      const conn = this.activeConnections.get(serverId);
      await conn.disconnect();
      this.activeConnections.delete(serverId);
    }
  }
}

export const connectionManager = new MCPConnectionManager();
