import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { processChatMessageWithDeepSeek } from '../services/deepseekService.js';
import { setSocketIOInstance } from '../services/inboxSyncService.js';

export const setupSocketIO = (io) => {
  setSocketIOInstance(io);
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication token missing'));
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      return next(new Error('Invalid socket authentication token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket Connected] User ${socket.userId} (Socket ID: ${socket.id})`);

    socket.join(socket.userId.toString());
    socket.join(`user:${socket.userId}`);

    socket.on('join_conversation', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('send_message', async (data) => {
      const { conversationId, content } = data || {};
      if (!conversationId || !content) {
        socket.emit('chat_error', { message: 'Conversation ID and content required' });
        return;
      }

      try {
        await processChatMessageWithDeepSeek({
          userId: socket.userId,
          conversationId,
          userMessageText: content,
          socket
        });
      } catch (err) {
        socket.emit('message_failed', { message: err.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket Disconnected] User ${socket.userId}`);
    });
  });
};
