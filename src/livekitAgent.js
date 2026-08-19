import { fileURLToPath } from 'url';
import { cli, ServerOptions, defineAgent, voice, llm } from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// Connect to MongoDB
import { connectDB } from './config/db.js';
await connectDB();

import { User } from './models/User.js';
import { connectionManager } from './mcp/client/connectionManager.js';
import { safeExecuteTool } from './mcp/client/toolExecutor.js';

/**
 * Dynamically converts JSON Schema to Zod Schema
 */
function convertJsonSchemaToZod(jsonSchema) {
  if (!jsonSchema || typeof jsonSchema !== 'object') {
    return z.object({});
  }

  const properties = jsonSchema.properties || {};
  const required = jsonSchema.required || [];
  const zodFields = {};

  for (const [key, prop] of Object.entries(properties)) {
    let zodType;
    switch (prop.type) {
      case 'string':
        zodType = z.string();
        break;
      case 'number':
        zodType = z.number();
        break;
      case 'integer':
        zodType = z.number().int();
        break;
      case 'boolean':
        zodType = z.boolean();
        break;
      case 'array':
        zodType = z.array(z.any());
        break;
      case 'object':
        zodType = z.object({});
        break;
      default:
        zodType = z.any();
    }

    if (prop.description) {
      zodType = zodType.describe(prop.description);
    }

    if (!required.includes(key)) {
      zodType = zodType.optional();
    }

    zodFields[key] = zodType;
  }

  return z.object(zodFields);
}

/**
 * Converts toolName to user-friendly application display
 */
function getAppFriendlyName(toolName) {
  const norm = toolName.toLowerCase();
  if (norm.includes('whatsapp')) return 'WhatsApp';
  if (norm.includes('gmail') || norm.includes('email')) return 'Gmail';
  if (norm.includes('slack')) return 'Slack';
  if (norm.includes('channelbot') || norm.includes('youtube')) return 'ChannelBot';
  if (norm.includes('lead') || norm.includes('crm')) return 'CRM Leads';
  if (norm.includes('note')) return 'Notes App';
  return 'Connected App';
}

