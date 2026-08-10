import mongoose from 'mongoose';

const toolCallSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    args: mongoose.Schema.Types.Mixed,
    result: mongoose.Schema.Types.Mixed,
    status: {
      type: String,
      enum: ['pending', 'executing', 'success', 'error'],
      default: 'pending'
    },
    durationMs: Number,
    error: String
  },
  { _id: false }
);

const unifiedMessageSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: String,
      required: true,
      default: 'default-workspace',
      index: true
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UnifiedConversation',
      required: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    connectedAppId: {
      type: String,
      default: 'custom_mcp'
    },
    sourceApp: {
      type: String,
      required: true,
      default: 'MCP.ai Assistant'
    },
    externalMessageId: {
      type: String,
      index: true
    },
    direction: {
      type: String,
      enum: ['incoming', 'outgoing'],
      required: true
    },
    senderExternalId: {
      type: String,
      default: ''
    },
    recipientExternalId: {
      type: String,
      default: ''
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'file', 'audio', 'document'],
      default: 'text'
    },
    content: {
      type: String,
      default: ''
    },
    attachments: [
      {
        url: String,
        mimeType: String,
        name: String,
        size: Number
      }
    ],
    sentAt: {
      type: Date,
      default: Date.now
    },
    deliveryStatus: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
      default: 'delivered'
    },
    isAIReply: {
      type: Boolean,
      default: false
    },
    aiModel: {
      type: String,
      default: ''
    },
    toolCalls: [toolCallSchema],
    errorMessage: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

// Prevent duplicates using unique compound key: sourceApp + workspaceId + externalMessageId
unifiedMessageSchema.index({ sourceApp: 1, workspaceId: 1, externalMessageId: 1 }, { unique: true, sparse: true });

export const UnifiedMessage = mongoose.models.UnifiedMessage || mongoose.model('UnifiedMessage', unifiedMessageSchema);
