import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    actorType: { type: String, enum: ['human', 'ai', 'workflow', 'system'], default: 'human', index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId },
    source: { type: String, enum: ['human', 'ai', 'workflow', 'system'], default: 'human', index: true },
    action: { type: String, required: true },
    category: {
      type: String,
      enum: ['auth', 'mcp_connection', 'tool_execution', 'app_connection', 'crm', 'automation', 'security', 'governance', 'approvals', 'agents'],
      default: 'tool_execution',
      index: true
    },
    entityType: { type: String, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, index: true },
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
    outcome: { type: String, enum: ['success', 'blocked', 'queued', 'failed'], default: 'success', index: true },
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info', index: true },
    reason: String,
    correlationId: String,
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, default: '127.0.0.1' },
    userAgent: { type: String, default: 'mcp.ai-client' }
  },
  { timestamps: true }
);

auditLogSchema.index({ workspaceId: 1, entityType: 1, entityId: 1, createdAt: -1 });

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
