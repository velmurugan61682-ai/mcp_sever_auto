import mongoose from 'mongoose';

const dealSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', index: true },
    pipelineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pipeline', required: true, index: true },
    stageKey: { type: String, required: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    value: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    probability: { type: Number, default: 0 },
    status: { type: String, enum: ['open', 'won', 'lost', 'archived'], default: 'open', index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    expectedCloseAt: Date,
    tags: [{ type: String, trim: true }],
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    archivedAt: Date,
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

dealSchema.index({ workspaceId: 1, pipelineId: 1, stageKey: 1 });
dealSchema.index({ workspaceId: 1, contactId: 1 });

export const Deal = mongoose.models.Deal || mongoose.model('Deal', dealSchema);
export default Deal;
