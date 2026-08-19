import mongoose from 'mongoose';

const agentSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: [
        'sales',
        'support',
        'appointment',
        'lead_qualification',
        'retention',
        'voice',
        'social',
        'custom',
      ],
      default: 'support',
    },
    roleTitle: {
      type: String,
      default: 'Customer Support AI',
    },
    systemPrompt: {
      type: String,
      default: '',
    },
    tone: {
      type: String,
      enum: ['professional', 'friendly', 'direct', 'empathetic', 'consultative'],
      default: 'friendly',
    },
    autonomyLevel: {
      type: Number,
      min: 0,
      max: 4,
      default: 2, // 0: Suggest only, 1: Approval required, 2: Auto reply low risk, 3: Full CRM act, 4: Autonomous operator
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'draft'],
      default: 'active',
    },
    goals: [
      {
        type: String,
      },
    ],
    rules: [
      {
        type: String,
      },
    ],
    guardrails: [
      {
        name: String,
        condition: String,
        action: {
          type: String,
          enum: ['block_and_escalate', 'block_and_rewrite', 'require_approval'],
          default: 'require_approval',
        },
      },
    ],
    tools: [
      {
        type: String, // 'crm', 'calendar', 'ticketing', 'payments', 'social', 'mrassistant_voice', 'gowhats_whatsapp', 'instaxbot_instagram'
      },
    ],
    permissions: [
      {
        type: String, // 'CAN_SEND_MESSAGE', 'CAN_BOOK_APPOINTMENT', 'CAN_CREATE_DEAL', 'CAN_ISSUE_REFUND', 'CAN_PLACE_CALL', 'CAN_POST_SOCIAL'
      },
    ],
    allowedChannels: [
      {
        type: String,
      },
    ],
    knowledgeSources: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'KnowledgeSource',
      },
    ],
    escalationHandoffTarget: {
      type: String,
      default: 'human_agent',
    },
    stats: {
      conversationsHandled: { type: Number, default: 0 },
      resolutionRate: { type: Number, default: 0 },
      escalationRate: { type: Number, default: 0 },
      csatScore: { type: Number, default: 4.8 },
      avgResponseSeconds: { type: Number, default: 4 },
    },
  },
  { timestamps: true }
);

export const Agent = mongoose.model('Agent', agentSchema);
export default Agent;
