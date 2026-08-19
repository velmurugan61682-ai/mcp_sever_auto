import mongoose from 'mongoose';

const approvalItemSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      index: true,
    },
    actionType: {
      type: String,
      required: true, // 'message_reply', 'goodwill_credit', 'refund', 'outbound_call', 'social_publish', 'deal_create', 'workflow_step'
      index: true,
    },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      index: true,
    },
    requiredRole: {
      type: String,
      enum: ['agent', 'manager', 'finance_manager', 'admin', 'owner'],
      default: 'manager',
    },
    requestedByAgent: {
      type: String,
      default: 'AI Agent',
    },
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agent',
    },
    customerName: {
      type: String,
      default: '',
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CRMLead',
    },
    channel: {
      type: String,
      default: 'whatsapp',
    },
    proposedContent: {
      type: String,
      default: '',
    },
    financialAmount: {
      type: Number,
      default: 0,
    },
    reasonForApproval: {
      type: String,
      default: 'Action exceeds current agent autonomy level or guardrail rule.',
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'edited_and_approved', 'rejected', 'expired'],
      default: 'pending',
      index: true,
    },
    slaDueAt: {
      type: Date,
      index: true,
    },
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    decidedAt: {
      type: Date,
    },
    decisionNotes: {
      type: String,
      default: '',
    },
    originalProposal: {
      type: String,
    },
    finalExecutedContent: {
      type: String,
    },
    executionStatus: {
      type: String,
      enum: ['not_executed', 'success', 'failed'],
      default: 'not_executed',
    },
    executionError: {
      type: String,
    },
    sourceWorkflowRunId: {
      type: String,
    },
  },
  { timestamps: true }
);

export const ApprovalItem = mongoose.model('ApprovalItem', approvalItemSchema);
export default ApprovalItem;
