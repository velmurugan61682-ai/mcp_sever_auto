import mongoose from 'mongoose';
import { config } from './config/env.js';
import { ConnectedApp } from './models/ConnectedApp.js';
import { UnifiedConversation } from './models/UnifiedConversation.js';
import { UnifiedMessage } from './models/UnifiedMessage.js';
import { InboxSyncState } from './models/InboxSyncState.js';
import { MCPServer } from './models/MCPServer.js';
import { ToolExecution } from './models/ToolExecution.js';

async function performFreshReset() {
  try {
    console.log('[Reset] Connecting to MongoDB...');
    await mongoose.connect(config.mongoUri);

    console.log('[Reset] Removing all connected apps and credentials...');
    const connResult = await ConnectedApp.deleteMany({});
    
    console.log('[Reset] Removing custom user-created MCP server instances...');
    const mcpResult = await MCPServer.deleteMany({ isBuiltin: { $ne: true } });

    console.log('[Reset] Clearing Unified Inbox conversations and messages...');
    const convResult = await UnifiedConversation.deleteMany({});
    const msgResult = await UnifiedMessage.deleteMany({});

    console.log('[Reset] Clearing sync states and cursors...');
    const syncResult = await InboxSyncState.deleteMany({});

    console.log('[Reset] Clearing legacy developer tool execution logs...');
    const toolResult = await ToolExecution.deleteMany({});

    console.log('✅ FRESH RESET COMPLETE!');
    console.log({
      connectionsRemoved: connResult.deletedCount,
      customMcpServersRemoved: mcpResult.deletedCount,
      conversationsRemoved: convResult.deletedCount,
      messagesRemoved: msgResult.deletedCount,
      syncStatesRemoved: syncResult.deletedCount,
      toolExecutionsRemoved: toolResult.deletedCount
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Reset failed:', err.message);
    process.exit(1);
  }
}

performFreshReset();
