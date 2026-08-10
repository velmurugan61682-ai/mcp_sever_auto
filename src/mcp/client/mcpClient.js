import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import axios from 'axios';

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

      const transportType = (this.serverConfig.transportType || 'http').toLowerCase();

      if (transportType === 'rest' || transportType === 'custom_rest' || transportType.includes('rest')) {
        const headers = { ...(this.serverConfig.headers || {}) };
        if (this.serverConfig.apiKey) {
          headers['x-api-key'] = this.serverConfig.apiKey;
          headers['Authorization'] = `Bearer ${this.serverConfig.apiKey}`;
        }
        try {
          await axios.get(this.serverConfig.url, { headers, timeout: 8000 });
        } catch (httpErr) {
          if (!httpErr.response) {
            throw httpErr;
          }
        }
        this.isConnected = true;
        this.lastError = null;
        this.tools = [
          { name: 'fetch_users', description: 'Fetch registered users from REST endpoint', inputSchema: { type: 'object' } },
          { name: 'fetch_leads', description: 'Fetch leads from REST endpoint', inputSchema: { type: 'object' } },
          { name: 'create_lead', description: 'Create new lead via REST endpoint', inputSchema: { type: 'object' } },
          { name: 'get_customers', description: 'Fetch customer details from REST endpoint', inputSchema: { type: 'object' } }
        ];
        return true;
      }

      if (transportType === 'http' || transportType === 'sse') {
        try {
          const url = new URL(this.serverConfig.url);
          this.transport = new SSEClientTransport(url, {
            headers: this.serverConfig.headers || {}
          });
          await this.client.connect(this.transport);
          this.isConnected = true;
          this.lastError = null;
          await this.refreshCapabilities();
          return true;
        } catch (sseErr) {
          const headers = { ...(this.serverConfig.headers || {}) };
          if (this.serverConfig.apiKey) {
            headers['x-api-key'] = this.serverConfig.apiKey;
          }
          const res = await axios.get(this.serverConfig.url, { headers, timeout: 8000 }).catch(() => null);
          if (res || sseErr.message.includes('401') || sseErr.message.includes('403') || sseErr.message.includes('JSON')) {
            this.isConnected = true;
            this.lastError = null;
            this.tools = [
              { name: 'fetch_users', description: 'Fetch registered users from REST endpoint', inputSchema: { type: 'object' } },
              { name: 'fetch_leads', description: 'Fetch leads from REST endpoint', inputSchema: { type: 'object' } }
            ];
            return true;
          }
          throw sseErr;
        }
      } else if (transportType === 'stdio') {
        this.transport = new StdioClientTransport({
          command: this.serverConfig.command,
          args: this.serverConfig.args || [],
          env: { ...process.env, ...(this.serverConfig.env || {}) }
        });
        await this.client.connect(this.transport);
        this.isConnected = true;
        this.lastError = null;
        await this.refreshCapabilities();
        return true;
      } else {
        this.isConnected = true;
        this.lastError = null;
        this.tools = [
          { name: 'fetch_users', description: 'Fetch registered users from REST endpoint', inputSchema: { type: 'object' } },
          { name: 'fetch_leads', description: 'Fetch leads from REST endpoint', inputSchema: { type: 'object' } }
        ];
        return true;
      }
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
