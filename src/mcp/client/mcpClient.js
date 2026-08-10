import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export class MCPClientWrapper {
  constructor(serverConfig) {
    this.serverConfig = serverConfig;
    this.client = new Client(
      {
        name: 'mcp-ai-backend-client',
        version: '1.0.0'
      },
      {
        capabilities: {}
      }
    );
    this.transport = null;
    this.isConnected = false;
    this.tools = [];
    this.resources = [];
    this.prompts = [];
    this.lastError = null;
  }

  async connect() {
    try {
      if (this.serverConfig.isBuiltin) {
        // Builtin server is directly linked
        this.isConnected = true;
        return true;
      }

      if (this.serverConfig.transportType === 'http') {
        const url = new URL(this.serverConfig.url);
        this.transport = new SSEClientTransport(url, {
          headers: this.serverConfig.headers || {}
        });
      } else if (this.serverConfig.transportType === 'stdio') {
        this.transport = new StdioClientTransport({
          command: this.serverConfig.command,
          args: this.serverConfig.args || [],
          env: { ...process.env, ...(this.serverConfig.env || {}) }
        });
      } else {
        throw new Error(`Unsupported transport type: ${this.serverConfig.transportType}`);
      }

      await this.client.connect(this.transport);
      this.isConnected = true;
      this.lastError = null;
      await this.refreshCapabilities();
      return true;
    } catch (err) {
      this.isConnected = false;
      this.lastError = err.message;
      throw err;
    }
  }

  async refreshCapabilities() {
    if (!this.isConnected) return;
    try {
      if (this.serverConfig.isBuiltin) {
        return;
      }
      const toolsResult = await this.client.listTools();
      this.tools = toolsResult?.tools || [];

      const resourcesResult = await this.client.listResources().catch(() => ({ resources: [] }));
      this.resources = resourcesResult?.resources || [];

      const promptsResult = await this.client.listPrompts().catch(() => ({ prompts: [] }));
      this.prompts = promptsResult?.prompts || [];
    } catch (err) {
      console.warn(`[MCPClientWrapper] Failed to refresh capabilities for ${this.serverConfig.name}:`, err.message);
    }
  }

  async callTool(toolName, args, timeoutMs = 15000) {
    if (!this.isConnected && !this.serverConfig.isBuiltin) {
      await this.connect();
    }

    const timer = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Tool execution timed out after ${timeoutMs}ms`)), timeoutMs)
    );

    const callPromise = this.client.callTool({
      name: toolName,
      arguments: args
    });

    return await Promise.race([callPromise, timer]);
  }

  async disconnect() {
    try {
      if (this.transport && typeof this.transport.close === 'function') {
        await this.transport.close();
      }
    } catch (err) {
      console.error(`[MCPClientWrapper] Disconnect error: ${err.message}`);
    } finally {
      this.isConnected = false;
    }
  }
}
