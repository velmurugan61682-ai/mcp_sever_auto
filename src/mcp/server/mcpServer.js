import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema, ListPromptsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { executeGovernedTool } from './governedToolExecutor.js';

export const GOVERNED_MCP_TOOLS = [
  {
    name: 'crm.createContact',
    description: 'Creates a new contact record in tenant CRM',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        company: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } }
      },
      required: ['name']
    }
  },
  {
    name: 'crm.searchContacts',
    description: 'Searches contacts in workspace by name, email, or phone',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string' },
        limit: { type: 'number' }
      }
    }
  },
  {
    name: 'crm.moveDeal',
    description: 'Moves a deal to a new stage in pipeline',
    inputSchema: {
      type: 'object',
      properties: {
        dealId: { type: 'string' },
        stage: { type: 'string' }
      },
      required: ['dealId', 'stage']
    }
  },
  {
    name: 'appointments.findSlots',
    description: 'Finds available booking slots for staff and duration',
    inputSchema: {
      type: 'object',
      properties: {
        dateStr: { type: 'string' },
        durationMinutes: { type: 'number' }
      }
    }
  },
  {
    name: 'appointments.book',
    description: 'Books an appointment for a contact',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        contactId: { type: 'string' },
        startTime: { type: 'string' },
        endTime: { type: 'string' }
      },
      required: ['startTime']
    }
  },
  {
    name: 'campaigns.launch',
    description: 'Launches a campaign broadcast for audience',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        channel: { type: 'string' },
        content: { type: 'string' }
      },
      required: ['name', 'content']
    }
  },
  {
    name: 'knowledge.retrieve',
    description: 'Retrieves relevant information from workspace knowledge vector base',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        topK: { type: 'number' }
      },
      required: ['query']
    }
  },
  {
    name: 'calls.place',
    description: 'Initiates an outbound voice agent call session',
    inputSchema: {
      type: 'object',
      properties: {
        toPhone: { type: 'string' }
      },
      required: ['toPhone']
    }
  },
  {
    name: 'analytics.query',
    description: 'Queries workspace performance analytics and aggregate metrics',
    inputSchema: {
      type: 'object',
      properties: {
        metric: { type: 'string' }
      }
    }
  }
];

export const BUILTIN_TOOLS = GOVERNED_MCP_TOOLS;

export const BUILTIN_RESOURCES = [
  {
    uri: 'system://status',
    name: 'MCP Governance Status',
    description: 'MCP Server status and active governance policies',
    mimeType: 'application/json'
  }
];

export const BUILTIN_PROMPTS = [
  {
    name: 'crm-action-assistant',
    description: 'Executes governed CRM operations and appointment bookings',
    arguments: [{ name: 'query', description: 'User intent or request', required: true }]
  }
];

export const executeBuiltinToolDirect = async (toolName, args, userIdOrContext) => {
  const context = typeof userIdOrContext === 'object' && userIdOrContext !== null ? userIdOrContext : { userId: userIdOrContext };
  return await executeGovernedTool({ toolName, args, agent: context.agent, context });
};

export const createBuiltinMCPServer = () => {
  const server = new Server(
    {
      name: 'mcp-buzzz-governed-server',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      }
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: GOVERNED_MCP_TOOLS };
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: BUILTIN_RESOURCES };
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts: BUILTIN_PROMPTS };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;
    const agent = extra?.agent || {
      _id: extra?.agentId || 'default-agent-id',
      name: 'Buzzz AI Agent',
      status: 'active',
      autonomyLevel: extra?.autonomyLevel || 3,
      permissions: ['CAN_SEND_MESSAGE', 'CAN_CREATE_LEAD', 'CAN_UPDATE_DEAL', 'CAN_BOOK_APPOINTMENT', 'CAN_PLACE_CALL'],
      tools: ['messaging', 'crm', 'calendar', 'mrassistant_voice'],
      channels: ['chat', 'whatsapp', 'voice']
    };

    const result = await executeGovernedTool({
      toolName: name,
      args,
      agent,
      context: { workspaceId: extra?.workspaceId, userId: extra?.userId }
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  });

  return server;
};

export default createBuiltinMCPServer;
