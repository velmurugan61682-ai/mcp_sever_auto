import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import appRoutes from './routes/appRoutes.js';
import mcpRoutes from './routes/mcpRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import crmRoutes from './routes/crmRoutes.js';
import automationRoutes from './routes/automationRoutes.js';
import channelbotRoutes from './routes/channelbotRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import { createBuiltinMCPServer, BUILTIN_TOOLS, BUILTIN_RESOURCES, BUILTIN_PROMPTS } from './mcp/server/mcpServer.js';

const app = express();

// Security HTTP headers
app.use(helmet({ contentSecurityPolicy: false }));

// CORS configuration
app.use(
  cors({
    origin: config.clientUrl || '*',
    credentials: true
  })
);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 300,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api', limiter);

import { getUnifiedInboxController } from './controllers/appController.js';
import { protect } from './middleware/authMiddleware.js';

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/apps', appRoutes);
app.use('/api/mcp', mcpRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/automations', automationRoutes);
app.use('/api/channelbot', channelbotRoutes);
app.use('/api/audit', auditRoutes);
app.get('/api/unified-inbox', protect, getUnifiedInboxController);

// Streamable HTTP / SSE endpoint for Built-in MCP Server
const builtinServer = createBuiltinMCPServer();

app.get('/mcp', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.status(200).send(`data: ${JSON.stringify({ status: 'MCP Stream Online', server: 'mcp-ai-builtin-server' })}\n\n`);
});

app.post('/mcp', async (req, res) => {
  const { method, params } = req.body || {};
  if (method === 'tools/list') {
    return res.json({ jsonrpc: '2.0', result: { tools: BUILTIN_TOOLS }, id: req.body.id || 1 });
  } else if (method === 'resources/list') {
    return res.json({ jsonrpc: '2.0', result: { resources: BUILTIN_RESOURCES }, id: req.body.id || 1 });
  } else if (method === 'prompts/list') {
    return res.json({ jsonrpc: '2.0', result: { prompts: BUILTIN_PROMPTS }, id: req.body.id || 1 });
  }
  return res.json({ jsonrpc: '2.0', result: { status: 'ok' }, id: req.body.id || 1 });
});

// Central error handler
app.use(errorHandler);

export default app;
