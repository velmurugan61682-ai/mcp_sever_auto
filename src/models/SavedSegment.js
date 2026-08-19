import mongoose from 'mongoose';

const savedSegmentSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true, trim: true },
    entityType: { type: String, enum: ['contact', 'company', 'deal', 'ticket'], required: true },
    filters: {
      status: String,
      source: String,
      ownerId: mongoose.Schema.Types.ObjectId,
      tag: String,
      minScore: Number,
      notContactedInDays: Number,
      archived: Boolean
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

savedSegmentSchema.index({ workspaceId: 1, name: 1, entityType: 1 }, { unique: true });

export const SavedSegment = mongoose.models.SavedSegment || mongoose.model('SavedSegment', savedSegmentSchema);
export default SavedSegment;