export default defineAgent({
  entry: async (ctx) => {
    console.log(`[LiveKit Agent] Session starting for room: ${ctx.room.name}`);

    // Wait for the participant to join
    const participant = await ctx.waitForParticipant();
    const identity = participant.identity;

    if (!identity.startsWith('user-')) {
      console.warn(`[LiveKit Agent] Unexpected participant identity: ${identity}`);
      return;
    }

    const userId = identity.replace('user-', '');
    console.log(`[LiveKit Agent] Authenticated User ID: ${userId}`);

    // Connect to room
    await ctx.connect();

    // Fetch user details for system prompt customization
    const user = await User.findById(userId);
    const userName = user?.name || 'Friend';

    // Retrieve active tools for user
    const userTools = await connectionManager.getUserTools(userId);
    console.log(`[LiveKit Agent] Found ${userTools.length} active tools for user ${userName}`);

    const pendingPromises = new Map();

    // Room listener for confirmation responses and text input fallback
    ctx.room.on('dataReceived', async (payload) => {
      try {
        const decoder = new TextDecoder();
        const data = JSON.parse(decoder.decode(payload));
        
        if (data.type === 'confirmation_response' && data.txId) {
          const pending = pendingPromises.get(data.txId);
          if (pending) {
            pendingPromises.delete(data.txId);
            pending.resolve(data);
          }
        }

        if (data.type === 'user_chat_message' && data.text) {
          console.log(`[LiveKit Agent] Fallback chat message received: "${data.text}"`);
          // Append user message to LLM conversation memory
          session.conversation.add({
            role: 'user',
            content: data.text
          });
          // Force generating a reply
          await session.generateReply();
        }
      } catch (err) {
        console.error("[LiveKit Agent] Error parsing incoming room data:", err.message);
      }
    });


    // Helper to check if tool is write action
    const isWriteAction = (toolName) => {
      const writePrefixes = ['send', 'reply', 'create', 'delete', 'update', 'post', 'write', 'remove', 'add', 'reject', 'accept'];
      const normalized = toolName.toLowerCase();
      return writePrefixes.some(prefix => normalized.startsWith(prefix));
    };

    // Convert userTools to LiveKit Agent tools
    const livekitTools = userTools.map(tool => {
      const parameters = convertJsonSchemaToZod(tool.inputSchema);

      return llm.tool({
        name: tool.name,
        description: tool.description || `Call the tool ${tool.name}`,
        parameters,
        execute: async (args) => {
          console.log(`[LiveKit Agent] LLM calling tool: ${tool.name} with args:`, args);

          // Check if this action requires user confirmation
          if (isWriteAction(tool.name)) {
            console.log(`[LiveKit Agent] Tool ${tool.name} requires explicit user confirmation. Prompting client...`);
            const txId = 'tx-' + Math.random().toString(36).substring(2, 11);

            // Extract app name and recipient / draft details
            const app = getAppFriendlyName(tool.name);
            const recipient = args.to || args.recipient || args.contactName || args.channelId || args.sender || 'Contact';
            const draft = args.message || args.content || args.text || args.commentText || '';

            // Send state 'thinking' to client during confirmation
            const encoder = new TextEncoder();
            await ctx.room.localParticipant.publishData(
              encoder.encode(JSON.stringify({ state: 'thinking' })),
              { reliable: true }
            );

            // Publish confirmation request
            const confirmationPayload = {
              type: 'confirmation_request',
              txId,
              app,
              recipient,
              draft,
              toolName: tool.name,
              args
            };

            await ctx.room.localParticipant.publishData(
              encoder.encode(JSON.stringify(confirmationPayload)),
              { reliable: true }
            );

            // Wait for user confirmation (timeout after 60s)
            const response = await new Promise((resolve) => {
              const timeout = setTimeout(() => {
                pendingPromises.delete(txId);
                resolve({ confirmed: false, error: 'Confirmation request timed out.' });
              }, 60000);

              pendingPromises.set(txId, {
                resolve: (data) => {
                  clearTimeout(timeout);
                  resolve(data);
                }
              });
            });

            if (!response.confirmed) {
              console.log(`[LiveKit Agent] Action rejected by user for tool ${tool.name}`);
              return JSON.stringify({
                success: false,
                error: response.error || 'User cancelled the action.'
              });
            }

            console.log(`[LiveKit Agent] Action approved by user for tool ${tool.name}. Proceeding.`);
            // Override message/draft argument with user's edited version if edited
            if (response.draft !== undefined) {
              if (args.message !== undefined) args.message = response.draft;
              else if (args.content !== undefined) args.content = response.draft;
              else if (args.text !== undefined) args.text = response.draft;
              else if (args.commentText !== undefined) args.commentText = response.draft;
            }
          }

          // Execute the tool securely using the user context
          try {
            const executionResult = await safeExecuteTool({
              userId,
              toolName: tool.name,
              args
            });

            // Return friendly tool-error messages on failure
            if (!executionResult.success) {
              return JSON.stringify({
                success: false,
                error: executionResult.error || `Tool '${tool.name}' execution failed.`
              });
            }

            console.log(`[LiveKit Agent] Tool ${tool.name} executed successfully. Result:`, executionResult.result);
            return JSON.stringify(executionResult.result);
          } catch (err) {
            console.error(`[LiveKit Agent] secure tool execution error for ${tool.name}:`, err.message);
            return JSON.stringify({
              success: false,
              error: `Tool execution failed: ${err.message}`
            });
          }
        }
      });
    });

    // Create RealtimeModel configuration
    const systemPrompt = `You are the MCP.ai natural voice assistant. Speak like a warm, reliable human friend. Never sound robotic, overly formal or scripted. Automatically detect the user’s language and reply in the same language. Support English, Tamil, Tanglish, Hindi and other Indian languages. Do not repeat the user’s words like Talking Tom. Use short, clear, voice-friendly responses with natural pauses and appropriate emotion. Stop speaking immediately when the user interrupts. Ask a short clarification question when necessary. Never reveal passwords, API keys, tokens or confidential information. Confirm before sending, deleting, accepting, rejecting or changing external data. You can access user tools to read emails, check messages, list apps, and send messages.`;

    const model = new openai.realtime.RealtimeModel({
      instructions: systemPrompt,
      voice: 'alloy', // Warm human voice
    });

    // Create AgentSession
    const session = new voice.AgentSession({
      llm: model,
    });

    // Map AgentStateChanged to client published events
    session.on(voice.AgentSessionEventTypes.AgentStateChanged, async (state) => {
      let clientState = state;
      if (state === 'initializing') clientState = 'idle';

      console.log(`[LiveKit Agent] State changed: ${state} -> publishing ${clientState}`);
      try {
        const encoder = new TextEncoder();
        await ctx.room.localParticipant.publishData(
          encoder.encode(JSON.stringify({ state: clientState })),
          { reliable: true }
        );
      } catch (err) {
        console.error("[LiveKit Agent] Failed to publish state:", err.message);
      }
    });

    // Capture LLM transcripts to scan for emotion-based animations
    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, async (item) => {
      if (item.role === 'assistant' && item.type === 'message' && item.content) {
        const text = item.content.toLowerCase();
        let emotion = null;

        if (text.includes('haha') || text.includes('lol') || text.includes('😂') || text.includes('😄') || text.includes('funny') || text.includes('he he') || text.includes('lmao')) {
          emotion = 'laughing';
        } else if (text.includes('wow') || text.includes('oh!') || text.includes('surpris') || text.includes('😮')) {
          emotion = 'surprised';
        } else if (text.includes('hi') || text.includes('hello') || text.includes('bye') || text.includes('waving') || text.includes('👋')) {
          emotion = 'waving';
        } else if (text.includes('success') || text.includes('perfect') || text.includes('great') || text.includes('awesome') || text.includes('completed') || text.includes('✅')) {
          emotion = 'happy';
        }

        if (emotion) {
          console.log(`[LiveKit Agent] Emotion detected: ${emotion} in assistant speech`);
          try {
            const encoder = new TextEncoder();
            await ctx.room.localParticipant.publishData(
              encoder.encode(JSON.stringify({ state: emotion })),
              { reliable: true }
            );

            // Revert back to speaking if still speaking, or idle, after 2 seconds
            setTimeout(async () => {
              const state = session.state === 'speaking' ? 'speaking' : 'idle';
              await ctx.room.localParticipant.publishData(
                encoder.encode(JSON.stringify({ state })),
                { reliable: true }
              );
            }, 2000);
          } catch (err) {
            console.error("[LiveKit Agent] Failed to publish emotion state:", err.message);
          }
        }
      }
    });

    // Start session in the room, registering our dynamic tools
    await session.start({
      room: ctx.room,
      tools: livekitTools
    });

    // Speak initial welcome message
    try {
      setTimeout(async () => {
        await session.say("Hi! I’m your MCP.ai voice assistant. You can speak with me naturally or ask me to check your connected apps. How can I help you today?");
      }, 1200);
    } catch (err) {
      console.error("[LiveKit Agent] Error speaking greeting:", err.message);
    }
  }
});

// Launch Agent application via CLI
cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url)
  })
);
