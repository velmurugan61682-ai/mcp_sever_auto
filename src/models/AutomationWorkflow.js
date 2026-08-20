import mongoose from 'mongoose';

const nodeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    position: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 }
    }
  },
  { _id: false }
);

const edgeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    source: { type: String, required: true },
    target: { type: String, required: true }
  },
  { _id: false }
);

const automationWorkflowSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true
    },
    name: {
      type: String,
      default: 'Untitled Workflow Draft',
      trim: true
    },
    trigger: {
      type: String,
      default: 'New message received'
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'paused'],
      default: 'draft',
      index: true
    },
    currentStep: {
      type: Number,
      default: 1
    },
    stepData: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    nodes: [nodeSchema],
    edges: [edgeSchema],
    executionsCount: {
      type: Number,
      default: 0
    },
    lastExecutedAt: Date
  },
  { timestamps: true }
);

export const AutomationWorkflow = mongoose.models.AutomationWorkflow || mongoose.model('AutomationWorkflow', automationWorkflowSchema);
export default AutomationWorkflow;
