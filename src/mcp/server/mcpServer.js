import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema, ListPromptsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { getTimeToolDefinition, executeGetTime } from './tools/timeTool.js';
import { calculatorToolDefinition, executeCalculator } from './tools/calculatorTool.js';
import { searchNotesToolDefinition, createNoteToolDefinition, executeSearchNotes, executeCreateNote } from './tools/notesTool.js';
import { listConnectedAppsToolDefinition, executeListConnectedApps } from './tools/appsTool.js';
import { createCrmLeadToolDefinition, executeCreateCrmLead } from './tools/crmTool.js';
import {
  fetchChannelbotCommentsToolDefinition,
  replyChannelbotCommentToolDefinition,
  executeFetchChannelbotComments,
  executeReplyChannelbotComment
} from './tools/channelbotTool.js';
import {
  sendWhatsappMessageToolDefinition,
  fetchWhatsappMessagesToolDefinition,
  executeSendWhatsappMessage,
  executeFetchWhatsappMessages
} from './tools/whatsappTool.js';

export const BUILTIN_TOOLS = [
  getTimeToolDefinition,
  calculatorToolDefinition,
  searchNotesToolDefinition,
  createNoteToolDefinition,
  listConnectedAppsToolDefinition,
  createCrmLeadToolDefinition,
  fetchChannelbotCommentsToolDefinition,
  replyChannelbotCommentToolDefinition,
  sendWhatsappMessageToolDefinition,
  fetchWhatsappMessagesToolDefinition
];

export const BUILTIN_RESOURCES = [
  {
    uri: 'system://status',
    name: 'MCP System Status',
    description: 'Current health metrics and connected backend modules',
    mimeType: 'application/json'
  },
  {
    uri: 'notes://all',
    name: 'All Saved Notes',
    description: 'Summary listing of user notes stored in MongoDB',
    mimeType: 'application/json'
  }
];

export const BUILTIN_PROMPTS = [
  {
    name: 'note-summarizer',
    description: 'Summarizes user notes and highlights action items',
    arguments: [
      { name: 'topic', description: 'Filter topic or tag', required: false }
    ]
  },
  {
    name: 'app-status-checker',
    description: 'Audits connected apps and verifies system health',
    arguments: []
  }
];

export const createBuiltinMCPServer = () => {
  const server = new Server(
    {
      name: 'mcp-ai-builtin-server',
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

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: BUILTIN_TOOLS };
  });

  // List resources handler
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: BUILTIN_RESOURCES };
  });

  // Read resource handler
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    if (uri === 'system://status') {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              status: 'online',
              version: '1.0.0',
              uptimeSeconds: Math.floor(process.uptime()),
              timestamp: new Date().toISOString()
            })
          }
        ]
      };
    }
    throw new Error(`Resource not found: ${uri}`);
  });

  // List prompts handler
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts: BUILTIN_PROMPTS };
  });

  // Tool Call handler
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;
    const userId = extra?.userId || args?.userId;

    try {
      let result;
      switch (name) {
        case 'get_current_time':
          result = await executeGetTime(args);
          break;
        case 'calculator':
          result = await executeCalculator(args);
          break;
        case 'search_saved_notes':
          result = await executeSearchNotes(args, userId);
          break;
        case 'create_note':
          result = await executeCreateNote(args, userId);
          break;
        case 'list_connected_apps':
          result = await executeListConnectedApps(args, userId);
          break;
        case 'create_crm_lead':
          result = await executeCreateCrmLead(args, userId);
          break;
        case 'fetch_channelbot_comments':
          result = await executeFetchChannelbotComments(args);
          break;
        case 'reply_channelbot_comment':
          result = await executeReplyChannelbotComment(args);
          break;
        case 'sendWhatsappMessage':
          result = await executeSendWhatsappMessage(args, { userId });
          break;
        case 'fetchWhatsappMessages':
          result = await executeFetchWhatsappMessages(args, { userId });
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Tool execution error: ${err.message}`
          }
        ]
      };
    }
  });

  return server;
};

// Helper function for direct internal execution without full transport overhead
export const executeBuiltinToolDirect = async (toolName, args, userId) => {
  switch (toolName) {
    case 'get_current_time':
      return await executeGetTime(args);
    case 'calculator':
      return await executeCalculator(args);
    case 'search_saved_notes':
      return await executeSearchNotes(args, userId);
    case 'create_note':
      return await executeCreateNote(args, userId);
    case 'list_connected_apps':
      return await executeListConnectedApps(args, userId);
    case 'create_crm_lead':
      return await executeCreateCrmLead(args, userId);
    case 'fetch_channelbot_comments':
      return await executeFetchChannelbotComments(args);
    case 'reply_channelbot_comment':
      return await executeReplyChannelbotComment(args);
    case 'sendWhatsappMessage':
      return await executeSendWhatsappMessage(args, { userId });
    case 'fetchWhatsappMessages':
      return await executeFetchWhatsappMessages(args, { userId });
    default:
      throw new Error(`Direct tool execution error: Unknown tool '${toolName}'`);
  }
};
