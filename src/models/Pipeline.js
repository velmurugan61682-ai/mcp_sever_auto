import mongoose from 'mongoose';

const pipelineStageSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, required: true },
    color: { type: String, default: '#2563eb' },
    archivedAt: Date
  },
  { _id: false }
);

const pipelineSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true, trim: true },
    stages: [pipelineStageSchema],
    isDefault: { type: Boolean, default: false },
    archivedAt: Date,
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

pipelineSchema.index({ workspaceId: 1, name: 1 }, { unique: true });

export const Pipeline = mongoose.models.Pipeline || mongoose.model('Pipeline', pipelineSchema);
export default Pipeline;
