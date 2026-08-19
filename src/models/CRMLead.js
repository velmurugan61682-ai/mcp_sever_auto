import mongoose from 'mongoose';

const crmLeadSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
      required: [true, 'Lead name is required'],
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },
    phone: {
      type: String,
      default: ''
    },
    company: {
      type: String,
      default: ''
    },
    title: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['hot', 'warm', 'cold'],
      default: 'warm'
    },
    stage: {
      type: String,
      enum: ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'],
      default: 'New'
    },
    leadScore: {
      type: Number,
      default: 50
    },
    sourcePlatform: {
      type: String,
      default: 'Website'
    },
    tags: [{ type: String }],
    notes: [
      {
        content: String,
        createdAt: { type: Date, default: Date.now },
        author: String
      }
    ],
    lastInteractionAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

crmLeadSchema.index({ workspaceId: 1, email: 1 });
crmLeadSchema.index({ workspaceId: 1, stage: 1, updatedAt: -1 });

export const CRMLead = mongoose.model('CRMLead', crmLeadSchema);
