import mongoose from 'mongoose';

const structuredActivitySchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      index: true,
    },
    actor: {
      type: String,
      required: true, // 'Sarah (Sales AI)', 'BUZZZ AI', 'Arun Kumar', 'Admin'
    },
    actorType: {
      type: String,
      enum: ['agent', 'workflow', 'system', 'human', 'partner_api'],
      default: 'agent',
      index: true,
    },
    mode: {
      type: String,
      enum: ['autonomous', 'approved', 'human_manual', 'blocked_guardrail'],
      default: 'autonomous',
      index: true,
    },
    action: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ['messages', 'crm_changes', 'appointments', 'social_posts', 'calls', 'workflows', 'approvals', 'governance', 'settings'],
      default: 'messages',
      index: true,
    },
    detail: {
      type: String,
      default: '',
    },
    customerName: {
      type: String,
      default: '',
      index: true,
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CRMLead',
    },
    outcome: {
      type: String,
      enum: ['success', 'pending_approval', 'blocked', 'failed'],
      default: 'success',
      index: true,
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info',
    },
    beforeValue: mongoose.Schema.Types.Mixed,
    afterValue: mongoose.Schema.Types.Mixed,
    linkedEntityId: String,
  },
  { timestamps: true }
);

export const StructuredActivity = mongoose.model('StructuredActivity', structuredActivitySchema);
export default StructuredActivity;
