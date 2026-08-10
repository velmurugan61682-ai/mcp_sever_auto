import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    workspaceId: {
      type: String,
      default: 'default-workspace'
    },
    action: {
      type: String,
      required: true
    },
    category: {
      type: String,
      enum: ['auth', 'mcp_connection', 'tool_execution', 'app_connection', 'crm', 'automation', 'security'],
      default: 'tool_execution'
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    ipAddress: {
      type: String,
      default: '127.0.0.1'
    },
    userAgent: {
      type: String,
      default: 'mcp.ai-client'
    }
  },
  { timestamps: true }
);

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
