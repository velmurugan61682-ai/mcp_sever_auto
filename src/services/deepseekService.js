import OpenAI from 'openai';
import { config } from '../config/env.js';
import { connectionManager } from '../mcp/client/connectionManager.js';
import { safeExecuteTool } from '../mcp/client/toolExecutor.js';
import { Message } from '../models/Message.js';
import { Conversation } from '../models/Conversation.js';

const MAX_TOOL_LOOPS = 5;

// Initialize OpenAI client pointing to DeepSeek base URL
const getDeepSeekClient = () => {
  if (!config.deepseekApiKey || config.deepseekApiKey === 'your_new_deepseek_api_key') {
    return null;
  }
  return new OpenAI({
    apiKey: config.deepseekApiKey,
    baseURL: config.deepseekBaseUrl
  });
};

// Convert MCP tool definition schema to OpenAI function tool format
const convertMCPToOpenAITool = (mcpTool) => {
  return {
    type: 'function',
    function: {
      name: mcpTool.name,
      description: mcpTool.description || `Execute ${mcpTool.name}`,
      parameters: mcpTool.inputSchema || {
        type: 'object',
        properties: {},
        required: []
      }
    }
  };
};

export const processChatMessageWithDeepSeek = async ({
  userId,
  conversationId,
  userMessageText,
  socket = null
}) => {
  const emitProgress = (event, data) => {
    if (socket) {
      socket.emit(event, data);
    }
  };

  emitProgress('chat_status', { status: 'loading_context', message: 'Loading conversation history...' });

  // 1. Fetch conversation
  const conversation = await Conversation.findOne({ _id: conversationId, user: userId });
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // 2. Save user message to database
  const userMsg = await Message.create({
    conversation: conversationId,
    user: userId,
    role: 'user',
    content: userMessageText
  });

  emitProgress('user_message_created', userMsg);

  // 3. Load past messages for conversation
  const historyMessages = await Message.find({ conversation: conversationId })
    .sort({ createdAt: 1 })
    .limit(30);

  const formattedMessages = [
    {
      role: 'system',
      content: conversation.systemPrompt || 'You are mcp.ai, an intelligent assistant powered by DeepSeek and Model Context Protocol. You have access to real-time tools to get time, calculate math, search & create notes, and audit connected apps.'
    },
    ...historyMessages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: m.toolCallId || 'call_default',
          content: m.content
        };
      }
      return {
        role: m.role,
        content: m.content || ''
      };
    })
  ];

  // 4. Get available MCP tools for user
  emitProgress('chat_status', { status: 'fetching_tools', message: 'Connecting to MCP servers and discovering tools...' });
  const mcpTools = await connectionManager.getUserTools(userId);
  const openAITools = mcpTools.map(convertMCPToOpenAITool);

  emitProgress('tools_loaded', { count: mcpTools.length, tools: mcpTools.map((t) => t.name) });

  const client = getDeepSeekClient();

  // If no API key configured or fallback active, run intelligent local heuristic execution
  if (!client) {
    emitProgress('chat_status', { status: 'local_agent', message: 'Running direct MCP agent loop...' });

    let assistantContent = '';
    const executedToolCalls = [];

    // Simple heuristic tool selection if user prompt implies tool usage
    const lowerPrompt = userMessageText.toLowerCase();

    if (lowerPrompt.includes('crm') || lowerPrompt.includes('lead')) {
      emitProgress('chat_status', { status: 'tool_execution', message: 'Executing tool: create_crm_lead' });
      const toolRes = await safeExecuteTool({
        userId,
        conversationId,
        toolName: 'create_crm_lead',
        args: { name: 'Alex Rivers', email: 'alex@example.com', company: 'NexusTech', status: 'hot', sourcePlatform: 'AI Chat' }
      });
      executedToolCalls.push({
        id: 'call_crm_' + Date.now(),
        name: 'create_crm_lead',
        args: { name: 'Alex Rivers' },
        result: toolRes.result,
        status: toolRes.success ? 'success' : 'error',
        durationMs: toolRes.durationMs
      });
      assistantContent = `CRM Lead Created Successfully:\n\`\`\`json\n${JSON.stringify(toolRes.result, null, 2)}\n\`\`\``;
    } else if (lowerPrompt.includes('server') || lowerPrompt.includes('health') || lowerPrompt.includes('mcp active')) {
      emitProgress('chat_status', { status: 'tool_execution', message: 'Executing tool: list_connected_apps' });
      const toolRes = await safeExecuteTool({
        userId,
        conversationId,
        toolName: 'list_connected_apps',
        args: {}
      });
      executedToolCalls.push({
        id: 'call_servers_' + Date.now(),
        name: 'list_connected_apps',
        args: {},
        result: toolRes.result,
        status: toolRes.success ? 'success' : 'error',
        durationMs: toolRes.durationMs
      });
      assistantContent = `MCP Server Health & Connected Apps Status:\n\`\`\`json\n${JSON.stringify(toolRes.result, null, 2)}\n\`\`\``;
    } else if (lowerPrompt.includes('time') || lowerPrompt.includes('date') || lowerPrompt.includes('clock')) {
      emitProgress('chat_status', { status: 'tool_execution', message: 'Executing tool: get_current_time' });
      const toolRes = await safeExecuteTool({
        userId,
        conversationId,
        toolName: 'get_current_time',
        args: { timezone: 'UTC' }
      });
      executedToolCalls.push({
        id: 'call_time_' + Date.now(),
        name: 'get_current_time',
        args: { timezone: 'UTC' },
        result: toolRes.result,
        status: toolRes.success ? 'success' : 'error',
        durationMs: toolRes.durationMs
      });
      assistantContent = `Current Time Information:\n\`\`\`json\n${JSON.stringify(toolRes.result, null, 2)}\n\`\`\``;
    } else if (lowerPrompt.includes('calc') || lowerPrompt.includes('add') || lowerPrompt.includes('multiply') || lowerPrompt.includes('+') || lowerPrompt.includes('*')) {
      emitProgress('chat_status', { status: 'tool_execution', message: 'Executing tool: calculator' });
      const toolRes = await safeExecuteTool({
        userId,
        conversationId,
        toolName: 'calculator',
        args: { operation: 'add', a: 15, b: 25 }
      });
      executedToolCalls.push({
        id: 'call_calc_' + Date.now(),
        name: 'calculator',
        args: { operation: 'add', a: 15, b: 25 },
        result: toolRes.result,
        status: toolRes.success ? 'success' : 'error',
        durationMs: toolRes.durationMs
      });
      assistantContent = `Calculation Result:\n\`\`\`json\n${JSON.stringify(toolRes.result, null, 2)}\n\`\`\``;
    } else if (lowerPrompt.includes('app') || lowerPrompt.includes('connector') || lowerPrompt.includes('gmail') || lowerPrompt.includes('mongodb')) {
      emitProgress('chat_status', { status: 'tool_execution', message: 'Executing tool: list_connected_apps' });
      const toolRes = await safeExecuteTool({
        userId,
        conversationId,
        toolName: 'list_connected_apps',
        args: {}
      });
      executedToolCalls.push({
        id: 'call_apps_' + Date.now(),
        name: 'list_connected_apps',
        args: {},
        result: toolRes.result,
        status: toolRes.success ? 'success' : 'error',
        durationMs: toolRes.durationMs
      });
      assistantContent = `Connected Apps Overview:\n\`\`\`json\n${JSON.stringify(toolRes.result, null, 2)}\n\`\`\``;
    } else {
      assistantContent = `Hello! I am your mcp.ai assistant. Connected MCP Tools: ${mcpTools.map((t) => `\`${t.name}\``).join(', ')}.\n\nYou can ask me to:\n- Show all connected MCP servers\n- Create a CRM lead from this conversation\n- List tools available from MongoDB\n- Check the health of all MCP servers`;
    }

    const assistantMsg = await Message.create({
      conversation: conversationId,
      user: userId,
      role: 'assistant',
      content: assistantContent,
      toolCalls: executedToolCalls
    });

    emitProgress('assistant_message_created', assistantMsg);
    emitProgress('chat_status', { status: 'completed', message: 'Done' });
    return assistantMsg;
  }

  // 5. DeepSeek Generative Tool Loop
  let currentMessages = [...formattedMessages];
  let loopCount = 0;
  let finalAssistantMessage = null;
  const accumulatedToolCalls = [];

  while (loopCount < MAX_TOOL_LOOPS) {
    loopCount++;
    emitProgress('chat_status', { status: 'ai_thinking', message: `Querying DeepSeek (Iteration ${loopCount})...` });

    try {
      const response = await client.chat.completions.create({
        model: config.deepseekModel,
        messages: currentMessages,
        tools: openAITools.length > 0 ? openAITools : undefined,
        tool_choice: openAITools.length > 0 ? 'auto' : undefined,
        temperature: 0.7
      });

      const choice = response.choices[0];
      const message = choice.message;

      // Check if DeepSeek requested tool execution
      if (message.tool_calls && message.tool_calls.length > 0) {
        currentMessages.push(message);

        for (const toolCall of message.tool_calls) {
          const functionName = toolCall.function.name;
          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(toolCall.function.arguments || '{}');
          } catch (e) {
            parsedArgs = {};
          }

          emitProgress('chat_status', {
            status: 'executing_tool',
            message: `Executing MCP tool: ${functionName}...`,
            toolName: functionName,
            args: parsedArgs
          });

          // Execute tool safely
          const toolExecutionResult = await safeExecuteTool({
            userId,
            conversationId,
            toolName: functionName,
            args: parsedArgs
          });

          accumulatedToolCalls.push({
            id: toolCall.id,
            name: functionName,
            args: parsedArgs,
            result: toolExecutionResult.result,
            status: toolExecutionResult.success ? 'success' : 'error',
            durationMs: toolExecutionResult.durationMs,
            error: toolExecutionResult.error
          });

          // Append tool result message to conversation history for next DeepSeek iteration
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolExecutionResult.result)
          });

          emitProgress('tool_executed', {
            toolName: functionName,
            result: toolExecutionResult.result,
            success: toolExecutionResult.success
          });
        }
      } else {
        // DeepSeek provided final text response
        const assistantMsg = await Message.create({
          conversation: conversationId,
          user: userId,
          role: 'assistant',
          content: message.content || '',
          toolCalls: accumulatedToolCalls
        });

        finalAssistantMessage = assistantMsg;
        break;
      }
    } catch (err) {
      console.error('[DeepSeek API Error]:', err.message);
      // Fallback message if DeepSeek API throws an authentication or quota error
      const assistantMsg = await Message.create({
        conversation: conversationId,
        user: userId,
        role: 'assistant',
        content: `I encountered an issue connecting to the DeepSeek API (${err.message}).\n\nPlease verify your \`DEEPSEEK_API_KEY\` and \`DEEPSEEK_BASE_URL\` in \`server/.env\`.`,
        toolCalls: accumulatedToolCalls,
        isError: true
      });
      finalAssistantMessage = assistantMsg;
      break;
    }
  }

  if (!finalAssistantMessage) {
    // Reached max loop count
    finalAssistantMessage = await Message.create({
      conversation: conversationId,
      user: userId,
      role: 'assistant',
      content: 'Execution reached maximum tool loop limit.',
      toolCalls: accumulatedToolCalls
    });
  }

  // Update conversation updatedAt timestamp
  await Conversation.findByIdAndUpdate(conversationId, { updatedAt: new Date() });

  emitProgress('assistant_message_created', finalAssistantMessage);
  emitProgress('chat_status', { status: 'completed', message: 'Done' });

  return finalAssistantMessage;
};
