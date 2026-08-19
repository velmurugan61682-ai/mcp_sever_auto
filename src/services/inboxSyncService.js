import { UnifiedConversation } from '../models/UnifiedConversation.js';
import { UnifiedMessage } from '../models/UnifiedMessage.js';
import { InboxSyncState } from '../models/InboxSyncState.js';
import { ConnectedApp } from '../models/ConnectedApp.js';
import { ProcessedEvent } from '../models/ProcessedEvent.js';

import { APP_REGISTRY } from '../mcp/registry/appRegistry.js';
import { fetchChannelbotCommentsToolDefinition, executeFetchChannelbotComments } from '../mcp/server/tools/channelbotTool.js';

let ioInstance = null;

export const setSocketIOInstance = (io) => {
  ioInstance = io;
};

const getAppLogoForPlatform = (platformStr) => {
  if (!platformStr) return 'MessageSquare';
  const norm = platformStr.toLowerCase().trim();
  const matched = APP_REGISTRY.find(
    (app) => app.appId.toLowerCase() === norm || app.appName.toLowerCase() === norm
  );
  if (matched) {
    return matched.logoUrl || matched.appIcon || norm;
  }
  return norm;
};

/**
 * Normalizes and ingests an incoming event/message into UnifiedInbox.
 * Enforces strict multi-tenant scoping and idempotent deduplication.
 */
export const processIncomingInboxEvent = async ({
  userId,
  connectionId,
  platform,
  platformEventId,
  platformThreadId,
  type = 'message',
  sender = {},
  title,
  content,
  timestamp = new Date(),
  priority = 'normal',
  metadata = {}
}) => {
  if (!userId || !platform || !platformEventId) {
    throw new Error('[inboxSyncService] userId, platform, and platformEventId are required');
  }

  // Idempotency: Deduplicate incoming events at the database level
  const workspaceId = 'default-workspace';
  const appConnectionId = connectionId || platform;
  const externalEventId = platformEventId;

  try {
    await ProcessedEvent.create({
      workspaceId,
      appConnectionId,
      externalEventId
    });
  } catch (err) {
    if (err.code === 11000) {
      console.log(`[Deduplication] Event already processed: ${workspaceId} + ${appConnectionId} + ${externalEventId}`);
      return await UnifiedMessage.findOne({
        user: userId,
        sourceApp: platform.toLowerCase(),
        externalMessageId: platformEventId
      });
    }
    throw err;
  }

  const normalizedPlatform = platform.toLowerCase();
  const threadId = platformThreadId || sender.id || sender.email || `${normalizedPlatform}-thread-default`;
  const contactName = title || sender.name || `${normalizedPlatform.toUpperCase()} User`;
  const contactAvatar = sender.avatar || '';

  // 1. Find or create UnifiedConversation idempotently
  let conversation = await UnifiedConversation.findOne({
    user: userId,
    sourceApp: normalizedPlatform,
    externalConversationId: threadId
  });

  if (!conversation) {
    conversation = await UnifiedConversation.create({
      workspaceId: 'default-workspace',
      user: userId,
      connectedAppId: connectionId || normalizedPlatform,
      sourceApp: normalizedPlatform,
      externalConversationId: threadId,
      contactName,
      contactAvatar,
      contactExternalId: sender.id || '',
      lastMessage: content,
      lastMessageAt: timestamp,
      unreadCount: 1,
      status: 'active'
    });
  }

  // 2. Idempotent Message Insertion with strict deduplication
  let message;
  try {
    message = await UnifiedMessage.findOneAndUpdate(
      {
        user: userId,
        sourceApp: normalizedPlatform,
        externalMessageId: platformEventId
      },
      {
        $setOnInsert: {
          workspaceId: 'default-workspace',
          conversationId: conversation._id,
          user: userId,
          connectedAppId: connectionId || normalizedPlatform,
          sourceApp: normalizedPlatform,
          externalMessageId: platformEventId,
          direction: sender.isMe ? 'outgoing' : 'incoming',
          senderExternalId: sender.id || sender.name || 'external-user',
          messageType: type === 'comment' ? 'text' : type,
          content,
          sentAt: timestamp,
          deliveryStatus: 'delivered'
        }
      },
      { upsert: true, new: true, rawResult: true }
    );

    // If message was newly inserted (upsert), update conversation metadata & unread badge
    const isNew = !message.lastErrorObject || !message.lastErrorObject.updatedExisting;
    const messageDoc = message.value || message;

    if (isNew) {
      const updatedConv = await UnifiedConversation.findByIdAndUpdate(
        conversation._id,
        {
          $set: {
            lastMessage: content,
            lastMessageAt: timestamp,
            contactName: contactName || conversation.contactName
          },
          $inc: { unreadCount: sender.isMe ? 0 : 1 }
        },
        { new: true }
      );

      // 3. Emit real-time Socket.IO event to user room
      if (ioInstance) {
        const appLogo = getAppLogoForPlatform(normalizedPlatform);
        const senderName = sender?.name || updatedConv.contactName || 'Contact';

        const newMessagePayload = {
          platform: normalizedPlatform,
          appLogo,
          conversationId: updatedConv._id,
          sender: senderName,
          content,
          timestamp
        };

        const targetRoomStr = userId.toString();
        const userPrefixRoom = `user:${userId}`;

        // Emit 'inbox:new_message' to both target user room formats
        ioInstance.to(targetRoomStr).emit('inbox:new_message', newMessagePayload);
        ioInstance.to(userPrefixRoom).emit('inbox:new_message', newMessagePayload);

        // Retain existing event emissions for backward compatibility
        const payload = {
          conversation: updatedConv,
          message: messageDoc,
          event: {
            id: messageDoc._id,
            userId,
            connectionId,
            platform: normalizedPlatform,
            appLogo,
            platformEventId,
            type,
            sender,
            title: updatedConv.contactName,
            content,
            timestamp,
            unread: true,
            priority
          }
        };

        ioInstance.to(targetRoomStr).emit('inbox:new', payload);
        ioInstance.to(userPrefixRoom).emit('inbox:new', payload);
        ioInstance.to(userPrefixRoom).emit('connected_message_received', {
          conversationId: updatedConv._id,
          message: messageDoc,
          sourceApp: normalizedPlatform
        });
      }
    }

    return messageDoc;
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate key collision caught safely
      return await UnifiedMessage.findOne({ user: userId, sourceApp: normalizedPlatform, externalMessageId: platformEventId });
    }
    throw err;
  }
};

