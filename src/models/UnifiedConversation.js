import mongoose from 'mongoose';

const unifiedConversationSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: String,
      required: true,
      default: 'default-workspace',
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
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
    sourceAppIcon: {
      type: String,
      default: 'MessageSquare'
    },
    externalConversationId: {
      type: String,
      index: true
    },
    contactName: {
      type: String,
      required: true,
      default: 'MCP.ai Assistant'
    },
    contactAvatar: {
      type: String,
      default: ''
    },
    contactExternalId: {
      type: String,
      default: ''
    },
    lastMessage: {
      type: String,
      default: ''
    },
    lastMessageAt: {
      type: Date,
      default: Date.now
    },
    unreadCount: {
      type: Number,
      default: 0
    },
    readOnly: {
      type: Boolean,
      default: false
    },
    online: {
      type: Boolean,
      default: true
    },
    isAutoReplyEnabled: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['active', 'archived', 'closed'],
      default: 'active'
    }
  },
  { timestamps: true }
);

unifiedConversationSchema.index({ workspaceId: 1, sourceApp: 1, externalConversationId: 1 }, { unique: true, sparse: true });

export const UnifiedConversation = mongoose.models.UnifiedConversation || mongoose.model('UnifiedConversation', unifiedConversationSchema);
