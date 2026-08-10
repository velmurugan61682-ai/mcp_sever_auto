import { ToolExecution } from '../../models/ToolExecution.js';
import { MCPServer } from '../../models/MCPServer.js';
import { executeBuiltinToolDirect } from '../server/mcpServer.js';
import { connectionManager } from './connectionManager.js';

const MAX_RESULT_LENGTH = 10000; // Truncate oversized results

export const safeExecuteTool = async ({
  userId,
  conversationId,
  messageId,
  toolName,
  args = {},
  timeoutMs = 15000
}) => {
  const startTime = Date.now();
  let status = 'success';
  let rawResult = null;
  let errorMessage = null;
  let serverDoc = null;

  try {
    // 1. Locate server providing this tool
    const userTools = await connectionManager.getUserTools(userId);
    const matchedTool = userTools.find((t) => t.name === toolName);

    if (!matchedTool) {
      throw new Error(`Tool '${toolName}' is not registered or authorized for this user.`);
    }

    serverDoc = await MCPServer.findById(matchedTool.serverId);

    // 2. Execute built-in or external tool
    if (matchedTool.isBuiltin || (serverDoc && serverDoc.isBuiltin)) {
      rawResult = await executeBuiltinToolDirect(toolName, args, userId);
    } else {
      const clientWrapper = await connectionManager.getOrConnectClient(serverDoc);
      const mcpResponse = await clientWrapper.callTool(toolName, args, timeoutMs);
      
      // Format response content from MCP protocol response object
      if (mcpResponse?.content && Array.isArray(mcpResponse.content)) {
        const textParts = mcpResponse.content
          .filter((c) => c.type === 'text')
          .map((c) => c.text);
        
        try {
          rawResult = JSON.parse(textParts.join('\n'));
        } catch {
          rawResult = textParts.join('\n');
        }
      } else {
        rawResult = mcpResponse;
      }
    }
  } catch (err) {
    status = 'error';
    errorMessage = err.message;
    rawResult = { error: err.message };
  }

  const durationMs = Date.now() - startTime;

  // 3. Truncate result if oversized
  let truncatedResult = rawResult;
  if (typeof rawResult === 'string' && rawResult.length > MAX_RESULT_LENGTH) {
    truncatedResult = rawResult.slice(0, MAX_RESULT_LENGTH) + '\n... [Result truncated due to size limit]';
  } else if (typeof rawResult === 'object' && JSON.stringify(rawResult).length > MAX_RESULT_LENGTH) {
    const jsonStr = JSON.stringify(rawResult);
    truncatedResult = {
      truncated: true,
      preview: jsonStr.slice(0, MAX_RESULT_LENGTH),
      note: 'Result exceeded size limit'
    };
  }

  // 4. Save ToolExecution record in MongoDB
  try {
    await ToolExecution.create({
      user: userId,
      conversation: conversationId || null,
      serverId: serverDoc ? serverDoc._id : null,
      serverName: serverDoc ? serverDoc.name : 'Built-in MCP Server',
      toolName,
      args,
      result: truncatedResult,
      status,
      durationMs,
      error: errorMessage
    });
  } catch (dbErr) {
    console.error('[ToolExecutor] Failed to save tool execution record:', dbErr.message);
  }

  return {
    success: status === 'success',
    toolName,
    args,
    result: truncatedResult,
    durationMs,
    error: errorMessage
  };
};
