import mongoose from 'mongoose';

const automationWorkflowSchema = new mongoose.Schema(
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
    name: {
      type: String,
      required: [true, 'Workflow name is required'],
      trim: true
    },
    trigger: {
      type: String,
      enum: [
        'New message received',
        'New lead created',
        'Keyword detected',
        'Scheduled time',
        'Webhook received',
        'Manual trigger',
        'MCP resource updated'
      ],
      required: true
    },
    targetApp: {
      type: String,
      default: 'Custom MCP Server'
    },
    serverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MCPServer'
    },
    selectedTool: {
      type: String,
      default: ''
    },
    parameterMapping: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    conditions: [
      {
        field: String,
        operator: String,
        value: String
      }
    ],
    actionsCount: {
      type: Number,
      default: 1
    },
    status: {
      type: String,
      enum: ['active', 'paused'],
      default: 'active'
    },
    executionsCount: {
      type: Number,
      default: 0
    },
    successRate: {
      type: Number,
      default: 100
    },
    lastExecutedAt: Date
  },
  { timestamps: true }
);

export const AutomationWorkflow = mongoose.model('AutomationWorkflow', automationWorkflowSchema);