/**
 * Marks conversation as read, clears unread badge, and emits socket event
 */
export const markConversationAsRead = async (userId, conversationId) => {
  const conversation = await UnifiedConversation.findOneAndUpdate(
    { _id: conversationId, user: userId },
    { $set: { unreadCount: 0 } },
    { new: true }
  );

  if (conversation) {
    await UnifiedMessage.updateMany(
      { conversationId: conversation._id, user: userId, unread: true },
      { $set: { unread: false } }
    );

    if (ioInstance) {
      ioInstance.to(`user:${userId}`).emit('inbox:read', { conversationId: conversation._id, unreadCount: 0 });
    }
  }

  return conversation;
};

/**
 * Background Sync Worker for connected apps
 * Synchronizes only for apps currently marked as connected for the user
 */
export const syncConnectedUserAppsBackground = async (userId) => {
  try {
    const connectedApps = await ConnectedApp.find({ userId, status: 'connected' });
    if (!connectedApps || connectedApps.length === 0) return;

    for (const app of connectedApps) {
      const platform = app.appId.toLowerCase();

      // Check sync state watermark/cursor
      let syncState = await InboxSyncState.findOne({ user: userId, platform, connectionId: app.appId });
      if (!syncState) {
        syncState = await InboxSyncState.create({
          user: userId,
          platform,
          connectionId: app.appId,
          cursor: '',
          status: 'idle'
        });
      }

      // Sync ChannelBot / YouTube comments
      if (platform.includes('channelbot') || platform.includes('youtube')) {
        try {
          const res = await executeFetchChannelbotComments({ limit: 10 });
          if (res && res.success && Array.isArray(res.comments)) {
            for (const comment of res.comments) {
              await processIncomingInboxEvent({
                userId,
                connectionId: app.appId,
                platform,
                platformEventId: comment.commentId || `cb-${comment.publishedAt}`,
                platformThreadId: comment.authorName || 'channelbot-thread',
                type: 'comment',
                sender: {
                  id: comment.authorName,
                  name: comment.authorName || 'YouTube Commenter',
                  isMe: false
                },
                title: comment.authorName,
                content: comment.commentText,
                timestamp: comment.publishedAt ? new Date() : new Date(),
                priority: comment.status === 'old' ? 'low' : 'normal'
              });
            }

            await InboxSyncState.findByIdAndUpdate(syncState._id, {
              status: 'success',
              lastSyncedAt: new Date(),
              lastError: null
            });
          }
        } catch (err) {
          await InboxSyncState.findByIdAndUpdate(syncState._id, {
            status: 'error',
            lastError: err.message
          });
        }
      }
    }
  } catch (err) {
    console.warn('[inboxSyncService] Background sync worker error:', err.message);
  }
};
