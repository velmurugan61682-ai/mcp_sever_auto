import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app.js';
import { config } from './config/env.js';
import { connectDB } from './config/db.js';
import { setupSocketIO } from './sockets/chatSocket.js';

const httpServer = http.createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.clientUrl || '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

setupSocketIO(io);

const startServer = async () => {
  await connectDB();

  httpServer.listen(config.port, () => {
    console.log(`==================================================`);
    console.log(`🚀 mcp.ai Server running on port ${config.port}`);
    console.log(`🌐 Client URL: ${config.clientUrl}`);
    console.log(`🤖 MCP Stream URL: http://localhost:${config.port}/mcp`);
    console.log(`==================================================`);
  });
};

startServer();

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('[Unhandled Rejection]:', err.message);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]:', err.message);
});
